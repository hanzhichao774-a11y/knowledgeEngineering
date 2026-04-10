export interface AgentInfo {
  id: string;
  name: string;
  role: 'manager' | 'worker';
  description: string;
  skills: string[];
  model: string;
  children: string[];
}

export interface SkillInfo {
  id: string;
  name: string;
  category: 'pipeline' | 'query' | 'system';
  agent?: string;
  icon: string;
  desc: string;
}

export const AGENT_REGISTRY: AgentInfo[] = [
  {
    id: 'manager-01',
    name: '管理智能体',
    role: 'manager',
    description: '任务分析、工作线判断和数字员工委派',
    skills: ['task-analysis', 'skill-check', 'worker-dispatch'],
    model: 'MiniMax',
    children: ['KE-01', 'query-worker'],
  },
  {
    id: 'KE-01',
    name: '知识工程数字员工',
    role: 'worker',
    description: '文档规范化、知识提取、图谱构建、知识导出',
    skills: [
      'graphify-normalize',
      'graphify-extract',
      'graphify-build',
      'graphify-export',
      'graphify-assets',
    ],
    model: 'MiniMax',
    children: [],
  },
  {
    id: 'query-worker',
    name: '知识检索数字员工',
    role: 'worker',
    description: '从知识图谱检索信息并生成回答',
    skills: ['knowledge-retrieve', 'answer-generate'],
    model: 'MiniMax',
    children: [],
  },
];

export const SKILL_CATALOG: SkillInfo[] = [
  // Pipeline Skills (KE Worker)
  { id: 'graphify-normalize', name: '文档规范化', category: 'pipeline', agent: 'KE-01', icon: '📄', desc: '文档格式转换与标准化处理' },
  { id: 'graphify-extract', name: '知识提取', category: 'pipeline', agent: 'KE-01', icon: '🔍', desc: 'AST + 语义双通道知识抽取' },
  { id: 'graphify-build', name: '图谱构建', category: 'pipeline', agent: 'KE-01', icon: '🏗️', desc: '构建知识图谱并进行社区发现' },
  { id: 'graphify-export', name: '知识导出', category: 'pipeline', agent: 'KE-01', icon: '📤', desc: '将图谱推送到 Neo4j 图数据库' },
  { id: 'graphify-assets', name: '资产构建', category: 'pipeline', agent: 'KE-01', icon: '📦', desc: '生成记录清单、健康报告等资产' },

  // Query Skills
  { id: 'knowledge-retrieve', name: '知识检索', category: 'query', agent: 'query-worker', icon: '🔎', desc: '多通道知识检索（Neo4j + 全文 + 图谱）' },
  { id: 'answer-generate', name: '答案生成', category: 'query', agent: 'query-worker', icon: '💡', desc: '基于检索上下文生成结构化回答' },

  // System Skills (Gateway)
  { id: 'frontend-design', name: '前端设计', category: 'system', icon: '🎨', desc: '创建高质量前端界面' },
  { id: 'xlsx', name: 'Excel 处理', category: 'system', icon: '📊', desc: '读取/编辑/创建表格文件' },
  { id: 'pptx', name: 'PPT 演示', category: 'system', icon: '📑', desc: '创建/编辑演示文稿' },
  { id: 'pdf', name: 'PDF 处理', category: 'system', icon: '📕', desc: '读取/合并/拆分/OCR' },
  { id: 'docx', name: 'Word 文档', category: 'system', icon: '📝', desc: '创建/编辑 Word 文档' },
  { id: 'canvas-design', name: '视觉设计', category: 'system', icon: '🖼️', desc: '海报/艺术设计创作' },
  { id: 'algorithmic-art', name: '算法艺术', category: 'system', icon: '🎭', desc: 'p5.js 生成式算法艺术' },
  { id: 'brand-guidelines', name: '品牌规范', category: 'system', icon: '🏢', desc: '应用品牌色彩排版规范' },
  { id: 'theme-factory', name: '主题工厂', category: 'system', icon: '🎛️', desc: '为产出物应用预设或自定义主题' },
  { id: 'web-artifacts-builder', name: 'Web 构件', category: 'system', icon: '🧩', desc: '构建复杂的多组件 Web 产出物' },
  { id: 'webapp-testing', name: 'Web 测试', category: 'system', icon: '🧪', desc: '基于 Playwright 的应用测试' },
  { id: 'mcp-builder', name: 'MCP 构建', category: 'system', icon: '🔌', desc: '创建 MCP 服务器集成外部 API' },
  { id: 'claude-api', name: 'Claude API', category: 'system', icon: '🤖', desc: '使用 Anthropic SDK 构建应用' },
  { id: 'skill-creator', name: '技能创建', category: 'system', icon: '⚙️', desc: '创建/优化/测试新技能' },
  { id: 'doc-coauthoring', name: '文档协作', category: 'system', icon: '✍️', desc: '结构化文档协作写作流程' },
  { id: 'internal-comms', name: '内部通讯', category: 'system', icon: '📢', desc: '撰写内部沟通文档' },
  { id: 'slack-gif-creator', name: 'GIF 创建', category: 'system', icon: '🎬', desc: '创建 Slack 动画 GIF' },
];

export const SKILL_CATEGORIES = {
  pipeline: { label: 'Pipeline', color: 'var(--blue)', bg: 'var(--blue-bg)' },
  query: { label: 'Query', color: 'var(--green)', bg: 'var(--green-bg)' },
  system: { label: 'System', color: 'var(--purple)', bg: 'var(--purple-bg)' },
} as const;
