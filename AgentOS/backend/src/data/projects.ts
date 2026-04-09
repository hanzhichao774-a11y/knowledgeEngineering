import { resolve } from 'node:path';
import type { GraphifyFreshness, GraphifySnapshotStatus } from '../services/graphifyClient.js';

type Tone = 'mint' | 'blue' | 'amber' | 'rose';

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

export interface KnowledgeBaseSummary {
  label: string;
  workspacePath: string;
  snapshotId: string | null;
  freshness: GraphifyFreshness;
  updatedAt?: string;
  nodeCount: number;
  recordCount: number;
  assetRoot?: string;
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
}

export interface ProjectRecord {
  id: string;
  name: string;
  shortName: string;
  sourceFileName: string;
  fileType: string;
  sizeLabel: string;
  uploadedAt: string;
  workspacePath: string;
  graphifyRepoPath: string;
  knowledgeBaseLabel: string;
  suggestedQuestions: string[];
}

const DEFAULT_GRAPHIFY_WORKSPACE = resolve(import.meta.dirname, '../../../../graphify-workspace');
const DEFAULT_GRAPHIFY_REPO = resolve(import.meta.dirname, '../../../../../graphify-v3');

const PROJECTS: ProjectRecord[] = [
  {
    id: 'project-beijing-heating-agent-os',
    name: '北京热力集团智能体建设',
    shortName: '北京热力集团',
    sourceFileName: '北京热力集团智能体建设技术方案-260204.docx',
    fileType: 'DOCX',
    sizeLabel: '2.6 MB',
    uploadedAt: '2026-02-04 09:30',
    workspacePath: process.env.AGENTOS_PROJECT_WORKSPACE_PATH ?? DEFAULT_GRAPHIFY_WORKSPACE,
    graphifyRepoPath: process.env.GRAPHIFY_REPO_PATH ?? DEFAULT_GRAPHIFY_REPO,
    knowledgeBaseLabel: '热力简报（2026年2月8日-2月9日）',
    suggestedQuestions: [
      '2月8日0-24时北京市海淀分公司热力诉求总量详细信息是什么？',
      '大网水耗排名后三位的中心有哪些？',
      '当前知识库里记录了哪些影响供热工作的突发情况？',
    ],
  },
];

export function listProjectRecords() {
  return PROJECTS;
}

export function getProjectRecord(projectId: string) {
  return PROJECTS.find((project) => project.id === projectId) ?? null;
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

export function buildProjectSummary(project: ProjectRecord, snapshot: GraphifySnapshotStatus): ProjectSummary {
  const knowledgeStatus = snapshot.exists ? '可问答' : '待解析';
  const knowledgeTone: Tone = snapshot.exists ? 'mint' : 'amber';
  const snapshotTimeLabel = formatSnapshotTime(snapshot.updatedAt);

  return {
    id: project.id,
    name: project.name,
    shortName: project.shortName,
    description: '围绕智能体建设方案建立项目工作区，当前页面已经挂载现成知识库，可直接开始问答。',
    focus: '知识库问答、方案理解与证据追踪',
    status: knowledgeStatus,
    statusTone: knowledgeTone,
    fileName: project.sourceFileName,
    fileType: project.fileType,
    uploadedAt: project.uploadedAt,
    sizeLabel: project.sizeLabel,
    suggestedQuestions: project.suggestedQuestions,
    knowledgeBase: {
      label: project.knowledgeBaseLabel,
      workspacePath: project.workspacePath,
      snapshotId: snapshot.snapshotId,
      freshness: snapshot.freshness,
      updatedAt: snapshot.updatedAt,
      nodeCount: snapshot.nodeCount,
      recordCount: snapshot.recordCount,
      assetRoot: snapshot.assetRoot,
    },
    participantAgents: [
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
        status: '已参与',
        statusTone: 'mint',
        description: '围绕 graphify 快照做结构化检索、记录命中和来源整理。',
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
    ],
    stats: [
      { label: '知识状态', value: knowledgeStatus },
      { label: '知识节点', value: String(snapshot.nodeCount) },
      { label: '结构化记录', value: String(snapshot.recordCount) },
      { label: '最新快照', value: snapshotTimeLabel },
    ],
    alerts: [
      `当前项目页已挂载现成知识库“${project.knowledgeBaseLabel}”，可以直接发起问答。`,
      snapshot.freshness.status === 'fresh'
        ? '知识库快照状态新鲜，可直接基于当前资产回答。'
        : '知识库快照不是 fresh，回答时请留意时效性。',
    ],
    memory: [
      `项目名称：${project.name}`,
      `项目源文件：${project.sourceFileName}`,
      `当前挂载知识库：${project.knowledgeBaseLabel}`,
      `知识快照：${snapshot.snapshotId ?? '未生成'} / ${snapshotTimeLabel}`,
    ],
    chat: [
      {
        id: `${project.id}-intro-user`,
        speaker: '项目负责人',
        role: 'user',
        content: '请基于当前挂载知识库回答问题，并在回答里保留来源与证据。',
        format: 'plain',
        createdAt: snapshot.updatedAt ?? new Date().toISOString(),
      },
      {
        id: `${project.id}-intro-agent`,
        speaker: 'Project Agent',
        role: 'agent',
        content: [
          `### 当前已接入知识库`,
          ``,
          `- 项目：**${project.name}**`,
          `- 挂载知识库：**${project.knowledgeBaseLabel}**`,
          `- Snapshot：\`${snapshot.snapshotId ?? 'missing'}\``,
          `- 节点 / 记录：**${snapshot.nodeCount} / ${snapshot.recordCount}**`,
          ``,
          `可以直接在下方提问。我会基于现成的 graphify 结果返回 Markdown 格式回答，并附上命中来源。`,
        ].join('\n'),
        format: 'markdown',
        createdAt: snapshot.updatedAt ?? new Date().toISOString(),
        meta: {
          snapshotId: snapshot.snapshotId,
          freshness: snapshot.freshness,
          sourceCount: 0,
          recordCount: snapshot.recordCount,
          nodeCount: snapshot.nodeCount,
        },
      },
    ],
    recommendations: [
      {
        title: '当前状态',
        content: '项目页不再是静态展示，已经可以直接用现成知识库做群聊问答。'
      },
      {
        title: '下一步动作',
        content: '补项目上传接口，把新资料落到项目目录，再通过 Runtime Gateway 触发 graphify 刷新。'
      },
      {
        title: '问答策略',
        content: '优先围绕已挂载知识库中的事实、表格和原因分析发问，命中会更稳定。'
      },
    ],
    timeline: [
      {
        title: `${project.uploadedAt} 项目源文件登记`,
        content: `${project.sourceFileName} 已作为项目主资料登记。`
      },
      {
        title: `${snapshotTimeLabel} 知识库挂载`,
        content: `现成 graphify snapshot 已挂到项目页，当前来源是 ${project.knowledgeBaseLabel}。`
      },
      {
        title: '当前阶段',
        content: '项目群聊已经可以直接对已存在知识库发起问答。'
      },
    ],
  };
}
