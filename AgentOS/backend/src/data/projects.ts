type Tone = 'mint' | 'blue' | 'amber' | 'rose';

interface ProjectMetric {
  label: string;
  value: string;
}

interface TimelineItem {
  title: string;
  content: string;
}

interface ChatMessage {
  speaker: string;
  role: 'user' | 'agent';
  content: string;
}

interface Recommendation {
  title: string;
  content: string;
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
}

export const projects: ProjectSummary[] = [
  {
    id: 'project-beijing-heating-agent-os',
    name: '北京热力集团智能体建设',
    shortName: '北京热力集团',
    description: '围绕智能体建设技术方案建立项目工作区，承接方案解析、知识构建与后续问答。',
    focus: '技术方案理解、建设边界与知识问答',
    status: '可问答',
    statusTone: 'mint',
    fileName: '北京热力集团智能体建设技术方案-260204.docx',
    fileType: 'DOCX',
    uploadedAt: '2026-02-04 09:30',
    sizeLabel: '2.6 MB',
    stats: [
      { label: '文件数量', value: '1' },
      { label: '知识状态', value: '可问答' },
      { label: '最新快照', value: '2026-04-09' },
      { label: '文件类型', value: 'DOCX' }
    ],
    alerts: [
      '当前项目知识库已就绪，可以直接发起知识问答。',
      '后续接入新资料后，需要重新触发 graphify 构建。'
    ],
    memory: [
      '项目名称：北京热力集团智能体建设',
      '当前资料：北京热力集团智能体建设技术方案-260204.docx',
      '知识库状态：可问答',
      '下一步：接入真实上传、graphify 构建与问答接口'
    ],
    chat: [
      {
        speaker: '项目负责人',
        role: 'user',
        content: '请围绕北京热力集团智能体建设方案整理知识库，并支持后续问答。'
      },
      {
        speaker: 'Project Agent',
        role: 'agent',
        content: '当前项目列表已由 Agent OS API 提供，后续会在此项目目录上接入真实上传与 graphify 解析链路。'
      }
    ],
    recommendations: [
      {
        title: '当前状态',
        content: '项目目录和基础知识状态已经就位，可以先围绕技术方案内容开展结构化阅读和问题整理。'
      },
      {
        title: '下一步动作',
        content: '补上项目上传接口，把新资料落到项目目录，再由 Runtime Gateway 触发 graphify 构建。'
      },
      {
        title: '问答方向',
        content: '优先围绕建设目标、能力边界、系统架构和实施路径设计首批问答。'
      }
    ],
    timeline: [
      {
        title: '2026-02-04 09:30 文档入库',
        content: '技术方案文档进入当前项目目录。'
      },
      {
        title: '2026-04-09 10:00 项目接入 API',
        content: '项目列表由 Agent OS API 对外提供，前端改为后端驱动。'
      },
      {
        title: '待接入 Runtime Gateway',
        content: '后续将在该项目目录上继续补 graphify 构建和知识问答链路。'
      }
    ]
  }
];
