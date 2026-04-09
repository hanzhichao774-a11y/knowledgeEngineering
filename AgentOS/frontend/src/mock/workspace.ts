export type Tone = 'mint' | 'blue' | 'amber' | 'rose';
export type ViewKey = 'overview' | 'graph' | 'projects' | 'agents' | 'project';

export interface Metric {
  label: string;
  value: string;
  detail: string;
  tone: Tone;
}

export interface ProjectSummary {
  id: string;
  name: string;
  shortName: string;
  description: string;
  focus: string;
  status: string;
  statusTone: Tone;
  stats: Array<{ label: string; value: string }>;
  alerts: string[];
  memory: string[];
  chat: Array<{ speaker: string; role: 'user' | 'agent'; content: string }>;
  recommendations: Array<{ title: string; content: string }>;
  timeline: Array<{ title: string; content: string }>;
  fileName: string;
  fileType: string;
  uploadedAt: string;
  sizeLabel: string;
}

const documentExtensions = new Set(['pdf', 'doc', 'docx', 'md', 'txt']);
const sheetExtensions = new Set(['xls', 'xlsx', 'csv']);
const slideExtensions = new Set(['ppt', 'pptx', 'key']);

function formatCount(value: number) {
  return String(value).padStart(2, '0');
}

export function buildOverviewMetrics(projects: ProjectSummary[]): Metric[] {
  const totalProjects = projects.length;
  const pendingProjects = projects.filter((project) => ['待解析', '构建中'].includes(project.status)).length;
  const readyProjects = projects.filter((project) => project.status === '可问答').length;

  return [
    { label: '在线项目', value: formatCount(totalProjects), detail: '项目列表由 Agent OS API 提供', tone: 'mint' },
    { label: '知识库项目', value: formatCount(totalProjects), detail: '一个项目对应一套知识库', tone: 'blue' },
    { label: '构建中 / 待解析', value: formatCount(pendingProjects), detail: '等待 Runtime Gateway 接入 graphify', tone: 'amber' },
    { label: '可问答知识库', value: formatCount(readyProjects), detail: '可直接进入项目页查看上下文', tone: 'rose' },
  ];
}

export function buildProjectAlerts(projects: ProjectSummary[]) {
  return projects.slice(0, 4).flatMap((project) =>
    project.alerts.slice(0, 2).map((alert) => `${project.shortName}：${alert}`),
  );
}

export function buildIssueDistribution(projects: ProjectSummary[]) {
  let documentCount = 0;
  let sheetCount = 0;
  let slideCount = 0;
  let otherCount = 0;

  for (const project of projects) {
    const extension = project.fileType.toLowerCase();
    if (documentExtensions.has(extension)) {
      documentCount += 1;
    } else if (sheetExtensions.has(extension)) {
      sheetCount += 1;
    } else if (slideExtensions.has(extension)) {
      slideCount += 1;
    } else {
      otherCount += 1;
    }
  }

  return [
    { label: '文档资料', value: String(documentCount) },
    { label: '结构化表格', value: String(sheetCount) },
    { label: '演示资料', value: String(slideCount) },
    { label: '其他资料', value: String(otherCount) },
  ];
}

export const graphMetrics: Metric[] = [
  { label: '文件数据源', value: '24', detail: '文档、对话、日志、工单都已纳入目录', tone: 'mint' },
  { label: 'API 连接器', value: '05', detail: 'CRM、工单、消息和权限系统', tone: 'blue' },
  { label: '知识单元', value: '1286', detail: '已切分并带业务语义标签', tone: 'amber' },
  { label: '实体 / 关系', value: '412 / 2184', detail: '图谱可解释、可追溯、可维护', tone: 'rose' },
];

export const graphAssets = [
  {
    title: '文件导入',
    description: '下一步会把真实上传接口接进来；当前项目目录先由 Agent OS API 提供。',
    tags: ['业务文档', '规则文档', '操作日志', '工单记录'],
    tone: 'blue' as Tone,
  },
  {
    title: 'API / Connector 接入',
    description: '可接 CRM、工单、消息和权限系统，重点是能看出这里能连外部系统。',
    tags: ['CRM', '工单系统', '消息系统', '权限系统'],
    tone: 'mint' as Tone,
  },
];

export const graphNodes = [
  { title: '项目目录', desc: '后端返回项目列表', tone: 'mint' as Tone },
  { title: '文件元数据', desc: 'name / type / size', tone: 'blue' as Tone },
  { title: 'graphify', desc: '知识编译与图谱构建', tone: 'amber' as Tone },
  { title: '知识快照', desc: 'graphify-out', tone: 'blue' as Tone },
  { title: '项目知识库', desc: '每个项目一套知识库', tone: 'mint' as Tone },
];

export const agents = [
  {
    icon: '知',
    title: '知识工程 Agent',
    description: '接入文档、日志、台账和业务记录，做 Schema 识别、结构化和图谱映射。',
    tags: ['数据接入', '图谱构建', '知识校验'],
    tone: 'mint' as Tone,
  },
  {
    icon: '析',
    title: 'Analysis Agent',
    description: '围绕行为模式、异常信号和历史案例做分析判断，为建议动作提供前置依据。',
    tags: ['分析', '模式识别', '趋势判断'],
    tone: 'blue' as Tone,
  },
  {
    icon: '自',
    title: 'Automation Agent',
    description: '围绕自动动作、任务编排和系统回写做约束校验，更适合在项目页中被按需唤醒。',
    tags: ['自动化', '动作建议', '约束校验'],
    tone: 'amber' as Tone,
  },
  {
    icon: '项',
    title: 'Project Agent',
    description: '每个项目一个 Project Agent，对应一个群聊工作区，负责拆解任务、唤醒专业 Agent 和保留项目记忆。',
    tags: ['项目编排', '群聊入口', '项目记忆'],
    tone: 'blue' as Tone,
  },
  {
    icon: '管',
    title: 'Manager Agent',
    description: '站在首页和项目管理层级上做审计、熔断和项目协调，让系统具备企业级治理属性。',
    tags: ['审计', '熔断', '冲突协调'],
    tone: 'rose' as Tone,
  },
];
