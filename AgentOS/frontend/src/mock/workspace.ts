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
  status: '高关注' | '跟踪中' | '稳定';
  statusTone: Tone;
  stats: Array<{ label: string; value: string }>;
  alerts: string[];
  memory: string[];
  chat: Array<{ speaker: string; role: 'user' | 'agent'; content: string }>;
  recommendations: Array<{ title: string; content: string }>;
  timeline: Array<{ title: string; content: string }>;
}

export const overviewMetrics: Metric[] = [
  { label: '在线项目', value: '03', detail: '3 个 Project Agent 正在承载平台内的示例工作区', tone: 'mint' },
  { label: '活跃 Agent', value: '12', detail: '知识工程、分析、自动化和治理持续协同', tone: 'blue' },
  { label: '待审批动作', value: '05', detail: '需要在项目管理和项目页进一步确认', tone: 'amber' },
  { label: '高优先告警', value: '02', detail: '当前都来自知识接入项目', tone: 'rose' },
];

export const projects: ProjectSummary[] = [
  {
    id: 'chaoyang',
    name: '企业知识接入升级',
    shortName: '知识接入项目',
    description: '围绕资料接入、规则映射、风险审批和证据链留存展开。',
    focus: '规则映射异常与高风险自动动作审批',
    status: '高关注',
    statusTone: 'rose',
    stats: [
      { label: '待处理问题', value: '4' },
      { label: '待审批动作', value: '2' },
      { label: '活跃 Agent', value: '5' },
      { label: '今日协同次数', value: '11' },
    ],
    alerts: [
      '规则映射结果出现高置信冲突。',
      '存在一条高风险自动写回建议，已被 Manager Agent 拦截。',
    ],
    memory: [
      '当前工作区已接入制度文档、操作手册、历史工单和审批记录。',
      '最近 7 天新资料增长较快，知识边界和版本冲突开始出现。',
      '负责人更关注“低风险试探性动作 + 完整证据链”。',
    ],
    chat: [
      { speaker: '项目负责人', role: 'user', content: '分析一下这批新接入资料的规则映射冲突，并给出后续处理建议。' },
      { speaker: 'Project Agent', role: 'agent', content: '已创建任务链：读取资料、检索规则、比对历史处理记录、生成建议并交 Manager Agent 审计。' },
      { speaker: 'Analysis Agent', role: 'agent', content: '检测到 3 组字段映射冲突，其中 1 组会影响后续自动写回动作。' },
      { speaker: 'Knowledge Agent', role: 'agent', content: '业务规则 4.2 指向“高置信冲突 + 自动写回”组合，必须先补充人工校验，不建议直接执行。' },
      { speaker: 'Automation Agent', role: 'agent', content: '如果强制执行自动写回，可能会污染当前版本快照，并影响后续检索结果。' },
      { speaker: 'Project Agent', role: 'agent', content: '综合判断更适合先做规则复核，再放行低风险补写；高风险写回动作继续保持人工审批。' },
    ],
    recommendations: [
      { title: '结论', content: '当前问题更像规则冲突和版本边界不清，而不是单点数据异常。' },
      { title: '建议动作', content: '先做规则复核，再放行低风险补写；高风险自动写回动作继续要求人工审批。' },
      { title: '审批状态', content: '已放行低风险规则补写，已拦截高风险自动写回建议。' },
    ],
    timeline: [
      { title: '09:12 Project Agent', content: '创建规则冲突诊断任务链，唤醒 3 个专业 Agent。' },
      { title: '09:13 数据调用', content: '读取 126 份资料，命中 3 组冲突规则和 2 条历史处理记录。' },
      { title: '09:14 风险审计', content: 'Manager Agent 放行低风险建议，拦截高风险自动写回动作。' },
      { title: '09:15 等待人工确认', content: '当前待项目负责人审批规则补写方案。' },
    ],
  },
  {
    id: 'haidian',
    name: '销售线索协同试点',
    shortName: '销售协同项目',
    description: '聚焦线索打分、跟进编排和销售协作建议。',
    focus: '线索优先级波动与跟进策略偏差',
    status: '跟踪中',
    statusTone: 'amber',
    stats: [
      { label: '待处理问题', value: '3' },
      { label: '待审批动作', value: '1' },
      { label: '活跃 Agent', value: '4' },
      { label: '今日协同次数', value: '7' },
    ],
    alerts: [
      'CRM 中一批线索标签缺失，评分结果不稳定。',
      '高意向线索的跟进策略区间偏宽，置信度不足。',
    ],
    memory: [
      '项目重点不是聊天，而是协同节奏、策略质量和转化路径。',
      'Analysis Agent 是这个项目的主力 Agent。',
    ],
    chat: [
      { speaker: '销售负责人', role: 'user', content: '这批高意向线索的跟进优先级是否需要重新排序？' },
      { speaker: 'Project Agent', role: 'agent', content: '已唤醒 Analysis Agent 和 Knowledge Agent，当前项目页保留为简版骨架。' },
    ],
    recommendations: [
      { title: '结论', content: '更适合先补齐线索标签，再重新排序高意向跟进队列。' },
      { title: '建议动作', content: '补齐 CRM 缺失字段后重新计算优先级区间。' },
    ],
    timeline: [
      { title: '10:03 Analysis Agent', content: '识别到 2 批异常线索，需补齐缺失标签后再做优先级重排。' },
    ],
  },
  {
    id: 'service',
    name: '客服质检联动项目',
    shortName: '客服质检项目',
    description: '围绕会话质检、问题聚类和处理建议进行协同。',
    focus: '高风险会话聚类与回访任务派发',
    status: '稳定',
    statusTone: 'mint',
    stats: [
      { label: '待处理问题', value: '2' },
      { label: '待审批动作', value: '0' },
      { label: '活跃 Agent', value: '3' },
      { label: '今日协同次数', value: '5' },
    ],
    alerts: [
      '一批高风险会话标签集中，需做问题归因。',
    ],
    memory: [
      '会话质检和工单结果需要联动查看，不适合只做文本总结。',
    ],
    chat: [
      { speaker: '客服主管', role: 'user', content: '把本周高风险会话按问题类型和责任归属聚一聚。' },
      { speaker: 'Project Agent', role: 'agent', content: '已整理会话聚类与工单结果，当前保留轻量群聊骨架。' },
    ],
    recommendations: [
      { title: '结论', content: '当前高风险会话存在明显问题集中度，值得单独拉出排查任务。' },
      { title: '建议动作', content: '把回访任务派发给对应团队，并保留后续质检记录。' },
    ],
    timeline: [
      { title: '11:26 Project Agent', content: '会话聚类报告已生成，待派发后续回访。' },
    ],
  },
];

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
  { title: '客户工单 A-12', desc: '高风险标签冲突', tone: 'mint' as Tone },
  { title: '会话记录', desc: 'session-04', tone: 'blue' as Tone },
  { title: '业务规则 4.2', desc: '高风险动作审批规则', tone: 'amber' as Tone },
  { title: '处理事件', desc: '最近一次人工复核', tone: 'blue' as Tone },
  { title: '项目工作区', desc: '企业知识接入升级', tone: 'mint' as Tone },
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

export const projectAlerts = [
  '知识接入项目：一条低风险规则补写建议待项目负责人审批。',
  '知识接入项目：存在一条高风险自动写回建议，已被 Manager Agent 拦截。',
  '销售协同项目：CRM 中一批线索标签缺失，需数据补录。',
  '客服质检项目：高风险会话聚类报告已生成，待派发回访任务。',
];

export const issueDistribution = [
  { label: '流程异常', value: '4' },
  { label: '策略偏差', value: '2' },
  { label: '数据缺口', value: '1' },
  { label: '协同阻塞', value: '2' },
];
