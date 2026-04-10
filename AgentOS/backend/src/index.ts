import Fastify from 'fastify';
import multipart from '@fastify/multipart';
import {
  buildKnowledgeBaseSummary,
  buildProjectFileSummaries,
  buildProjectSummary,
  type ChatMessage,
} from './data/projects.js';
import { agentOsConfig } from './config.js';
import { bootstrapRuntime } from './services/bootstrap.js';
import { GraphifyClient, type GraphifyFreshness } from './services/graphifyClient.js';
import { ProjectStore } from './services/projectStore.js';

const server = Fastify({
  logger: true,
});

const projectStore = new ProjectStore();
const activeBuilds = new Map<string, Promise<void>>();

await server.register(multipart, {
  limits: {
    fileSize: 50 * 1024 * 1024,
    files: 10,
  },
});

await bootstrapRuntime(projectStore);

server.get('/health', async () => ({
  status: 'ok',
  runtimeRoot: agentOsConfig.runtimeRoot,
}));

server.get('/api/projects', async (_request, reply) => {
  const projectRecords = await projectStore.listProjectRecords();
  const projects = await Promise.all(projectRecords.map(buildProjectView));
  return reply.send({ projects });
});

server.post<{
  Body: { name?: string; description?: string; focus?: string };
}>('/api/projects', async (request, reply) => {
  const name = String(request.body?.name ?? '').trim();
  if (!name) {
    return reply.code(400).send({
      ok: false,
      error: 'Project name is required',
    });
  }

  try {
    const project = await projectStore.createProject({
      name,
      description: request.body?.description,
      focus: request.body?.focus,
    });

    if (!project) {
      throw new Error('Project could not be created');
    }

    return reply.code(201).send({
      ok: true,
      project: await buildProjectView(project),
    });
  } catch (error) {
    return reply.code(409).send({
      ok: false,
      error: error instanceof Error ? error.message : 'Project creation failed',
    });
  }
});

server.get<{
  Params: { projectId: string };
}>('/api/projects/:projectId/files', async (request, reply) => {
  const project = await projectStore.getProjectRecord(request.params.projectId);
  if (!project) {
    return reply.code(404).send({
      ok: false,
      error: 'Project not found',
    });
  }

  return reply.send({
    ok: true,
    projectId: project.id,
    files: buildProjectFileSummaries(project.files),
  });
});

server.post<{
  Params: { projectId: string };
}>('/api/projects/:projectId/files', async (request, reply) => {
  const project = await projectStore.getProjectRecord(request.params.projectId);
  if (!project) {
    return reply.code(404).send({
      ok: false,
      error: 'Project not found',
    });
  }

  const uploadedFiles = [];
  for await (const part of request.files()) {
    const buffer = await part.toBuffer();
    const fileRecord = await projectStore.saveUploadedFile(project.id, {
      originalName: part.filename || 'file',
      mimeType: part.mimetype || 'application/octet-stream',
      buffer,
    });
    uploadedFiles.push(fileRecord);
  }

  if (uploadedFiles.length === 0) {
    return reply.code(400).send({
      ok: false,
      error: 'At least one file is required',
    });
  }

  const nextProject = await projectStore.getProjectRecord(project.id);
  return reply.code(201).send({
    ok: true,
    projectId: project.id,
    uploadedFiles: buildProjectFileSummaries(uploadedFiles),
    project: nextProject ? await buildProjectView(nextProject) : null,
  });
});

server.get<{
  Params: { projectId: string };
}>('/api/projects/:projectId/kb/status', async (request, reply) => {
  const project = await projectStore.getProjectRecord(request.params.projectId);
  if (!project) {
    return reply.code(404).send({
      ok: false,
      error: 'Project not found',
    });
  }

  const runtime = new GraphifyClient({
    workspacePath: project.projectRoot,
  });
  const snapshot = await runtime.getSnapshotStatus();

  return reply.send({
    ok: true,
    projectId: project.id,
    knowledgeBase: buildKnowledgeBaseSummary(project, snapshot, runtime.isBuildAvailable()),
  });
});

server.post<{
  Params: { projectId: string };
}>('/api/projects/:projectId/kb/build', async (request, reply) => {
  const project = await projectStore.getProjectRecord(request.params.projectId);
  if (!project) {
    return reply.code(404).send({
      ok: false,
      error: 'Project not found',
    });
  }

  if (activeBuilds.has(project.id)) {
    return reply.code(409).send({
      ok: false,
      error: 'Knowledge base build is already running',
    });
  }

  const runtime = new GraphifyClient({
    workspacePath: project.projectRoot,
  });
  if (!runtime.isBuildAvailable()) {
    return reply.code(503).send({
      ok: false,
      error: 'Graphify build adapter is not configured',
    });
  }

  const startedAt = new Date().toISOString();
  const task = await projectStore.appendTask(project.id, {
    type: 'kb.build',
    status: 'running',
    title: '知识库构建中',
    message: 'Runtime Gateway 已接收 build 请求，正在生成项目知识资产。',
    createdAt: startedAt,
    updatedAt: startedAt,
  });

  await projectStore.updateKnowledgeBaseState(project.id, {
    status: 'building',
    lastError: undefined,
    dirtyReason: project.kbState.dirtyReason,
    dirtySince: project.kbState.dirtySince,
  });
  await projectStore.updateProjectMeta(project.id, { updatedAt: startedAt });

  const buildJob = runProjectBuild(project.id, task.id)
    .finally(() => {
      activeBuilds.delete(project.id);
    });
  activeBuilds.set(project.id, buildJob);

  const refreshedProject = await projectStore.getProjectRecord(project.id);
  const snapshot = await runtime.getSnapshotStatus();
  return reply.code(202).send({
    ok: true,
    projectId: project.id,
    task,
    knowledgeBase: refreshedProject
      ? buildKnowledgeBaseSummary(refreshedProject, snapshot, runtime.isBuildAvailable())
      : null,
  });
});

server.get<{
  Params: { projectId: string };
}>('/api/projects/:projectId/tasks', async (request, reply) => {
  const project = await projectStore.getProjectRecord(request.params.projectId);
  if (!project) {
    return reply.code(404).send({
      ok: false,
      error: 'Project not found',
    });
  }

  return reply.send({
    ok: true,
    projectId: project.id,
    tasks: project.tasks,
  });
});

server.post<{
  Params: { projectId: string };
  Body: { question?: string };
}>('/api/projects/:projectId/chat', async (request, reply) => {
  const project = await projectStore.getProjectRecord(request.params.projectId);
  if (!project) {
    return reply.code(404).send({
      ok: false,
      error: 'Project not found',
    });
  }

  const question = String(request.body.question ?? '').trim();
  if (!question) {
    return reply.code(400).send({
      ok: false,
      error: 'Question is required',
    });
  }

  const client = new GraphifyClient({
    workspacePath: project.projectRoot,
  });

  try {
    const snapshot = await client.getSnapshotStatus();
    if (!snapshot.exists) {
      return reply.code(503).send({
        ok: false,
        error: 'Knowledge base is not ready',
      });
    }

    const [askResult, recordResult] = await Promise.all([
      client.ask({
        question,
        topN: 5,
      }),
      client.searchRecords({
        query: question,
        topN: 8,
      }),
    ]);

    const normalizedAnswer = normalizeStructuredGraphifyAnswer(askResult.answer);
    const records = normalizedAnswer.records.length > 0 ? normalizedAnswer.records : recordResult.records;
    const markdown = buildMarkdownAnswer({
      projectName: project.name,
      question,
      answer: normalizedAnswer,
      records,
      snapshotId: askResult.snapshotId ?? snapshot.snapshotId,
      freshness: askResult.freshness ?? snapshot.freshness,
      knowledgeBaseLabel: project.knowledgeBaseLabel,
      knowledgeStatus: project.kbState.status,
    });

    const message: ChatMessage = {
      id: `${project.id}-${Date.now()}`,
      speaker: 'Project Agent',
      role: 'agent',
      content: markdown,
      format: 'markdown',
      createdAt: new Date().toISOString(),
      meta: {
        snapshotId: askResult.snapshotId ?? snapshot.snapshotId,
        freshness: askResult.freshness ?? snapshot.freshness,
        sourceCount: normalizedAnswer.sources.length,
        recordCount: records.length,
        nodeCount: normalizedAnswer.nodes.length,
      },
    };

    return reply.send({
      ok: true,
      projectId: project.id,
      message,
      evidence: {
        sources: normalizedAnswer.sources,
        records,
        nodes: normalizedAnswer.nodes,
      },
    });
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({
      ok: false,
      error: error instanceof Error ? error.message : 'Chat query failed',
    });
  }
});

function normalizeStructuredGraphifyAnswer(answer: unknown): {
  question: string;
  records: Array<Record<string, unknown>>;
  nodes: Array<Record<string, unknown>>;
  sources: string[];
} {
  if (!answer || typeof answer !== 'object') {
    return {
      question: '',
      records: [],
      nodes: [],
      sources: [],
    };
  }

  const payload = answer as Record<string, unknown>;
  return {
    question: String(payload.question ?? ''),
    records: Array.isArray(payload.records) ? payload.records as Array<Record<string, unknown>> : [],
    nodes: Array.isArray(payload.nodes) ? payload.nodes as Array<Record<string, unknown>> : [],
    sources: Array.isArray(payload.sources) ? payload.sources.filter((item): item is string => typeof item === 'string') : [],
  };
}

async function buildProjectView(project: NonNullable<Awaited<ReturnType<ProjectStore['getProjectRecord']>>>) {
  const runtime = new GraphifyClient({
    workspacePath: project.projectRoot,
  });
  const snapshot = await runtime.getSnapshotStatus();
  return buildProjectSummary(project, snapshot, runtime.isBuildAvailable());
}

async function runProjectBuild(projectId: string, taskId: string) {
  const project = await projectStore.getProjectRecord(projectId);
  if (!project) {
    return;
  }

  const runtime = new GraphifyClient({
    workspacePath: project.projectRoot,
  });

  try {
    const result = await runtime.rebuild({
      reason: 'api-triggered-build',
    });
    const refreshedProject = await projectStore.getProjectRecord(projectId);
    const snapshot = await runtime.getSnapshotStatus();
    const completedAt = new Date().toISOString();

    await projectStore.updateKnowledgeBaseState(projectId, {
      status: snapshot.exists ? 'ready' : 'failed',
      activeSnapshotId: snapshot.snapshotId ?? result.snapshotId,
      lastBuildAt: completedAt,
      dirtySince: undefined,
      dirtyReason: undefined,
      lastError: undefined,
    });
    await projectStore.updateProjectMeta(projectId, { updatedAt: completedAt });
    await projectStore.updateTask(projectId, taskId, {
      title: '知识库构建完成',
      status: 'completed',
      message: `知识库构建完成，当前 snapshot 为 ${snapshot.snapshotId ?? result.snapshotId ?? 'missing'}。`,
      updatedAt: completedAt,
    });

    if (refreshedProject && snapshot.recordCount > 0) {
      const answer = await runtime.searchRecords({ query: refreshedProject.name, topN: 1 });
      const firstRecord = answer.records[0];
      const nextLabel = String(firstRecord?.label ?? '').trim();
      if (nextLabel) {
        await projectStore.updateProjectMeta(projectId, {
          knowledgeBaseLabel: nextLabel,
          updatedAt: completedAt,
        });
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Build failed';
    const failedAt = new Date().toISOString();
    await projectStore.updateKnowledgeBaseState(projectId, {
      status: 'failed',
      lastBuildAt: failedAt,
      lastError: message,
    });
    await projectStore.updateProjectMeta(projectId, { updatedAt: failedAt });
    await projectStore.updateTask(projectId, taskId, {
      title: '知识库构建失败',
      status: 'failed',
      message: `知识库构建失败：${message}`,
      updatedAt: failedAt,
    });
  }
}

function buildMarkdownAnswer(input: {
  projectName: string;
  question: string;
  answer: {
    question: string;
    records: Array<Record<string, unknown>>;
    nodes: Array<Record<string, unknown>>;
    sources: string[];
  };
  records: Array<Record<string, unknown>>;
  snapshotId: string | null;
  freshness: GraphifyFreshness;
  knowledgeBaseLabel: string;
  knowledgeStatus: string;
}) {
  const sources = uniqueStrings([
    ...input.answer.sources,
    ...input.records.map((record) => String(record.source_file ?? '')).filter(Boolean),
    ...input.answer.nodes.map((node) => String(node.source_file ?? '')).filter(Boolean),
  ]);

  const lines: string[] = [
    '### 回答',
    '',
  ];

  const lead = buildLeadParagraph(input.records, input.answer.nodes, input.knowledgeBaseLabel);
  lines.push(lead, '');

  if (input.records.length > 0) {
    lines.push('### 命中记录', '');
    for (const record of input.records.slice(0, 4)) {
      lines.push(`- ${formatRecordBullet(record)}`);
    }
    lines.push('');
  }

  if (input.answer.nodes.length > 0) {
    lines.push('### 关联节点', '');
    for (const node of input.answer.nodes.slice(0, 4)) {
      lines.push(`- ${formatNodeBullet(node)}`);
    }
    lines.push('');
  }

  if (sources.length > 0) {
    lines.push('### 来源', '');
    for (const source of sources.slice(0, 5)) {
      lines.push(`- \`${shortSourceName(source)}\``);
    }
    lines.push('');
  }

  lines.push('### 知识库状态', '');
  lines.push(`- 项目：**${input.projectName}**`);
  lines.push(`- 挂载知识库：**${input.knowledgeBaseLabel}**`);
  lines.push(`- 知识状态：**${input.knowledgeStatus}**`);
  lines.push(`- Snapshot：\`${input.snapshotId ?? 'missing'}\``);
  lines.push(`- Freshness：**${input.freshness.status}**`);
  if (input.freshness.updatedAt) {
    lines.push(`- 更新时间：**${formatTime(input.freshness.updatedAt)}**`);
  }

  return lines.join('\n').trim();
}

function buildLeadParagraph(
  records: Array<Record<string, unknown>>,
  nodes: Array<Record<string, unknown>>,
  knowledgeBaseLabel: string,
) {
  const primaryRecord = records[0];
  if (primaryRecord) {
    const summary = summarizeRecord(primaryRecord);
    if (summary) return `${summary} 当前回答基于 **${knowledgeBaseLabel}** 中的命中内容整理。`;
  }

  if (nodes.length > 0) {
    const labels = nodes.slice(0, 3).map((node) => `**${String(node.label ?? '未命名节点')}**`);
    return `当前问题没有命中清晰的结构化记录，但关联到了 ${labels.join('、')} 等节点，可继续围绕这些节点追问。`;
  }

  return '当前知识库中没有找到与该问题直接匹配的强相关记录。建议改用更具体的时间、中心、单位或事件关键词继续提问。';
}

function summarizeRecord(record: Record<string, unknown>) {
  const label = String(record.label ?? '命中记录');
  const payload = isObject(record.record_json) ? record.record_json : null;
  if (!payload) return `命中了 **${label}**。`;

  const managementUnit = asString(payload.management_unit);
  if (managementUnit) {
    const parts = [
      `12345诉求 **${asNumberLike(payload.source_12345_complaints) ?? '--'}** 件`,
      `96069网络诉求 **${asNumberLike(payload.source_96069_network_complaints) ?? '--'}** 件`,
      `小循环 **${asNumberLike(payload.source_small_cycle_complaints) ?? '--'}** 件`,
      `微循环 **${asNumberLike(payload.source_micro_cycle_complaints) ?? '--'}** 件`,
    ];
    return `命中了 **${managementUnit}** 的热力诉求统计记录，核心数据包括：${parts.join('，')}。`;
  }

  const centers = asStringArray(payload.centers);
  if (centers.length > 0) {
    return `命中了 **${label}**，涉及中心为 **${centers.join('、')}**。`;
  }

  const incidents = asStringArray(payload.heat_source_incidents);
  if (incidents.length > 0) {
    return `命中了 **${label}**，当前知识库记录的重点突发情况包括：${incidents.slice(0, 3).join('；')}。`;
  }

  const period = asString(payload.period);
  if (period) {
    return `命中了 **${label}**，记录时间范围为 **${period}**。`;
  }

  return `命中了 **${label}**。`;
}

function formatRecordBullet(record: Record<string, unknown>) {
  const label = String(record.label ?? '未命名记录');
  const location = String(record.source_location ?? '').trim();
  const payload = isObject(record.record_json) ? record.record_json : null;
  const payloadParts = payload ? summarizeRecordPayload(payload) : '';
  const suffix = [location && `位置：${location}`, payloadParts].filter(Boolean).join('；');
  return suffix ? `**${label}**，${suffix}` : `**${label}**`;
}

function summarizeRecordPayload(payload: Record<string, unknown>) {
  const centers = asStringArray(payload.centers);
  if (centers.length > 0) {
    return `中心：${centers.join('、')}`;
  }

  const managementUnit = asString(payload.management_unit);
  if (managementUnit) {
    return `单位：${managementUnit}`;
  }

  const period = asString(payload.period);
  if (period) {
    return `时间：${period}`;
  }

  return '';
}

function formatNodeBullet(node: Record<string, unknown>) {
  const label = String(node.label ?? node.id ?? '未命名节点');
  const source = String(node.source_file ?? '').trim();
  const location = String(node.source_location ?? '').trim();
  const details = [source && shortSourceName(source), location].filter(Boolean).join(' · ');
  return details ? `**${label}** (${details})` : `**${label}**`;
}

function shortSourceName(source: string) {
  const segments = source.split(/[\\/]/).filter(Boolean);
  return segments.at(-1) ?? source;
}

function uniqueStrings(items: string[]) {
  return [...new Set(items.filter(Boolean))];
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Shanghai',
  }).format(date);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function asStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.map((item) => asString(item)).filter((item): item is string => Boolean(item))
    : [];
}

function asNumberLike(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'string' && value.trim()) return value.trim();
  return undefined;
}

const address = await server.listen({
  host: '0.0.0.0',
  port: agentOsConfig.port,
});

server.log.info(`AgentOS backend listening on ${address}`);
