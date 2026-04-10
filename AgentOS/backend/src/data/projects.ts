import path from 'node:path';
import type { GraphifyFreshness, GraphifySnapshotStatus } from '../services/graphifyClient.js';

type Tone = 'mint' | 'blue' | 'amber' | 'rose';

export type KnowledgeBaseState = 'empty' | 'dirty' | 'building' | 'ready' | 'failed';
export type ProjectTaskStatus = 'queued' | 'running' | 'completed' | 'failed';

interface ProjectMetric {
  label: string;
  value: string;
}

interface TimelineItem {
  title: string;
  content: string;
}

export interface ChatMessage {
  id: string;
  speaker: string;
  role: 'user' | 'agent';
  content: string;
  format: 'plain' | 'markdown';
  createdAt: string;
  meta?: {
    snapshotId?: string | null;
    freshness?: GraphifyFreshness;
    sourceCount?: number;
    recordCount?: number;
    nodeCount?: number;
  };
}

interface Recommendation {
  title: string;
  content: string;
}

export interface ProjectFileRecord {
  id: string;
  originalName: string;
  storedName: string;
  mimeType: string;
  extension: string;
  sizeBytes: number;
  uploadedAt: string;
}

export interface ProjectTaskRecord {
  id: string;
  type: string;
  status: ProjectTaskStatus;
  title: string;
  message: string;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

export interface KnowledgeBaseStateRecord {
  status: KnowledgeBaseState;
  lastBuildAt?: string;
  dirtySince?: string;
  dirtyReason?: string;
  lastError?: string;
  activeSnapshotId?: string | null;
}

export interface ProjectMetaRecord {
  id: string;
  name: string;
  shortName: string;
  description: string;
  focus: string;
  knowledgeBaseLabel: string;
  suggestedQuestions: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ProjectRecord extends ProjectMetaRecord {
  projectRoot: string;
  workspacePath: string;
  files: ProjectFileRecord[];
  tasks: ProjectTaskRecord[];
  kbState: KnowledgeBaseStateRecord;
}

export interface ProjectFileSummary {
  id: string;
  name: string;
  mimeType: string;
  extension: string;
  uploadedAt: string;
  sizeBytes: number;
  sizeLabel: string;
}

export interface KnowledgeBaseSummary {
  label: string;
  workspacePath: string;
  status: KnowledgeBaseState;
  snapshotId: string | null;
  freshness: GraphifyFreshness;
  updatedAt?: string;
  nodeCount: number;
  recordCount: number;
  assetRoot?: string;
  buildAvailable: boolean;
  dirtySince?: string;
  dirtyReason?: string;
  lastBuildAt?: string;
  lastError?: string;
}

export interface ParticipantAgent {
  id: string;
  icon: string;
  name: string;
  role: string;
  status: string;
  statusTone: Tone;
  description: string;
  capabilities: string[];
}

export interface ProjectSummary {
  id: string;
  name: string;
  shortName: string;
  description: string;
  focus: string;
  status: string;
  statusTone: Tone;
  stats: ProjectMetric[];
  alerts: string[];
  memory: string[];
  chat: ChatMessage[];
  recommendations: Recommendation[];
  timeline: TimelineItem[];
  fileName: string;
  fileType: string;
  uploadedAt: string;
  sizeLabel: string;
  suggestedQuestions: string[];
  knowledgeBase: KnowledgeBaseSummary;
  participantAgents: ParticipantAgent[];
  fileCount: number;
  taskCount: number;
  createdAt: string;
  updatedAt: string;
}

export function defaultKnowledgeBaseState(): KnowledgeBaseStateRecord {
  return {
    status: 'empty',
    activeSnapshotId: null,
  };
}

export function defaultSuggestedQuestions(projectName: string) {
  const shortName = projectName.trim() || '当前项目';
  return [
    `${shortName} 当前有哪些核心资料已经纳入知识库？`,
    `${shortName} 最近一次知识库构建的状态是什么？`,
    `${shortName} 现有资料里有哪些值得继续追问的重点主题？`,
  ];
}

export function buildProjectSummary(
  project: ProjectRecord,
  snapshot: GraphifySnapshotStatus,
  buildAvailable: boolean,
): ProjectSummary {
  const primaryFile = project.files[0];
  const knowledgeBase = buildKnowledgeBaseSummary(project, snapshot, buildAvailable);
  const knowledgeStatus = kbStatusLabel(knowledgeBase.status, snapshot.exists);
  const knowledgeTone = kbStatusTone(knowledgeBase.status, snapshot.exists);
  const snapshotTimeLabel = formatSnapshotTime(snapshot.updatedAt);
  const timeline = buildTimeline(project.tasks);
  const primaryFileName = primaryFile?.originalName ?? '尚未上传资料';

  return {
    id: project.id,
    name: project.name,
    shortName: project.shortName,
    description: project.description,
    focus: project.focus,
    status: knowledgeStatus,
    statusTone: knowledgeTone,
    fileName: primaryFileName,
    fileType: primaryFile?.extension.toUpperCase() ?? '--',
    uploadedAt: primaryFile ? formatSnapshotTime(primaryFile.uploadedAt) : '--',
    sizeLabel: primaryFile ? formatFileSize(primaryFile.sizeBytes) : '--',
    suggestedQuestions: project.suggestedQuestions,
    knowledgeBase,
    fileCount: project.files.length,
    taskCount: project.tasks.length,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    participantAgents: buildParticipantAgents(knowledgeBase.status),
    stats: [
      { label: '知识状态', value: knowledgeStatus },
      { label: '项目资料', value: String(project.files.length) },
      { label: '结构化记录', value: String(snapshot.recordCount) },
      { label: '最新快照', value: snapshot.exists ? snapshotTimeLabel : '--' },
    ],
    alerts: buildProjectAlerts(project, knowledgeBase, snapshot, buildAvailable),
    memory: [
      `项目名称：${project.name}`,
      `项目目录：${project.projectRoot}`,
      `资料数量：${project.files.length}`,
      `知识状态：${knowledgeStatus}`,
      `快照：${snapshot.snapshotId ?? '未生成'}`,
    ],
    chat: buildIntroChat(project, knowledgeBase, snapshot),
    recommendations: buildRecommendations(project, knowledgeBase, buildAvailable),
    timeline,
  };
}

export function buildKnowledgeBaseSummary(
  project: ProjectRecord,
  snapshot: GraphifySnapshotStatus,
  buildAvailable: boolean,
): KnowledgeBaseSummary {
  return {
    label: project.knowledgeBaseLabel,
    workspacePath: project.workspacePath,
    status: project.kbState.status,
    snapshotId: snapshot.snapshotId ?? project.kbState.activeSnapshotId ?? null,
    freshness: snapshot.freshness,
    updatedAt: snapshot.updatedAt,
    nodeCount: snapshot.nodeCount,
    recordCount: snapshot.recordCount,
    assetRoot: snapshot.assetRoot,
    buildAvailable,
    dirtySince: project.kbState.dirtySince,
    dirtyReason: project.kbState.dirtyReason,
    lastBuildAt: project.kbState.lastBuildAt,
    lastError: project.kbState.lastError,
  };
}

export function buildProjectFileSummary(file: ProjectFileRecord): ProjectFileSummary {
  return {
    id: file.id,
    name: file.originalName,
    mimeType: file.mimeType,
    extension: file.extension,
    uploadedAt: file.uploadedAt,
    sizeBytes: file.sizeBytes,
    sizeLabel: formatFileSize(file.sizeBytes),
  };
}

export function buildProjectFileSummaries(files: ProjectFileRecord[]) {
  return files.map(buildProjectFileSummary);
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function buildProjectId(name: string) {
  const slug = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, ' ')
    .trim()
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return slug ? `project-${slug}` : `project-${Date.now()}`;
}

export function deriveShortName(name: string) {
  const trimmed = name.trim();
  if (trimmed.length <= 10) return trimmed;
  return trimmed.slice(0, 10);
}

export function normalizeExtension(fileName: string) {
  const ext = path.extname(fileName).replace(/^\./, '').toLowerCase();
  return ext || 'file';
}

function kbStatusLabel(status: KnowledgeBaseState, snapshotExists: boolean) {
  if (status === 'ready' && snapshotExists) return '可问答';
  if (status === 'dirty' && snapshotExists) return '待刷新';
  if (status === 'dirty') return '待构建';
  if (status === 'building') return '构建中';
  if (status === 'failed') return '构建失败';
  return '待解析';
}

function kbStatusTone(status: KnowledgeBaseState, snapshotExists: boolean): Tone {
  if (status === 'ready' && snapshotExists) return 'mint';
  if (status === 'building') return 'blue';
  if (status === 'failed') return 'rose';
  return 'amber';
}

function buildProjectAlerts(
  project: ProjectRecord,
  knowledgeBase: KnowledgeBaseSummary,
  snapshot: GraphifySnapshotStatus,
  buildAvailable: boolean,
) {
  const alerts: string[] = [];

  if (project.files.length === 0) {
    alerts.push('项目资料：当前项目还没有上传文件。');
  } else {
    alerts.push(`项目资料：当前已有 ${project.files.length} 个文件纳入项目目录。`);
  }

  if (knowledgeBase.status === 'dirty' && snapshot.exists) {
    alerts.push('知识库状态：资料已变更，当前问答仍基于上一次 snapshot，建议尽快重建。');
  } else if (knowledgeBase.status === 'building') {
    alerts.push('知识库状态：项目知识库正在构建中，完成后会更新最新 snapshot。');
  } else if (knowledgeBase.status === 'failed') {
    alerts.push(`知识库状态：最近一次构建失败${knowledgeBase.lastError ? `，原因：${knowledgeBase.lastError}` : ''}。`);
  } else if (snapshot.exists) {
    alerts.push('知识库状态：当前存在可用 snapshot，可直接发起问答。');
  } else {
    alerts.push('知识库状态：当前还没有可用 snapshot，需要先构建知识库。');
  }

  if (!buildAvailable) {
    alerts.push('Runtime Gateway：尚未配置 graphify build adapter，当前只能读取现有知识资产。');
  }

  return alerts;
}

function buildIntroChat(
  project: ProjectRecord,
  knowledgeBase: KnowledgeBaseSummary,
  snapshot: GraphifySnapshotStatus,
): ChatMessage[] {
  const createdAt = snapshot.updatedAt ?? project.updatedAt ?? new Date().toISOString();
  const readyText = snapshot.exists
    ? '可以直接在下方提问。我会基于项目自己的知识资产返回 Markdown 格式回答，并保留来源与证据。'
    : '当前项目还没有可用 snapshot，请先上传资料并触发知识库构建。';
  const dirtyHint = knowledgeBase.status === 'dirty'
    ? '\n\n当前项目资料有新增或变更，问答仍在使用上一次 snapshot。'
    : '';

  return [
    {
      id: `${project.id}-intro-user`,
      speaker: '项目负责人',
      role: 'user',
      content: '请基于当前项目知识库回答问题，并在回答里保留来源与证据。',
      format: 'plain',
      createdAt,
    },
    {
      id: `${project.id}-intro-agent`,
      speaker: 'Project Agent',
      role: 'agent',
      content: [
        '### 当前项目知识库',
        '',
        `- 项目：**${project.name}**`,
        `- 资料数量：**${project.files.length}**`,
        `- 知识状态：**${kbStatusLabel(knowledgeBase.status, snapshot.exists)}**`,
        `- Snapshot：\`${knowledgeBase.snapshotId ?? 'missing'}\``,
        `- 节点 / 记录：**${snapshot.nodeCount} / ${snapshot.recordCount}**`,
        '',
        `${readyText}${dirtyHint}`,
      ].join('\n'),
      format: 'markdown',
      createdAt,
      meta: {
        snapshotId: knowledgeBase.snapshotId,
        freshness: knowledgeBase.freshness,
        sourceCount: 0,
        recordCount: snapshot.recordCount,
        nodeCount: snapshot.nodeCount,
      },
    },
  ];
}

function buildRecommendations(
  project: ProjectRecord,
  knowledgeBase: KnowledgeBaseSummary,
  buildAvailable: boolean,
): Recommendation[] {
  const recommendations: Recommendation[] = [
    {
      title: '项目资料',
      content: project.files.length > 0
        ? '继续把文档、日志、表格等资料纳入项目目录，形成项目自己的资料池。'
        : '先上传项目主资料，建立该项目的 raw 文件目录。'
    },
    {
      title: '知识库策略',
      content: knowledgeBase.status === 'ready'
        ? '当前知识资产可直接问答；若资料变更，记得重新 build。'
        : '上传资料后先做知识库构建，再围绕已有 snapshot 发问。'
    },
  ];

  recommendations.push({
    title: '运行时适配',
    content: buildAvailable
      ? '当前 Runtime Gateway 已具备 build 入口，可以直接发起知识库重建。'
      : '如需执行 graphify build，请在 AgentOS 根目录配置 `.env` 中的 graphify build 适配参数。'
  });

  return recommendations;
}

function buildParticipantAgents(status: KnowledgeBaseState): ParticipantAgent[] {
  return [
    {
      id: 'project-agent',
      icon: '项',
      name: 'Project Agent',
      role: '当前对话主持与任务编排',
      status: '主持中',
      statusTone: 'blue',
      description: '负责接收问题、协调其他 Agent、汇总回答并把结果回收到当前会话。',
      capabilities: ['会话管理', '任务编排', '上下文汇总'],
    },
    {
      id: 'knowledge-agent',
      icon: '知',
      name: '知识工程 Agent',
      role: '知识库检索与证据整理',
      status: status === 'ready' || status === 'dirty' ? '已参与' : '待构建',
      statusTone: status === 'failed' ? 'rose' : status === 'building' ? 'blue' : status === 'ready' || status === 'dirty' ? 'mint' : 'amber',
      description: '围绕项目 graphify 资产做结构化检索、记录命中和来源整理。',
      capabilities: ['记录检索', '来源追踪', '知识快照'],
    },
    {
      id: 'analysis-agent',
      icon: '析',
      name: 'Analysis Agent',
      role: '问题分析与追问建议',
      status: '待唤醒',
      statusTone: 'amber',
      description: '在问题需要归因、对比和进一步拆解时进入当前对话。',
      capabilities: ['归因分析', '问题拆解', '追问建议'],
    },
    {
      id: 'manager-agent',
      icon: '管',
      name: 'Manager Agent',
      role: '审计与多 Agent 协同监控',
      status: '监控中',
      statusTone: 'rose',
      description: '负责从管理视角监控当前项目对话的治理边界和协同状态。',
      capabilities: ['治理审计', '冲突协调', '状态监控'],
    },
  ];
}

function buildTimeline(tasks: ProjectTaskRecord[]) {
  if (tasks.length === 0) {
    return [
      {
        title: '当前阶段',
        content: '项目已创建，等待上传资料并触发知识库构建。',
      },
    ];
  }

  return tasks.slice(0, 4).map((task) => ({
    title: `${formatSnapshotTime(task.updatedAt)} ${task.title}`,
    content: task.message,
  }));
}

function formatSnapshotTime(updatedAt?: string) {
  if (!updatedAt) return '--';
  const date = new Date(updatedAt);
  if (Number.isNaN(date.getTime())) return updatedAt;
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
