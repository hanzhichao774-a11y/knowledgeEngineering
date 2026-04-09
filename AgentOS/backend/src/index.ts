import Fastify from 'fastify';
import {
  buildProjectSummary,
  getProjectRecord,
  listProjectRecords,
  type ChatMessage,
} from './data/projects.js';
import { GraphifyClient, type GraphifyFreshness } from './services/graphifyClient.js';

const server = Fastify({
  logger: true,
});

server.get('/health', async () => ({
  status: 'ok',
}));

server.get('/api/projects', async (_request, reply) => {
  const projects = await Promise.all(
    listProjectRecords().map(async (project) => {
      const client = new GraphifyClient({
        workspacePath: project.workspacePath,
        repoPath: project.graphifyRepoPath,
      });
      const snapshot = await client.getSnapshotStatus();
      return buildProjectSummary(project, snapshot);
    }),
  );

  return reply.send({ projects });
});

server.post<{
  Params: { projectId: string };
  Body: { question?: string };
}>('/api/projects/:projectId/chat', async (request, reply) => {
  const project = getProjectRecord(request.params.projectId);
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
    workspacePath: project.workspacePath,
    repoPath: project.graphifyRepoPath,
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
        format: 'structured',
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
}) {
  const sources = uniqueStrings([
    ...input.answer.sources,
    ...input.records.map((record) => String(record.source_file ?? '')).filter(Boolean),
    ...input.answer.nodes.map((node) => String(node.source_file ?? '')).filter(Boolean),
  ]);

  const lines: string[] = [
    `### 回答`,
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

  return `当前知识库中没有找到与该问题直接匹配的强相关记录。建议改用更具体的时间、中心、单位或事件关键词继续提问。`;
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
  const location = asString(record.source_location);
  const payload = isObject(record.record_json) ? record.record_json : null;
  const summary = payload ? summarizePayload(payload) : '';
  const parts = [`**${label}**`];
  if (location) {
    parts.push(`（${location}）`);
  }
  if (summary) {
    parts.push(`：${summary}`);
  }
  return parts.join('');
}

function summarizePayload(payload: Record<string, unknown>) {
  const centers = asStringArray(payload.centers);
  if (centers.length > 0) {
    const reasons = asStringArray(payload.main_reasons);
    const measures = asStringArray(payload.measures);
    const fragments = [`中心 ${centers.join('、')}`];
    if (reasons.length > 0) {
      fragments.push(`原因 ${reasons.slice(0, 3).join('、')}`);
    }
    if (measures.length > 0) {
      fragments.push(`措施 ${measures.slice(0, 3).join('、')}`);
    }
    return fragments.join('；');
  }

  const managementUnit = asString(payload.management_unit);
  if (managementUnit) {
    return [
      `管理单位 ${managementUnit}`,
      `12345 ${asNumberLike(payload.source_12345_complaints) ?? '--'} 件`,
      `96069 ${asNumberLike(payload.source_96069_network_complaints) ?? '--'} 件`,
      `小循环 ${asNumberLike(payload.source_small_cycle_complaints) ?? '--'} 件`,
      `微循环 ${asNumberLike(payload.source_micro_cycle_complaints) ?? '--'} 件`,
    ].join('；');
  }

  const incidents = asStringArray(payload.heat_source_incidents);
  if (incidents.length > 0) {
    return `突发情况 ${incidents.slice(0, 3).join('、')}`;
  }

  const entries = Object.entries(payload)
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .slice(0, 4)
    .map(([key, value]) => `${humanizeKey(key)} ${formatUnknown(value)}`);
  return entries.join('；');
}

function formatNodeBullet(node: Record<string, unknown>) {
  const label = String(node.label ?? '未命名节点');
  const location = asString(node.source_location);
  const degree = asNumberLike(node.degree);
  const segments = [`**${label}**`];
  if (location) {
    segments.push(`（${location}）`);
  }
  if (degree !== null) {
    segments.push(`，关联度 ${degree}`);
  }
  return segments.join('');
}

function asString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : null;
}

function asNumberLike(value: unknown) {
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string' && value.trim()) return value;
  return null;
}

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0) : [];
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function shortSourceName(source: string) {
  const segments = source.split('/');
  return segments.at(-1) ?? source;
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

function humanizeKey(key: string) {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (segment) => segment.toUpperCase());
}

function formatUnknown(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map((item) => formatUnknown(item)).join('、');
  }
  if (isObject(value)) {
    return Object.entries(value)
      .slice(0, 3)
      .map(([key, innerValue]) => `${humanizeKey(key)} ${formatUnknown(innerValue)}`)
      .join('；');
  }
  return String(value);
}

const host = process.env.HOST ?? '0.0.0.0';
const port = Number(process.env.PORT ?? 3011);

const start = async () => {
  try {
    await server.listen({ host, port });
  } catch (error) {
    server.log.error(error);
    process.exit(1);
  }
};

void start();
