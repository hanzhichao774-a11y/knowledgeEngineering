import { useDeferredValue, useEffect, useState, type ChangeEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  agents,
  buildIssueDistribution,
  buildOverviewMetrics,
  buildProjectAlerts,
  graphAssets,
  graphMetrics,
  graphNodes,
  type ChatMessage,
  type KnowledgeBaseSummary,
  type Metric,
  type ParticipantAgent,
  type ProjectFileSummary,
  type ProjectSummary,
  type ProjectTaskRecord,
  type Tone,
  type ViewKey,
} from './mock/workspace';

const PROJECT_STATE_STORAGE_KEY = 'agentos-project-state-v2';

type ProjectWorkspaceTab = 'chat' | 'files' | 'tasks';

interface Segment {
  label: string;
  onClick?: () => void;
  active?: boolean;
}

interface ProjectListResponse {
  projects: ProjectSummary[];
}

interface ProjectCreateResponse {
  ok: boolean;
  project?: ProjectSummary;
  error?: string;
}

interface ProjectChatResponse {
  ok: boolean;
  projectId: string;
  message: ChatMessage;
}

interface ProjectFilesResponse {
  ok: boolean;
  projectId: string;
  files: ProjectFileSummary[];
}

interface ProjectTasksResponse {
  ok: boolean;
  projectId: string;
  tasks: ProjectTaskRecord[];
}

interface ProjectKnowledgeBaseResponse {
  ok: boolean;
  projectId: string;
  knowledgeBase: KnowledgeBaseSummary;
}

interface ProjectConversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  updatedAt: string;
}

interface StoredProjectState {
  projectConversations: Record<string, ProjectConversation[]>;
  selectedConversationIds: Record<string, string>;
}

function toneClass(tone: Tone) {
  return `is-${tone}`;
}

function statusToneClass(tone: Tone) {
  return `is-${tone}`;
}

function formatMessageTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

function stripMarkdown(value: string) {
  return value
    .replace(/`{1,3}[^`]*`{1,3}/g, ' ')
    .replace(/[*_>#-]/g, ' ')
    .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function deriveConversationTitle(question: string) {
  const cleaned = stripMarkdown(question);
  if (!cleaned) return '新对话';
  return cleaned.length > 18 ? `${cleaned.slice(0, 18)}...` : cleaned;
}

function getDefaultConversationId(projectId: string) {
  return `${projectId}-conversation-default`;
}

function buildInitialConversation(project: ProjectSummary): ProjectConversation {
  const lastMessage = project.chat.at(-1);
  return {
    id: getDefaultConversationId(project.id),
    title: '当前知识库问答',
    messages: project.chat,
    updatedAt: lastMessage?.createdAt ?? project.updatedAt ?? new Date().toISOString(),
  };
}

function buildEmptyConversation(projectId: string): ProjectConversation {
  const now = new Date().toISOString();
  return {
    id: `${projectId}-conversation-${Date.now()}`,
    title: '新对话',
    messages: [],
    updatedAt: now,
  };
}

function buildConversationPreview(conversation: ProjectConversation) {
  const lastMessage = conversation.messages.at(-1);
  if (!lastMessage) return '等待输入第一个问题';
  const cleaned = stripMarkdown(lastMessage.content);
  return cleaned.length > 40 ? `${cleaned.slice(0, 40)}...` : cleaned;
}

function buildProjectConversationRoute(projectId: string, conversationId?: string | null) {
  const encodedProjectId = encodeURIComponent(projectId);
  if (!conversationId) return `/projects/${encodedProjectId}`;
  return `/projects/${encodedProjectId}/conversations/${encodeURIComponent(conversationId)}`;
}

function parseProjectRoute(pathname: string) {
  const match = pathname.match(/^\/projects\/([^/]+)(?:\/conversations\/([^/]+))?$/);
  if (!match) return null;
  return {
    projectId: decodeURIComponent(match[1]),
    conversationId: match[2] ? decodeURIComponent(match[2]) : null,
  };
}

function getViewFromPathname(pathname: string): ViewKey {
  if (pathname === '/graph') return 'graph';
  if (pathname === '/projects') return 'projects';
  if (pathname === '/agents') return 'agents';
  if (parseProjectRoute(pathname)) return 'project';
  return 'overview';
}

function isKnownPath(pathname: string) {
  return pathname === '/'
    || pathname === '/graph'
    || pathname === '/projects'
    || pathname === '/agents'
    || Boolean(parseProjectRoute(pathname));
}

function readStoredProjectState(): StoredProjectState {
  if (typeof window === 'undefined') {
    return {
      projectConversations: {},
      selectedConversationIds: {},
    };
  }

  try {
    const raw = window.localStorage.getItem(PROJECT_STATE_STORAGE_KEY);
    if (!raw) {
      return {
        projectConversations: {},
        selectedConversationIds: {},
      };
    }

    const parsed = JSON.parse(raw) as Partial<StoredProjectState>;
    return {
      projectConversations: parsed.projectConversations ?? {},
      selectedConversationIds: parsed.selectedConversationIds ?? {},
    };
  } catch {
    return {
      projectConversations: {},
      selectedConversationIds: {},
    };
  }
}

function kbStatusLabel(status: KnowledgeBaseSummary['status']) {
  if (status === 'ready') return '可问答';
  if (status === 'dirty') return '待刷新';
  if (status === 'building') return '构建中';
  if (status === 'failed') return '构建失败';
  return '待构建';
}

function kbStatusTone(status: KnowledgeBaseSummary['status']): Tone {
  if (status === 'ready') return 'mint';
  if (status === 'building') return 'blue';
  if (status === 'failed') return 'rose';
  return 'amber';
}

function buildParticipantBadge(agent: ParticipantAgent) {
  const badgeByAgentId: Record<string, string> = {
    'project-agent': 'PA',
    'knowledge-agent': 'KE',
    'analysis-agent': 'AA',
    'manager-agent': 'MA',
  };

  if (badgeByAgentId[agent.id]) {
    return badgeByAgentId[agent.id];
  }

  const parts = agent.name
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  return agent.name.slice(0, 2).toUpperCase();
}

function MetricRow({ metrics }: { metrics: Metric[] }) {
  return (
    <div className="metric-row">
      {metrics.map((metric) => (
        <article key={metric.label} className={`metric-card ${toneClass(metric.tone)}`}>
          <h3>{metric.label}</h3>
          <div className="value">{metric.value}</div>
          <div className="trend">{metric.detail}</div>
        </article>
      ))}
    </div>
  );
}

function Topbar({
  eyebrow,
  title,
  description,
  segments,
  search,
  onSearchChange,
}: {
  eyebrow: string;
  title: string;
  description: string;
  segments: Segment[];
  search: string;
  onSearchChange: (value: string) => void;
}) {
  return (
    <header className="topbar">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
        <p className="page-description">{description}</p>
      </div>

      <div className="topbar-actions">
        <div className="segmented-control">
          {segments.map((segment) => (
            <button
              key={segment.label}
              className={`segment ${segment.active ? 'active' : ''}`}
              onClick={segment.onClick}
              type="button"
            >
              {segment.label}
            </button>
          ))}
        </div>

        <label className="searchbox">
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="M13.5 12.3l4 4-1.2 1.2-4-4a6 6 0 111.2-1.2zM8.5 13a4.5 4.5 0 100-9 4.5 4.5 0 000 9z" />
          </svg>
          <input
            type="text"
            placeholder="搜索项目、知识库、问题..."
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </label>
      </div>
    </header>
  );
}

function OverviewView({
  metrics,
  hasProjects,
  openProjects,
  openGraph,
  openAgents,
  openLatestProject,
  refreshProjects,
  isLoading,
}: {
  metrics: Metric[];
  hasProjects: boolean;
  openProjects: () => void;
  openGraph: () => void;
  openAgents: () => void;
  openLatestProject: () => void;
  refreshProjects: () => void;
  isLoading: boolean;
}) {
  return (
    <div className="view">
      <MetricRow metrics={metrics} />

      <div className="overview-grid">
        <section className="surface-card">
          <div className="section-title">
            <div>
              <h3>首页（manager agent）负责什么</h3>
              <p>这里只展示全局项目态势、知识库状态和最小迁移闭环是否已经打通。</p>
            </div>
            <span className="pill is-mint">Manager 视角</span>
          </div>

          <div className="stage-flow">
            <div className="stage-step">
              <div>
                <strong>看全局项目态势</strong>
                <span className="mini-stat">项目数量、可问答数、待刷新数、构建中数</span>
              </div>
              <span className="step-index">1</span>
            </div>
            <div className="stage-step">
              <div>
                <strong>判断去哪一层处理问题</strong>
                <span className="mini-stat">上传资料去项目页，问答去群聊，构建与任务去 Runtime 状态</span>
              </div>
              <span className="step-index">2</span>
            </div>
            <div className="stage-step">
              <div>
                <strong>最小闭环已落到 AgentOS runtime</strong>
                <span className="mini-stat">项目目录、文件上传、KB 构建、任务历史、项目问答都指向本地 runtime</span>
              </div>
              <span className="step-index">3</span>
            </div>
          </div>

          <div className="quick-links">
            <button className="button" type="button" onClick={openProjects}>进入项目管理</button>
            <button className="button-secondary" type="button" onClick={openGraph}>进入数据中心</button>
            {hasProjects ? (
              <button className="button-secondary" type="button" onClick={openLatestProject}>进入当前项目页</button>
            ) : (
              <button className="button-secondary" type="button" onClick={refreshProjects}>
                {isLoading ? '同步中...' : '同步项目列表'}
              </button>
            )}
          </div>
        </section>

        <section className="surface-card">
          <div className="section-title">
            <div>
              <h3>迁移约束</h3>
              <p>AgentOS 现在只保留三层：Web、API、Runtime Gateway。</p>
            </div>
          </div>

          <div className="list-stack">
            <div className="list-item">
              <strong>Web</strong>
              <p>只负责项目工作台、群聊、资料列表、任务历史和状态展示。</p>
            </div>
            <div className="list-item">
              <strong>API</strong>
              <p>只负责编排项目、文件、任务和知识库状态接口。</p>
            </div>
            <div className="list-item">
              <strong>Runtime Gateway</strong>
              <p>只负责 graphify 资产读取、构建适配和知识问答执行。</p>
            </div>
          </div>

          <div className="quick-links">
            <button className="button-secondary" type="button" onClick={openAgents}>查看 Agent / Skill</button>
          </div>
        </section>
      </div>
    </div>
  );
}

function GraphView({
  openProjects,
  refreshProjects,
  projects,
  isLoading,
}: {
  openProjects: () => void;
  refreshProjects: () => void;
  projects: ProjectSummary[];
  isLoading: boolean;
}) {
  return (
    <div className="view">
      <MetricRow metrics={graphMetrics} />

      <div className="hero-grid">
        {graphAssets.map((asset) => (
          <section key={asset.title} className="surface-card">
            <div className="section-title">
              <div>
                <h3>{asset.title}</h3>
                <p>{asset.description}</p>
              </div>
              <span className={`pill ${toneClass(asset.tone)}`}>入口</span>
            </div>

            <div className="upload-area">
              <strong>{asset.title === '文件导入' ? '项目资料目录' : '连接器目录'}</strong>
              <p className="subtle">
                {asset.title === '文件导入'
                  ? '上传资料已经进入项目 runtime/raw，构建后会把资产写到 runtime/projects/{projectId}/graphify-out。'
                  : '当前保留系统能力展示，项目最小闭环优先覆盖文件、构建与问答。'}
              </p>
              <div className="tag-row">
                {asset.tags.map((tag) => (
                  <span key={tag} className={`tag ${toneClass(asset.tone)}`}>{tag}</span>
                ))}
              </div>
              <div className="quick-links">
                <button className="button" type="button" onClick={asset.title === '文件导入' ? openProjects : undefined}>
                  {asset.title === '文件导入' ? '查看项目' : '查看连接器'}
                </button>
                <button className="button-secondary" type="button" onClick={asset.title === '文件导入' ? refreshProjects : undefined}>
                  {asset.title === '文件导入' ? (isLoading ? '刷新中...' : `后端项目 ${projects.length} 个`) : '接口待接'}
                </button>
              </div>
            </div>
          </section>
        ))}
      </div>

      <div className="graph-layout">
        <section className="surface-card">
          <div className="section-title">
            <div>
              <h3>知识库数据目录</h3>
              <p>每个项目自己持有 raw、graphify-out 和 meta，不再挂父级目录。</p>
            </div>
          </div>

          <div className="list-stack">
            <div className="list-item"><strong>raw/</strong><p>项目上传的主资料与补充文件。</p></div>
            <div className="list-item"><strong>graphify-out/</strong><p>项目自己的 graph、records、health 和 reports 资产。</p></div>
            <div className="list-item"><strong>meta/</strong><p>项目元数据、文件清单、任务历史和知识库状态。</p></div>
          </div>
        </section>

        <section className="surface-card">
          <div className="section-title">
            <div>
              <h3>项目图谱视图</h3>
              <p>强调关系可解释、状态可跟踪、构建可重放。</p>
            </div>
            <span className="pill is-mint">图谱关系</span>
          </div>

          <div className="graph-canvas">
            {graphNodes.map((node, index) => (
              <div key={node.title} className={`graph-node ${toneClass(node.tone)} node-${index + 1}`}>
                <strong>{node.title}</strong>
                {node.desc}
              </div>
            ))}
          </div>
        </section>

        <section className="surface-card">
          <div className="section-title">
            <div>
              <h3>迁移状态</h3>
              <p>现在前端读真实项目目录，项目页读真实文件和任务流。</p>
            </div>
          </div>

          <div className="tiny-kpi">
            <div className="row"><span>后端项目</span><strong>{projects.length}</strong></div>
            <div className="row"><span>可问答</span><strong>{projects.filter((project) => project.knowledgeBase.status === 'ready').length}</strong></div>
            <div className="row"><span>待刷新</span><strong>{projects.filter((project) => project.knowledgeBase.status === 'dirty').length}</strong></div>
            <div className="row"><span>构建中</span><strong>{projects.filter((project) => project.knowledgeBase.status === 'building').length}</strong></div>
          </div>
        </section>
      </div>
    </div>
  );
}

function ProjectsView({
  metrics,
  visibleProjects,
  projectAlerts,
  issueDistribution,
  openProject,
  refreshProjects,
  isLoading,
  onCreateProject,
  isCreatingProject,
}: {
  metrics: Metric[];
  visibleProjects: ProjectSummary[];
  projectAlerts: string[];
  issueDistribution: Array<{ label: string; value: string }>;
  openProject: (projectId: string) => void;
  refreshProjects: () => void;
  isLoading: boolean;
  onCreateProject: (payload: { name: string; description: string }) => Promise<string | null>;
  isCreatingProject: boolean;
}) {
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);

  return (
    <div className="view">
      <MetricRow metrics={metrics} />

      <section className="portfolio-grid">
        <article className="project-card create-card">
          <div className="card-avatar">+</div>
          <h4>创建项目</h4>
          <p>新项目会自动创建 `raw / graphify-out / meta` 目录，并进入项目工作台。</p>
          <div className="project-create-form">
            <input
              value={projectName}
              onChange={(event) => setProjectName(event.target.value)}
              placeholder="项目名称"
            />
            <textarea
              value={projectDescription}
              onChange={(event) => setProjectDescription(event.target.value)}
              placeholder="项目说明（可选）"
              rows={3}
            />
            <div className="card-actions">
              <button
                className="button"
                type="button"
                disabled={isCreatingProject || projectName.trim().length === 0}
                onClick={async () => {
                  setCreateError(null);
                  const projectId = await onCreateProject({
                    name: projectName,
                    description: projectDescription,
                  });
                  if (!projectId) {
                    setCreateError('项目创建失败');
                    return;
                  }
                  setProjectName('');
                  setProjectDescription('');
                }}
              >
                {isCreatingProject ? '创建中...' : '创建项目'}
              </button>
              <button className="button-secondary" type="button" onClick={refreshProjects}>
                {isLoading ? '同步中...' : '刷新项目列表'}
              </button>
            </div>
            {createError && <div className="chat-error">{createError}</div>}
          </div>
        </article>

        {visibleProjects.map((project) => (
          <article key={project.id} className="project-card">
            <div className="project-header">
              <div>
                <h4>{project.name}</h4>
                <p>{project.description}</p>
              </div>
              <span className={`status-badge ${statusToneClass(project.statusTone)}`}>{project.status}</span>
            </div>

            <div className="project-kpis">
              {project.stats.map((stat) => (
                <div key={stat.label} className="project-kpi">
                  <span>{stat.label}</span>
                  <strong>{stat.value}</strong>
                </div>
              ))}
            </div>

            <div className="list-stack">
              <div className="list-item">
                <strong>项目资料</strong>
                <p>{project.fileCount > 0 ? `${project.fileCount} 个文件` : '暂无上传文件'}</p>
              </div>
              <div className="list-item">
                <strong>当前知识库</strong>
                <p>{project.knowledgeBase.label}</p>
              </div>
              <div className="list-item">
                <strong>任务历史</strong>
                <p>{project.taskCount} 条</p>
              </div>
            </div>

            <div className="card-actions">
              <button className="button" type="button" onClick={() => openProject(project.id)}>进入项目页</button>
            </div>
          </article>
        ))}
      </section>

      {visibleProjects.length === 0 && !isLoading && (
        <section className="surface-card empty-state">
          <div className="section-title">
            <div>
              <h3>当前还没有项目</h3>
              <p>创建项目后即可进入独立工作台，上传文件并触发知识库构建。</p>
            </div>
          </div>
          <div className="quick-links">
            <button className="button" type="button" onClick={refreshProjects}>刷新项目列表</button>
          </div>
        </section>
      )}

      <div className="overview-grid">
        <section className="surface-card">
          <div className="section-title">
            <div>
              <h3>待办与告警</h3>
              <p>这里展示真实项目返回的任务提醒和知识库状态。</p>
            </div>
          </div>

          <div className="audit-list">
            {projectAlerts.length > 0 ? projectAlerts.map((alert) => (
              <div key={alert} className="audit-item">
                <strong>{alert.split('：')[0]}</strong>
                <p>{alert.split('：').slice(1).join('：')}</p>
              </div>
            )) : (
              <div className="audit-item">
                <strong>暂无项目告警</strong>
                <p>项目创建后，这里会展示上传、构建和 snapshot 相关提醒。</p>
              </div>
            )}
          </div>
        </section>

        <section className="surface-card">
          <div className="section-title">
            <div>
              <h3>文件分布</h3>
              <p>帮助 Manager Agent 了解当前项目目录里的资料类型结构。</p>
            </div>
          </div>

          <div className="tiny-kpi">
            {issueDistribution.map((item) => (
              <div key={item.label} className="row">
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function AgentsView() {
  return (
    <div className="view">
      <section className="agent-grid">
        <article className="agent-card create-card">
          <div className="card-avatar">+</div>
          <h4>新增能力包</h4>
          <p>后续接新的专业 Agent 或企业工具技能，继续行业化复制。</p>
          <div className="card-actions">
            <button className="button-secondary" type="button">创建 Agent</button>
          </div>
        </article>

        {agents.map((agent) => (
          <article key={agent.title} className="agent-card">
            <div className="card-avatar">{agent.icon}</div>
            <div>
              <h4>{agent.title}</h4>
              <p>{agent.description}</p>
            </div>
            <div className="tag-row">
              {agent.tags.map((tag) => (
                <span key={tag} className={`tag ${toneClass(agent.tone)}`}>{tag}</span>
              ))}
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}

function MessageMeta({ message }: { message: ChatMessage }) {
  if (!message.meta) return null;

  return (
    <div className="message-meta">
      {message.meta.snapshotId && <span className="meta-pill">Snapshot {message.meta.snapshotId}</span>}
      {message.meta.freshness?.status && <span className="meta-pill">Freshness {message.meta.freshness.status}</span>}
      {typeof message.meta.recordCount === 'number' && <span className="meta-pill">记录 {message.meta.recordCount}</span>}
      {typeof message.meta.nodeCount === 'number' && <span className="meta-pill">节点 {message.meta.nodeCount}</span>}
      {typeof message.meta.sourceCount === 'number' && <span className="meta-pill">来源 {message.meta.sourceCount}</span>}
    </div>
  );
}

function ChatBubble({ message }: { message: ChatMessage }) {
  return (
    <div className={`chat-bubble ${message.role}`}>
      <div className="chat-bubble-header">
        <span className="speaker">{message.speaker}</span>
        <span className="message-time">{formatMessageTime(message.createdAt)}</span>
      </div>

      {message.format === 'markdown' ? (
        <div className="markdown-body">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
        </div>
      ) : (
        <p>{message.content}</p>
      )}

      <MessageMeta message={message} />
    </div>
  );
}

function ParticipantCard({
  agent,
  expanded,
  onToggle,
}: {
  agent: ParticipantAgent;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <article className={`participant-card ${expanded ? 'expanded' : 'collapsed'}`}>
      <button
        className="participant-toggle"
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
      >
        <span className="participant-name">{agent.name}</span>
        <span className="participant-chevron">{expanded ? '−' : '+'}</span>
      </button>

      {expanded && (
        <div className="participant-panel">
          <div className="participant-card-header">
            <div className="participant-identity">
              <div className={`participant-avatar ${toneClass(agent.statusTone)}`}>
                {buildParticipantBadge(agent)}
              </div>

              <div className="participant-copy">
                <p className="participant-role-label">当前职责</p>
                <h4>{agent.role}</h4>
              </div>
            </div>

            <span className={`status-badge ${statusToneClass(agent.statusTone)}`}>{agent.status}</span>
          </div>

          <p className="participant-description">{agent.description}</p>

          <div className="participant-tag-row">
            {agent.capabilities.map((capability) => (
              <span key={capability} className={`tag ${toneClass(agent.statusTone)}`}>{capability}</span>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}

function ProjectStatusBanner({ knowledgeBase }: { knowledgeBase: KnowledgeBaseSummary }) {
  return (
    <div className={`workspace-banner ${toneClass(kbStatusTone(knowledgeBase.status))}`}>
      <strong>{kbStatusLabel(knowledgeBase.status)}</strong>
      <span>
        Snapshot {knowledgeBase.snapshotId ?? 'missing'} · Freshness {knowledgeBase.freshness.status}
      </span>
      {knowledgeBase.status === 'dirty' && knowledgeBase.dirtyReason && (
        <p>{knowledgeBase.dirtyReason}</p>
      )}
      {knowledgeBase.status === 'failed' && knowledgeBase.lastError && (
        <p>{knowledgeBase.lastError}</p>
      )}
    </div>
  );
}

function ProjectFilesWorkspace({
  project,
  files,
  knowledgeBase,
  isLoadingRuntime,
  isUploading,
  isBuilding,
  runtimeError,
  onUploadFiles,
  onBuildKnowledgeBase,
  onRefreshRuntime,
}: {
  project: ProjectSummary;
  files: ProjectFileSummary[];
  knowledgeBase: KnowledgeBaseSummary;
  isLoadingRuntime: boolean;
  isUploading: boolean;
  isBuilding: boolean;
  runtimeError: string | null;
  onUploadFiles: (event: ChangeEvent<HTMLInputElement>) => void;
  onBuildKnowledgeBase: () => void;
  onRefreshRuntime: () => void;
}) {
  return (
    <div className="project-workbench">
      <section className="surface-card conversation-sidebar">
        <div className="conversation-sidebar-header">
          <div>
            <h3>项目资料</h3>
            <p>{project.name}</p>
          </div>
          <button className="button-secondary" type="button" onClick={onRefreshRuntime}>
            {isLoadingRuntime ? '刷新中...' : '刷新'}
          </button>
        </div>

        <div className="conversation-list">
          {files.length > 0 ? files.map((file) => (
            <div key={file.id} className="conversation-item static-item">
              <div className="conversation-item-header">
                <strong>{file.name}</strong>
                <span>{file.sizeLabel}</span>
              </div>
              <p>{formatDateTime(file.uploadedAt)} · {file.extension.toUpperCase()}</p>
            </div>
          )) : (
            <div className="conversation-empty">
              <strong>暂无项目资料</strong>
              <p>上传项目主文档、日志或表格后，知识库状态会自动标记为待构建或待刷新。</p>
            </div>
          )}
        </div>
      </section>

      <section className="surface-card conversation-panel">
        <div className="conversation-panel-header">
          <div>
            <h3>资料上传与知识库构建</h3>
            <p>文件直接写入项目 runtime/raw，build 成功后更新项目自己的 graphify-out。</p>
          </div>
          <div className="conversation-panel-meta">
            <span className={`pill ${toneClass(kbStatusTone(knowledgeBase.status))}`}>{kbStatusLabel(knowledgeBase.status)}</span>
            <span className="pill">{knowledgeBase.freshness.status}</span>
          </div>
        </div>

        <ProjectStatusBanner knowledgeBase={knowledgeBase} />

        <div className="workspace-toolbar">
          <label className="button-secondary file-upload-button">
            {isUploading ? '上传中...' : '上传文件'}
            <input type="file" multiple onChange={onUploadFiles} disabled={isUploading} />
          </label>
          <button
            className="button"
            type="button"
            disabled={isBuilding || !knowledgeBase.buildAvailable}
            onClick={onBuildKnowledgeBase}
          >
            {isBuilding || knowledgeBase.status === 'building' ? '构建中...' : '构建知识库'}
          </button>
          <button className="button-secondary" type="button" onClick={onRefreshRuntime}>
            刷新状态
          </button>
        </div>

        {!knowledgeBase.buildAvailable && (
          <div className="chat-error">
            当前未配置 graphify build adapter。你仍然可以读取已有 snapshot，但无法从这里触发新 build。
          </div>
        )}

        {runtimeError && <div className="chat-error">{runtimeError}</div>}

        <div className="workspace-grid">
          <section className="surface-card nested-surface">
            <div className="section-title">
              <div>
                <h3>知识库状态</h3>
                <p>项目级 snapshot、freshness 和构建状态都从后端返回。</p>
              </div>
            </div>

            <div className="tiny-kpi">
              <div className="row"><span>知识状态</span><strong>{kbStatusLabel(knowledgeBase.status)}</strong></div>
              <div className="row"><span>Snapshot</span><strong>{knowledgeBase.snapshotId ?? '--'}</strong></div>
              <div className="row"><span>节点 / 记录</span><strong>{knowledgeBase.nodeCount} / {knowledgeBase.recordCount}</strong></div>
              <div className="row"><span>上次构建</span><strong>{knowledgeBase.lastBuildAt ? formatDateTime(knowledgeBase.lastBuildAt) : '--'}</strong></div>
            </div>
          </section>

          <section className="surface-card nested-surface">
            <div className="section-title">
              <div>
                <h3>迁移约束</h3>
                <p>上传只改 dirty，只有 build 成功才切换 ready。</p>
              </div>
            </div>

            <div className="list-stack">
              <div className="list-item"><strong>上传文件</strong><p>直接写入 <code>runtime/projects/&lt;projectId&gt;/raw</code>。</p></div>
              <div className="list-item"><strong>知识状态</strong><p>`empty / dirty / building / ready / failed` 全部从 API 返回。</p></div>
              <div className="list-item"><strong>问答策略</strong><p>dirty 状态仍可使用上一版 snapshot 问答，但会提示待刷新。</p></div>
            </div>
          </section>
        </div>
      </section>

      <aside className="surface-card participant-rail">
        <div className="participant-rail-header">
          <div>
            <h3>参与 Agent</h3>
            <p>资料上传和 build 仍由 Runtime Gateway 接管。</p>
          </div>
          <span className="pill is-blue">{project.participantAgents.length} 个</span>
        </div>

        <div className="participant-grid">
          {project.participantAgents.map((agent) => (
            <ParticipantCard
              key={agent.id}
              agent={agent}
              expanded={agent.id === 'knowledge-agent'}
              onToggle={() => undefined}
            />
          ))}
        </div>
      </aside>
    </div>
  );
}

function ProjectTasksWorkspace({
  project,
  tasks,
  knowledgeBase,
  isLoadingRuntime,
  runtimeError,
  onRefreshRuntime,
}: {
  project: ProjectSummary;
  tasks: ProjectTaskRecord[];
  knowledgeBase: KnowledgeBaseSummary;
  isLoadingRuntime: boolean;
  runtimeError: string | null;
  onRefreshRuntime: () => void;
}) {
  return (
    <div className="project-workbench">
      <section className="surface-card conversation-sidebar">
        <div className="conversation-sidebar-header">
          <div>
            <h3>任务历史</h3>
            <p>{project.name}</p>
          </div>
          <button className="button-secondary" type="button" onClick={onRefreshRuntime}>
            {isLoadingRuntime ? '刷新中...' : '刷新'}
          </button>
        </div>

        <div className="conversation-sidebar-footer">
          <div className="sidebar-kb-row">
            <span>知识状态</span>
            <strong>{kbStatusLabel(knowledgeBase.status)}</strong>
          </div>
          <div className="sidebar-kb-row">
            <span>任务数量</span>
            <strong>{tasks.length}</strong>
          </div>
          <div className="sidebar-kb-row">
            <span>最近构建</span>
            <strong>{knowledgeBase.lastBuildAt ? formatMessageTime(knowledgeBase.lastBuildAt) : '--'}</strong>
          </div>
        </div>
      </section>

      <section className="surface-card conversation-panel">
        <div className="conversation-panel-header">
          <div>
            <h3>后端任务流</h3>
            <p>项目创建、文件上传、知识库构建和迁移都写入项目自己的任务历史。</p>
          </div>
          <div className="conversation-panel-meta">
            <span className={`pill ${toneClass(kbStatusTone(knowledgeBase.status))}`}>{kbStatusLabel(knowledgeBase.status)}</span>
            <span className="pill">{tasks.length} 条</span>
          </div>
        </div>

        <ProjectStatusBanner knowledgeBase={knowledgeBase} />

        {runtimeError && <div className="chat-error">{runtimeError}</div>}

        <div className="task-list">
          {tasks.length > 0 ? tasks.map((task) => (
            <article key={task.id} className="task-card">
              <div className="task-card-header">
                <div>
                  <strong>{task.title}</strong>
                  <p>{task.type}</p>
                </div>
                <span className={`status-badge ${statusToneClass(task.status === 'failed' ? 'rose' : task.status === 'running' ? 'blue' : 'mint')}`}>
                  {task.status}
                </span>
              </div>
              <p>{task.message}</p>
              <div className="message-meta">
                <span className="meta-pill">创建 {formatDateTime(task.createdAt)}</span>
                <span className="meta-pill">更新 {formatDateTime(task.updatedAt)}</span>
              </div>
            </article>
          )) : (
            <div className="conversation-empty">
              <strong>暂无任务历史</strong>
              <p>项目创建后，文件上传和知识库构建会自动在这里留下记录。</p>
            </div>
          )}
        </div>
      </section>

      <aside className="surface-card participant-rail">
        <div className="participant-rail-header">
          <div>
            <h3>任务说明</h3>
            <p>任务历史来自 API，不再是静态项目摘要。</p>
          </div>
          <span className="pill is-blue">{tasks.length} 条</span>
        </div>

        <div className="list-stack">
          <div className="list-item"><strong>project.created</strong><p>项目目录初始化完成。</p></div>
          <div className="list-item"><strong>file.uploaded</strong><p>项目资料已写入 raw 目录，并把知识库状态改成 dirty 或 empty。</p></div>
          <div className="list-item"><strong>kb.build</strong><p>Runtime Gateway 正在执行 graphify build 并回写状态。</p></div>
          <div className="list-item"><strong>kb.migrated</strong><p>历史 snapshot 已从 legacy 工作区迁入本地 runtime。</p></div>
        </div>
      </aside>
    </div>
  );
}

function ProjectChatWorkspace({
  project,
  conversations,
  selectedConversationId,
  draft,
  onDraftChange,
  onSend,
  onSelectConversation,
  onCreateConversation,
  isSending,
  chatError,
  knowledgeBase,
}: {
  project: ProjectSummary;
  conversations: ProjectConversation[];
  selectedConversationId: string | null;
  draft: string;
  onDraftChange: (value: string) => void;
  onSend: (question?: string) => void;
  onSelectConversation: (conversationId: string) => void;
  onCreateConversation: () => void;
  isSending: boolean;
  chatError: string | null;
  knowledgeBase: KnowledgeBaseSummary;
}) {
  const selectedConversation = conversations.find((conversation) => conversation.id === selectedConversationId)
    ?? conversations[0]
    ?? null;
  const [expandedParticipantId, setExpandedParticipantId] = useState<string | null>(project.participantAgents[0]?.id ?? null);

  return (
    <div className="project-workbench">
      <section className="surface-card conversation-sidebar">
        <div className="conversation-sidebar-header">
          <div>
            <h3>历史对话</h3>
            <p>{project.name}</p>
          </div>
          <button className="button-secondary" type="button" onClick={onCreateConversation}>
            新对话
          </button>
        </div>

        <div className="conversation-list">
          {conversations.map((conversation) => (
            <button
              key={conversation.id}
              className={`conversation-item ${conversation.id === selectedConversation?.id ? 'active' : ''}`}
              type="button"
              onClick={() => onSelectConversation(conversation.id)}
            >
              <div className="conversation-item-header">
                <strong>{conversation.title}</strong>
                <span>{formatMessageTime(conversation.updatedAt)}</span>
              </div>
              <p>{buildConversationPreview(conversation)}</p>
            </button>
          ))}
        </div>

        <div className="conversation-sidebar-footer">
          <div className="sidebar-kb-row">
            <span>知识库</span>
            <strong>{knowledgeBase.label}</strong>
          </div>
          <div className="sidebar-kb-row">
            <span>知识状态</span>
            <strong>{kbStatusLabel(knowledgeBase.status)}</strong>
          </div>
          <div className="sidebar-kb-row">
            <span>Snapshot</span>
            <strong>{knowledgeBase.snapshotId ?? '--'}</strong>
          </div>
          <div className="sidebar-kb-row">
            <span>节点 / 记录</span>
            <strong>{knowledgeBase.nodeCount} / {knowledgeBase.recordCount}</strong>
          </div>
        </div>
      </section>

      <section className="surface-card conversation-panel">
        <div className="conversation-panel-header">
          <div>
            <h3>{selectedConversation?.title ?? '新对话'}</h3>
            <p>围绕项目自己的知识库提问，回答会保留 Markdown 结构和来源信息。</p>
          </div>
          <div className="conversation-panel-meta">
            <span className={`pill ${toneClass(kbStatusTone(knowledgeBase.status))}`}>{kbStatusLabel(knowledgeBase.status)}</span>
            <span className="pill">{knowledgeBase.freshness.status}</span>
          </div>
        </div>

        <ProjectStatusBanner knowledgeBase={knowledgeBase} />

        <div className="suggestion-row">
          {project.suggestedQuestions.map((question) => (
            <button
              key={question}
              className="suggestion-chip"
              type="button"
              disabled={isSending}
              onClick={() => onSend(question)}
            >
              {question}
            </button>
          ))}
        </div>

        <div className="chat-thread">
          {selectedConversation && selectedConversation.messages.length > 0 ? (
            selectedConversation.messages.map((message) => (
              <ChatBubble key={message.id} message={message} />
            ))
          ) : (
            <div className="conversation-empty">
              <strong>新对话已创建</strong>
              <p>从左侧选一个历史对话，或者直接在下方输入问题开始新的会话。</p>
            </div>
          )}
        </div>

        <div className="chat-composer">
          <label className="chat-input-shell">
            <textarea
              value={draft}
              onChange={(event) => onDraftChange(event.target.value)}
              placeholder={`围绕“${knowledgeBase.label}”提问，例如：${project.suggestedQuestions[0] ?? '输入你的问题'}`}
              rows={4}
              disabled={isSending || knowledgeBase.snapshotId === null}
            />
          </label>

          <div className="composer-actions">
            <span className="subtle">当前会话：{selectedConversation?.title ?? '新对话'}</span>
            <button
              className="button"
              type="button"
              onClick={() => onSend()}
              disabled={isSending || draft.trim().length === 0 || knowledgeBase.snapshotId === null}
            >
              {isSending ? '回答中...' : '发送问题'}
            </button>
          </div>

          {chatError && <div className="chat-error">{chatError}</div>}
        </div>
      </section>

      <aside className="surface-card participant-rail">
        <div className="participant-rail-header">
          <div>
            <h3>参与 Agent</h3>
            <p>当前对话中已加入或可被唤醒的 Agent 列表。</p>
          </div>
          <span className="pill is-blue">{project.participantAgents.length} 个</span>
        </div>

        <div className="participant-grid">
          {project.participantAgents.map((agent) => (
            <ParticipantCard
              key={agent.id}
              agent={agent}
              expanded={expandedParticipantId === agent.id}
              onToggle={() => setExpandedParticipantId((current) => current === agent.id ? null : agent.id)}
            />
          ))}
        </div>
      </aside>
    </div>
  );
}

function ProjectView({
  project,
  panel,
  conversations,
  selectedConversationId,
  draft,
  onDraftChange,
  onSend,
  onSelectConversation,
  onCreateConversation,
  isSending,
  chatError,
  files,
  tasks,
  knowledgeBase,
  isLoadingRuntime,
  isUploading,
  isBuilding,
  runtimeError,
  onUploadFiles,
  onBuildKnowledgeBase,
  onRefreshRuntime,
}: {
  project: ProjectSummary;
  panel: ProjectWorkspaceTab;
  conversations: ProjectConversation[];
  selectedConversationId: string | null;
  draft: string;
  onDraftChange: (value: string) => void;
  onSend: (question?: string) => void;
  onSelectConversation: (conversationId: string) => void;
  onCreateConversation: () => void;
  isSending: boolean;
  chatError: string | null;
  files: ProjectFileSummary[];
  tasks: ProjectTaskRecord[];
  knowledgeBase: KnowledgeBaseSummary;
  isLoadingRuntime: boolean;
  isUploading: boolean;
  isBuilding: boolean;
  runtimeError: string | null;
  onUploadFiles: (event: ChangeEvent<HTMLInputElement>) => void;
  onBuildKnowledgeBase: () => void;
  onRefreshRuntime: () => void;
}) {
  if (panel === 'files') {
    return (
      <ProjectFilesWorkspace
        project={project}
        files={files}
        knowledgeBase={knowledgeBase}
        isLoadingRuntime={isLoadingRuntime}
        isUploading={isUploading}
        isBuilding={isBuilding}
        runtimeError={runtimeError}
        onUploadFiles={onUploadFiles}
        onBuildKnowledgeBase={onBuildKnowledgeBase}
        onRefreshRuntime={onRefreshRuntime}
      />
    );
  }

  if (panel === 'tasks') {
    return (
      <ProjectTasksWorkspace
        project={project}
        tasks={tasks}
        knowledgeBase={knowledgeBase}
        isLoadingRuntime={isLoadingRuntime}
        runtimeError={runtimeError}
        onRefreshRuntime={onRefreshRuntime}
      />
    );
  }

  return (
    <ProjectChatWorkspace
      project={project}
      conversations={conversations}
      selectedConversationId={selectedConversationId}
      draft={draft}
      onDraftChange={onDraftChange}
      onSend={onSend}
      onSelectConversation={onSelectConversation}
      onCreateConversation={onCreateConversation}
      isSending={isSending}
      chatError={chatError}
      knowledgeBase={knowledgeBase}
    />
  );
}

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const routeState = parseProjectRoute(location.pathname);
  const activeView = getViewFromPathname(location.pathname);
  const storedState = readStoredProjectState();

  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [searchText, setSearchText] = useState('');
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [projectConversations, setProjectConversations] = useState<Record<string, ProjectConversation[]>>(storedState.projectConversations);
  const [selectedConversationIds, setSelectedConversationIds] = useState<Record<string, string>>(storedState.selectedConversationIds);
  const [chatDrafts, setChatDrafts] = useState<Record<string, string>>({});
  const [chatErrors, setChatErrors] = useState<Record<string, string | null>>({});
  const [sendingConversationKey, setSendingConversationKey] = useState<string | null>(null);
  const [projectPanels, setProjectPanels] = useState<Record<string, ProjectWorkspaceTab>>({});
  const [projectFiles, setProjectFiles] = useState<Record<string, ProjectFileSummary[]>>({});
  const [projectTasks, setProjectTasks] = useState<Record<string, ProjectTaskRecord[]>>({});
  const [projectKnowledgeBases, setProjectKnowledgeBases] = useState<Record<string, KnowledgeBaseSummary>>({});
  const [runtimeLoadingByProject, setRuntimeLoadingByProject] = useState<Record<string, boolean>>({});
  const [runtimeErrorByProject, setRuntimeErrorByProject] = useState<Record<string, string | null>>({});
  const [uploadingByProject, setUploadingByProject] = useState<Record<string, boolean>>({});
  const [buildingByProject, setBuildingByProject] = useState<Record<string, boolean>>({});
  const deferredSearchText = useDeferredValue(searchText.trim().toLowerCase());

  async function refreshProjects() {
    setIsLoadingProjects(true);
    setProjectsError(null);

    try {
      const response = await fetch('/api/projects');
      if (!response.ok) {
        throw new Error(`项目接口返回 ${response.status}`);
      }

      const data = (await response.json()) as ProjectListResponse;
      setProjects(data.projects);
    } catch (error) {
      setProjectsError(error instanceof Error ? error.message : '项目列表加载失败');
    } finally {
      setIsLoadingProjects(false);
    }
  }

  async function refreshProjectRuntime(projectId: string) {
    setRuntimeLoadingByProject((current) => ({ ...current, [projectId]: true }));
    setRuntimeErrorByProject((current) => ({ ...current, [projectId]: null }));

    try {
      const [filesResponse, tasksResponse, knowledgeBaseResponse] = await Promise.all([
        fetch(`/api/projects/${projectId}/files`),
        fetch(`/api/projects/${projectId}/tasks`),
        fetch(`/api/projects/${projectId}/kb/status`),
      ]);

      if (!filesResponse.ok || !tasksResponse.ok || !knowledgeBaseResponse.ok) {
        throw new Error('项目 runtime 状态加载失败');
      }

      const filesPayload = (await filesResponse.json()) as ProjectFilesResponse;
      const tasksPayload = (await tasksResponse.json()) as ProjectTasksResponse;
      const kbPayload = (await knowledgeBaseResponse.json()) as ProjectKnowledgeBaseResponse;

      setProjectFiles((current) => ({ ...current, [projectId]: filesPayload.files }));
      setProjectTasks((current) => ({ ...current, [projectId]: tasksPayload.tasks }));
      setProjectKnowledgeBases((current) => ({ ...current, [projectId]: kbPayload.knowledgeBase }));
    } catch (error) {
      setRuntimeErrorByProject((current) => ({
        ...current,
        [projectId]: error instanceof Error ? error.message : '项目 runtime 状态加载失败',
      }));
    } finally {
      setRuntimeLoadingByProject((current) => ({ ...current, [projectId]: false }));
    }
  }

  useEffect(() => {
    if (!isKnownPath(location.pathname)) {
      navigate('/', { replace: true });
    }
  }, [location.pathname, navigate]);

  useEffect(() => {
    void refreshProjects();
  }, []);

  useEffect(() => {
    setProjectConversations((current) => {
      const next = { ...current };
      for (const project of projects) {
        if (!next[project.id] || next[project.id].length === 0) {
          next[project.id] = [buildInitialConversation(project)];
        }
      }
      return next;
    });

    setSelectedConversationIds((current) => {
      const next = { ...current };
      for (const project of projects) {
        if (!next[project.id]) {
          next[project.id] = getDefaultConversationId(project.id);
        }
      }
      return next;
    });

    setProjectKnowledgeBases((current) => {
      const next = { ...current };
      for (const project of projects) {
        if (!next[project.id]) {
          next[project.id] = project.knowledgeBase;
        }
      }
      return next;
    });
  }, [projects]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        PROJECT_STATE_STORAGE_KEY,
        JSON.stringify({
          projectConversations,
          selectedConversationIds,
        } satisfies StoredProjectState),
      );
    } catch {
      // ignore local persistence failures
    }
  }, [projectConversations, selectedConversationIds]);

  const overviewMetrics = buildOverviewMetrics(projects);
  const projectAlerts = buildProjectAlerts(projects);
  const issueDistribution = buildIssueDistribution(projects);

  const selectedProject = routeState
    ? projects.find((project) => project.id === routeState.projectId) ?? null
    : null;

  useEffect(() => {
    if (!selectedProject) return;
    void refreshProjectRuntime(selectedProject.id);
  }, [selectedProject?.id]);

  const knowledgeBase = selectedProject
    ? projectKnowledgeBases[selectedProject.id] ?? selectedProject.knowledgeBase
    : null;

  useEffect(() => {
    if (!selectedProject || !knowledgeBase || knowledgeBase.status !== 'building') return;
    const timer = window.setTimeout(() => {
      void Promise.all([
        refreshProjects(),
        refreshProjectRuntime(selectedProject.id),
      ]);
    }, 2000);
    return () => window.clearTimeout(timer);
  }, [knowledgeBase?.status, selectedProject?.id]);

  const selectedConversations = selectedProject
    ? (projectConversations[selectedProject.id] ?? [buildInitialConversation(selectedProject)])
    : [];
  const effectiveConversationId = selectedProject
    ? (
      routeState?.conversationId && selectedConversations.some((conversation) => conversation.id === routeState.conversationId)
        ? routeState.conversationId
        : selectedConversationIds[selectedProject.id] ?? selectedConversations[0]?.id ?? null
    )
    : null;

  useEffect(() => {
    if (activeView !== 'project' || isLoadingProjects) return;

    if (routeState && !selectedProject) {
      navigate('/projects', { replace: true });
      return;
    }

    if (selectedProject && effectiveConversationId && routeState?.conversationId !== effectiveConversationId) {
      navigate(buildProjectConversationRoute(selectedProject.id, effectiveConversationId), { replace: true });
    }
  }, [
    activeView,
    effectiveConversationId,
    isLoadingProjects,
    navigate,
    routeState,
    selectedProject,
  ]);

  const visibleProjects = deferredSearchText
    ? projects.filter((project) => {
      const candidate = [
        project.name,
        project.focus,
        project.description,
        project.fileName,
        project.knowledgeBase.label,
        project.status,
        ...project.suggestedQuestions,
      ].join(' ').toLowerCase();
      return candidate.includes(deferredSearchText);
    })
    : projects;

  const navigateToProject = (projectId: string) => {
    const storedConversationId = selectedConversationIds[projectId];
    const conversations = projectConversations[projectId];
    const fallbackConversationId = storedConversationId ?? conversations?.[0]?.id ?? getDefaultConversationId(projectId);
    navigate(buildProjectConversationRoute(projectId, fallbackConversationId));
  };

  const updateDraft = (projectId: string, conversationId: string | null, value: string) => {
    if (!conversationId) return;
    setChatDrafts((current) => ({
      ...current,
      [`${projectId}:${conversationId}`]: value,
    }));
  };

  const createConversation = (projectId: string) => {
    const nextConversation = buildEmptyConversation(projectId);
    setProjectConversations((current) => ({
      ...current,
      [projectId]: [nextConversation, ...(current[projectId] ?? [])],
    }));
    setSelectedConversationIds((current) => ({
      ...current,
      [projectId]: nextConversation.id,
    }));
    navigate(buildProjectConversationRoute(projectId, nextConversation.id));
  };

  const selectConversation = (projectId: string, conversationId: string) => {
    setSelectedConversationIds((current) => ({
      ...current,
      [projectId]: conversationId,
    }));
    navigate(buildProjectConversationRoute(projectId, conversationId));
  };

  const updateConversation = (
    projectId: string,
    conversationId: string,
    updater: (conversation: ProjectConversation) => ProjectConversation,
  ) => {
    setProjectConversations((current) => ({
      ...current,
      [projectId]: (current[projectId] ?? []).map((conversation) =>
        conversation.id === conversationId ? updater(conversation) : conversation,
      ),
    }));
  };

  const createProject = async (payload: { name: string; description: string }) => {
    setIsCreatingProject(true);
    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as ProjectCreateResponse;
      if (!response.ok || !data.project) {
        throw new Error(data.error ?? `项目接口返回 ${response.status}`);
      }

      setProjects((current) => [data.project!, ...current.filter((project) => project.id !== data.project!.id)]);
      navigateToProject(data.project.id);
      return data.project.id;
    } catch (error) {
      setProjectsError(error instanceof Error ? error.message : '项目创建失败');
      return null;
    } finally {
      setIsCreatingProject(false);
    }
  };

  const sendQuestion = async (project: ProjectSummary, quickQuestion?: string) => {
    const currentKnowledgeBase = projectKnowledgeBases[project.id] ?? project.knowledgeBase;
    const conversationId = effectiveConversationId ?? getDefaultConversationId(project.id);
    const draftKey = `${project.id}:${conversationId}`;
    const question = (quickQuestion ?? chatDrafts[draftKey] ?? '').trim();
    if (!question || sendingConversationKey === draftKey || currentKnowledgeBase.snapshotId === null) return;

    const now = new Date().toISOString();
    const userMessage: ChatMessage = {
      id: `${project.id}-user-${Date.now()}`,
      speaker: '你',
      role: 'user',
      content: question,
      format: 'plain',
      createdAt: now,
    };

    updateConversation(project.id, conversationId, (conversation) => ({
      ...conversation,
      title: conversation.messages.length === 0 ? deriveConversationTitle(question) : conversation.title,
      messages: [...conversation.messages, userMessage],
      updatedAt: now,
    }));
    setSelectedConversationIds((current) => ({
      ...current,
      [project.id]: conversationId,
    }));
    setChatErrors((current) => ({ ...current, [draftKey]: null }));
    setChatDrafts((current) => ({ ...current, [draftKey]: '' }));
    setSendingConversationKey(draftKey);

    try {
      const response = await fetch(`/api/projects/${project.id}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ question }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(payload?.error ?? `问答接口返回 ${response.status}`);
      }

      const payload = (await response.json()) as ProjectChatResponse;
      updateConversation(project.id, conversationId, (conversation) => ({
        ...conversation,
        messages: [...conversation.messages, payload.message],
        updatedAt: payload.message.createdAt,
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : '问答失败';
      const errorMessage: ChatMessage = {
        id: `${project.id}-agent-error-${Date.now()}`,
        speaker: 'Project Agent',
        role: 'agent',
        content: `### 请求失败\n\n${message}`,
        format: 'markdown',
        createdAt: new Date().toISOString(),
      };

      updateConversation(project.id, conversationId, (conversation) => ({
        ...conversation,
        messages: [...conversation.messages, errorMessage],
        updatedAt: errorMessage.createdAt,
      }));
      setChatErrors((current) => ({ ...current, [draftKey]: message }));
    } finally {
      setSendingConversationKey(null);
    }
  };

  const uploadFiles = async (projectId: string, event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploadingByProject((current) => ({ ...current, [projectId]: true }));
    setRuntimeErrorByProject((current) => ({ ...current, [projectId]: null }));

    try {
      const formData = new FormData();
      Array.from(files).forEach((file) => formData.append('files', file));

      const response = await fetch(`/api/projects/${projectId}/files`, {
        method: 'POST',
        body: formData,
      });
      const payload = await response.json().catch(() => null) as { error?: string; project?: ProjectSummary } | null;
      if (!response.ok) {
        throw new Error(payload?.error ?? `上传接口返回 ${response.status}`);
      }

      if (payload?.project) {
        setProjects((current) => current.map((project) => project.id === projectId ? payload.project! : project));
      } else {
        await refreshProjects();
      }

      await refreshProjectRuntime(projectId);
    } catch (error) {
      setRuntimeErrorByProject((current) => ({
        ...current,
        [projectId]: error instanceof Error ? error.message : '文件上传失败',
      }));
    } finally {
      setUploadingByProject((current) => ({ ...current, [projectId]: false }));
      event.target.value = '';
    }
  };

  const buildKnowledgeBase = async (projectId: string) => {
    setBuildingByProject((current) => ({ ...current, [projectId]: true }));
    setRuntimeErrorByProject((current) => ({ ...current, [projectId]: null }));

    try {
      const response = await fetch(`/api/projects/${projectId}/kb/build`, {
        method: 'POST',
      });
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error ?? `构建接口返回 ${response.status}`);
      }

      await Promise.all([
        refreshProjects(),
        refreshProjectRuntime(projectId),
      ]);
    } catch (error) {
      setRuntimeErrorByProject((current) => ({
        ...current,
        [projectId]: error instanceof Error ? error.message : '知识库构建失败',
      }));
    } finally {
      setBuildingByProject((current) => ({ ...current, [projectId]: false }));
    }
  };

  const selectedProjectPanel = selectedProject
    ? (projectPanels[selectedProject.id] ?? 'chat')
    : 'chat';

  const segmentsByView: Record<ViewKey, Segment[]> = {
    overview: [
      { label: '总览', active: true },
      { label: '项目', onClick: () => navigate('/projects') },
      { label: '能力', onClick: () => navigate('/agents') },
    ],
    graph: [
      { label: '数据源', active: true },
      { label: '知识库' },
      { label: '图谱关系' },
    ],
    projects: [
      { label: '项目目录', active: true },
      { label: '知识状态' },
      { label: '文件分布' },
    ],
    agents: [
      { label: '基础 Agent', active: true },
      { label: '项目 Agent' },
      { label: 'Skills' },
    ],
    project: [
      {
        label: '群聊',
        active: selectedProjectPanel === 'chat',
        onClick: () => selectedProject && setProjectPanels((current) => ({ ...current, [selectedProject.id]: 'chat' })),
      },
      {
        label: '项目资料',
        active: selectedProjectPanel === 'files',
        onClick: () => selectedProject && setProjectPanels((current) => ({ ...current, [selectedProject.id]: 'files' })),
      },
      {
        label: '任务历史',
        active: selectedProjectPanel === 'tasks',
        onClick: () => selectedProject && setProjectPanels((current) => ({ ...current, [selectedProject.id]: 'tasks' })),
      },
    ],
  };

  const headerByView: Record<ViewKey, { eyebrow: string; title: string; description: string }> = {
    overview: {
      eyebrow: 'Manager Agent',
      title: '首页（manager agent）',
      description: '只展示全局运行指标、系统风险和总体态势，不在这里展开具体项目操作。',
    },
    graph: {
      eyebrow: 'Knowledge Engineering Agent',
      title: '数据中心（知识工程agent）',
      description: '这是知识工程 Agent 的入口页，用来管理项目数据入口，并维护知识库数据底座。',
    },
    projects: {
      eyebrow: 'Manager Agent',
      title: '项目管理（manager agent）',
      description: '这里的项目列表和状态完全来自 Agent OS API，不再使用前端本地项目 mock。',
    },
    agents: {
      eyebrow: 'Capability Matrix',
      title: 'Agent / Skill 中心',
      description: '前端阶段先保留能力矩阵和装配关系，后续再接真实配置与技能状态。',
    },
    project: {
      eyebrow: 'Project Agent',
      title: selectedProject ? `${selectedProject.name}（project agent）` : '项目页（project agent）',
      description: selectedProject
        ? '每个项目都对应自己的 runtime 目录，群聊、项目资料和任务历史都围绕这个项目展开。'
        : '当前还没有项目，请先同步后端项目列表。',
    },
  };

  return (
    <div className={`app-frame ${activeView === 'project' ? 'is-project-mode' : ''}`}>
      <aside className="sidebar">
        <div className="window-dots" aria-hidden="true">
          <span className="dot dot-red" />
          <span className="dot dot-yellow" />
          <span className="dot dot-green" />
        </div>

        <div className="brand-block">
          <div className="brand-mark">A</div>
          <div>
            <h1>Agent OS</h1>
            <p>多智能体操作系统</p>
          </div>
        </div>

        <button className="primary-ghost" type="button" onClick={() => void refreshProjects()}>
          <span>↻</span>
          {isLoadingProjects ? '同步中...' : '同步项目'}
        </button>

        <nav className="nav-group">
          <p className="nav-caption">Workspace</p>
          <button className={`nav-item ${activeView === 'overview' ? 'active' : ''}`} type="button" onClick={() => navigate('/')}>
            首页（manager agent）
          </button>
          <button className={`nav-item ${activeView === 'graph' ? 'active' : ''}`} type="button" onClick={() => navigate('/graph')}>
            数据中心（知识工程agent）
          </button>
          <button className={`nav-item ${activeView === 'projects' ? 'active' : ''}`} type="button" onClick={() => navigate('/projects')}>
            项目管理（manager agent）
          </button>

          <div className="nav-subtree">
            {projects.length > 0 ? projects.map((project) => (
              <button
                key={project.id}
                className={`nav-subitem ${activeView === 'project' && selectedProject?.id === project.id ? 'active' : ''}`}
                type="button"
                onClick={() => navigateToProject(project.id)}
              >
                {project.name}
              </button>
            )) : (
              <div className="nav-empty">{isLoadingProjects ? '正在同步后端项目...' : '后端当前还没有项目'}</div>
            )}
            <button className="nav-subitem create" type="button" onClick={() => navigate('/projects')}>
              + 查看项目目录
            </button>
          </div>

          <button className={`nav-item ${activeView === 'agents' ? 'active' : ''}`} type="button" onClick={() => navigate('/agents')}>
            Agent / Skill
          </button>
        </nav>

        <div className="sidebar-footer">
          <div className="user-avatar">S</div>
          <div>
            <strong>samhar</strong>
            <p>产品负责人 · 迁移闭环已接入</p>
          </div>
        </div>
      </aside>

      <main className="main-shell">
        <Topbar
          eyebrow={headerByView[activeView].eyebrow}
          title={headerByView[activeView].title}
          description={headerByView[activeView].description}
          segments={segmentsByView[activeView]}
          search={searchText}
          onSearchChange={setSearchText}
        />

        <section className={`content-shell ${activeView === 'project' ? 'project-content-shell' : ''}`}>
          {isLoadingProjects && projects.length === 0 && (
            <section className="surface-card empty-state">
              <div className="section-title">
                <div>
                  <h3>正在获取项目列表</h3>
                  <p>前端正在从 Agent OS API 拉取项目数据。</p>
                </div>
              </div>
            </section>
          )}

          {projectsError && (
            <section className="surface-card empty-state">
              <div className="section-title">
                <div>
                  <h3>项目列表加载失败</h3>
                  <p>{projectsError}</p>
                </div>
              </div>
            </section>
          )}

          {!isLoadingProjects && activeView === 'overview' && (
            <OverviewView
              metrics={overviewMetrics}
              hasProjects={projects.length > 0}
              openProjects={() => navigate('/projects')}
              openGraph={() => navigate('/graph')}
              openAgents={() => navigate('/agents')}
              openLatestProject={() => projects[0] && navigateToProject(projects[0].id)}
              refreshProjects={() => void refreshProjects()}
              isLoading={isLoadingProjects}
            />
          )}

          {!isLoadingProjects && activeView === 'graph' && (
            <GraphView
              openProjects={() => navigate('/projects')}
              refreshProjects={() => void refreshProjects()}
              projects={projects}
              isLoading={isLoadingProjects}
            />
          )}

          {!isLoadingProjects && activeView === 'projects' && (
            <ProjectsView
              metrics={overviewMetrics}
              visibleProjects={visibleProjects}
              projectAlerts={projectAlerts}
              issueDistribution={issueDistribution}
              openProject={navigateToProject}
              refreshProjects={() => void refreshProjects()}
              isLoading={isLoadingProjects}
              onCreateProject={createProject}
              isCreatingProject={isCreatingProject}
            />
          )}

          {!isLoadingProjects && activeView === 'agents' && <AgentsView />}

          {!isLoadingProjects && activeView === 'project' && selectedProject && knowledgeBase && (
            <ProjectView
              project={selectedProject}
              panel={selectedProjectPanel}
              conversations={selectedConversations}
              selectedConversationId={effectiveConversationId}
              draft={chatDrafts[`${selectedProject.id}:${effectiveConversationId ?? ''}`] ?? ''}
              onDraftChange={(value) => updateDraft(selectedProject.id, effectiveConversationId, value)}
              onSend={(question) => void sendQuestion(selectedProject, question)}
              onSelectConversation={(conversationId) => selectConversation(selectedProject.id, conversationId)}
              onCreateConversation={() => createConversation(selectedProject.id)}
              isSending={sendingConversationKey === `${selectedProject.id}:${effectiveConversationId ?? ''}`}
              chatError={chatErrors[`${selectedProject.id}:${effectiveConversationId ?? ''}`] ?? null}
              files={projectFiles[selectedProject.id] ?? []}
              tasks={projectTasks[selectedProject.id] ?? []}
              knowledgeBase={knowledgeBase}
              isLoadingRuntime={runtimeLoadingByProject[selectedProject.id] ?? false}
              isUploading={uploadingByProject[selectedProject.id] ?? false}
              isBuilding={buildingByProject[selectedProject.id] ?? false}
              runtimeError={runtimeErrorByProject[selectedProject.id] ?? null}
              onUploadFiles={(event) => void uploadFiles(selectedProject.id, event)}
              onBuildKnowledgeBase={() => void buildKnowledgeBase(selectedProject.id)}
              onRefreshRuntime={() => void refreshProjectRuntime(selectedProject.id)}
            />
          )}
        </section>
      </main>
    </div>
  );
}
