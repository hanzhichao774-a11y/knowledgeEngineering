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

interface UploadLike {
  name: string;
  size: number;
  type: string;
  lastModified: number;
}

const documentExtensions = new Set(['pdf', 'doc', 'docx', 'md', 'txt']);
const sheetExtensions = new Set(['xls', 'xlsx', 'csv']);
const slideExtensions = new Set(['ppt', 'pptx', 'key']);

function formatCount(value: number) {
  return String(value).padStart(2, '0');
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getExtension(filename: string) {
  const segments = filename.split('.');
  return segments.length > 1 ? segments.at(-1)!.toLowerCase() : 'file';
}

function trimExtension(filename: string) {
  return filename.replace(/\.[^.]+$/, '');
}

function humanizeProjectName(filename: string) {
  return trimExtension(filename)
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function toShortName(name: string) {
  if (name.length <= 12) return name;
  return `${name.slice(0, 12)}...`;
}

function formatTimestamp(timestamp: number) {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(timestamp));
}

function detectFileClass(extension: string) {
  if (documentExtensions.has(extension)) return '文档资料';
  if (sheetExtensions.has(extension)) return '结构化表格';
  if (slideExtensions.has(extension)) return '演示资料';
  return '其他资料';
}

function detectFocus(extension: string) {
  if (documentExtensions.has(extension)) return '文档解析与知识抽取';
  if (sheetExtensions.has(extension)) return '结构化记录解析与字段映射';
  if (slideExtensions.has(extension)) return '演示材料结构抽取与摘要';
  return '通用文件接入与知识构建';
}

export function createProjectFromUpload(file: UploadLike, order: number): ProjectSummary {
  const extension = getExtension(file.name);
  const fileClass = detectFileClass(extension);
  const projectName = humanizeProjectName(file.name);
  const shortName = toShortName(projectName);
  const uploadedAt = formatTimestamp(file.lastModified || Date.now());
  const sizeLabel = formatFileSize(file.size);
  const id = `upload-${file.lastModified}-${file.size}-${order}`;

  return {
    id,
    name: projectName || `上传项目 ${order + 1}`,
    shortName,
    description: `由上传文件生成的项目工作区，当前文件类型为 ${fileClass}。`,
    focus: `${fileClass}的解析、构建与问答准备`,
    status: '待解析',
    statusTone: 'amber',
    fileName: file.name,
    fileType: extension.toUpperCase(),
    uploadedAt,
    sizeLabel,
    stats: [
      { label: '文件数量', value: '1' },
      { label: '文件类型', value: extension.toUpperCase() },
      { label: '文件大小', value: sizeLabel },
      { label: '上传时间', value: uploadedAt },
    ],
    alerts: [
      `${file.name} 已上传，等待 graphify 解析。`,
      '当前知识库尚未构建，问答能力未激活。',
    ],
    memory: [
      `源文件：${file.name}`,
      `资料类型：${fileClass}`,
      `文件大小：${sizeLabel}`,
      `上传时间：${uploadedAt}`,
    ],
    chat: [
      { speaker: '项目负责人', role: 'user', content: `请基于这份文件建立知识库并准备后续问答：${file.name}` },
      { speaker: 'Project Agent', role: 'agent', content: '已接收文件，当前前端阶段仅完成上传驱动的项目创建；后续将接入 graphify 解析。' },
    ],
    recommendations: [
      { title: '当前状态', content: '文件已上传，项目工作区已创建，但知识库仍处于待解析状态。' },
      { title: '下一步动作', content: '调用 graphify 对当前项目目录执行解析，生成 graphify-out 知识资产。' },
      { title: '问答前提', content: '完成知识库构建后，才可以基于该项目发起知识问答。' },
    ],
    timeline: [
      { title: `${uploadedAt} 文件上传`, content: `${file.name} 已进入当前项目工作区。` },
      { title: `${uploadedAt} 项目创建`, content: '项目管理页已基于上传文件生成对应项目。' },
      { title: '待执行 graphify', content: '等待 Runtime Gateway 触发 graphify 解析。' },
    ],
  };
}

export function buildOverviewMetrics(projects: ProjectSummary[]): Metric[] {
  const uploadCount = projects.length;
  const parsePending = projects.filter((project) => project.status === '待解析').length;
  const askReady = projects.filter((project) => project.status === '可问答').length;

  return [
    { label: '在线项目', value: formatCount(uploadCount), detail: '项目管理页的数据改为由上传文件驱动生成', tone: 'mint' },
    { label: '已上传文件', value: formatCount(uploadCount), detail: '每个已上传文件都会生成一个项目工作区', tone: 'blue' },
    { label: '待解析项目', value: formatCount(parsePending), detail: '这些项目已上传文件，但知识库尚未构建', tone: 'amber' },
    { label: '可问答知识库', value: formatCount(askReady), detail: '当前前端阶段默认未接入真实解析链路', tone: 'rose' },
  ];
}

export function buildProjectAlerts(projects: ProjectSummary[]) {
  return projects.slice(0, 4).map((project) => `${project.shortName}：${project.fileName} 已上传，当前状态为 ${project.status}。`);
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
    description: '支持 CSV、Excel、PDF、Word 等业务资料，重点是把它看成知识库补数入口。',
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
  { title: '上传文件', desc: '待解析资料', tone: 'mint' as Tone },
  { title: '文件元数据', desc: 'name / type / size', tone: 'blue' as Tone },
  { title: 'graphify', desc: '知识编译与图谱构建', tone: 'amber' as Tone },
  { title: '知识快照', desc: 'graphify-out', tone: 'blue' as Tone },
  { title: '项目工作区', desc: '每个项目一套知识库', tone: 'mint' as Tone },
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
