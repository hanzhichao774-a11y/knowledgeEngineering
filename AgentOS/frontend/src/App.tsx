import { useDeferredValue, useEffect, useState } from 'react';
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
  type Metric,
  type ParticipantAgent,
  type ProjectSummary,
  type Tone,
  type ViewKey,
} from './mock/workspace';

interface Segment {
  label: string;
  onClick?: () => void;
  active?: boolean;
}

interface ProjectListResponse {
  projects: ProjectSummary[];
}

interface ProjectChatResponse {
  ok: boolean;
  projectId: string;
  message: ChatMessage;
}

interface ProjectConversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  updatedAt: string;
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
    updatedAt: lastMessage?.createdAt ?? project.knowledgeBase.updatedAt ?? new Date().toISOString(),
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
              <p>这里只展示全局态势、系统风险和总体判断，不在首页展开具体项目操作。</p>
            </div>
            <span className="pill is-mint">Manager 视角</span>
          </div>

          <div className="stage-flow">
            <div className="stage-step">
              <div>
                <strong>看全局项目态势</strong>
                <span className="mini-stat">项目数量、知识库状态、可问答情况、系统负载</span>
              </div>
              <span className="step-index">1</span>
            </div>
            <div className="stage-step">
              <div>
                <strong>判断去哪一层处理问题</strong>
                <span className="mini-stat">数据入口去数据中心，项目目录去项目管理，具体问答去项目页</span>
              </div>
              <span className="step-index">2</span>
            </div>
            <div className="stage-step">
              <div>
                <strong>项目页已经支持真实问答</strong>
                <span className="mini-stat">当前群聊会直接调用后端项目问答接口，并基于现成 graphify 知识库返回结果</span>
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
              <h3>栏目与 Agent 对应关系</h3>
              <p>当前项目目录由后端提供，项目页的问答则直接走现成知识库。</p>
            </div>
          </div>

          <div className="list-stack">
            <div className="list-item">
              <strong>首页（manager agent）</strong>
              <p>只看全局运行指标、风险态势和去哪一层处理问题。</p>
            </div>
            <div className="list-item">
              <strong>数据中心（知识工程 agent）</strong>
              <p>负责接入文件、查看知识目录和观察图谱构建状态。</p>
            </div>
            <div className="list-item">
              <strong>项目管理（manager agent）</strong>
              <p>展示由 Agent OS API 返回的项目目录，而不是前端静态 mock 数据。</p>
            </div>
            <div className="list-item">
              <strong>项目页（project agent）</strong>
              <p>围绕当前项目的知识库状态、群聊问答和证据追踪组织协同。</p>
            </div>
            <div className="list-item">
              <strong>Agent / Skill</strong>
              <p>说明系统能力模块如何装配，而不是绑定某个行业场景。</p>
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
              <strong>{asset.title === '文件导入' ? '项目目录' : '连接器目录'}</strong>
              <p className="subtle">
                {asset.title === '文件导入'
                  ? '当前先完成“后端提供项目 + 项目页问答”这条链路，下一步再接真实上传。'
                  : '前端阶段先保留视觉和结构，后面再接真实连接流程。'}
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
              <p>按业务语义组织，而不是按文件格式堆砌。</p>
            </div>
          </div>

          <div className="list-stack">
            <div className="list-item"><strong>业务记录</strong><p>文档、日志、对话、表格、工单和任务历史。</p></div>
            <div className="list-item"><strong>规则文档</strong><p>制度、规范、SOP、操作手册和审批规则。</p></div>
            <div className="list-item"><strong>事件与反馈</strong><p>处理记录、异常事件、质检结果、历史处置经验。</p></div>
            <div className="list-item"><strong>组织与权限关系</strong><p>负责人、执行人、审核人、权限边界和审批链路。</p></div>
          </div>
        </section>

        <section className="surface-card">
          <div className="section-title">
            <div>
              <h3>项目图谱视图</h3>
              <p>强调“关系可解释、可调用、可维护”，而不是把图画得复杂。</p>
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
              <h3>项目状态</h3>
              <p>当前已经把“前端读取后端项目目录 + 项目页发起问答”打通。</p>
            </div>
          </div>

          <div className="tiny-kpi">
            <div className="row"><span>后端项目</span><strong>{projects.length}</strong></div>
            <div className="row"><span>可问答</span><strong>{projects.filter((project) => project.status === '可问答').length}</strong></div>
            <div className="row"><span>挂载知识库</span><strong>{projects[0]?.knowledgeBase.label ?? '--'}</strong></div>
            <div className="row"><span>当前阶段</span><strong>项目群聊可用</strong></div>
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
}: {
  metrics: Metric[];
  visibleProjects: ProjectSummary[];
  projectAlerts: string[];
  issueDistribution: Array<{ label: string; value: string }>;
  openProject: (projectId: string) => void;
  refreshProjects: () => void;
  isLoading: boolean;
}) {
  return (
    <div className="view">
      <MetricRow metrics={metrics} />

      <section className="portfolio-grid">
        <article className="project-card create-card">
          <div className="card-avatar">↻</div>
          <h4>同步后端项目</h4>
          <p>项目管理页的数据由 Agent OS API 提供，当前项目页已经可以直接进入问答。</p>
          <div className="card-actions">
            <button className="button" type="button" onClick={refreshProjects}>
              {isLoading ? '同步中...' : '刷新项目列表'}
            </button>
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
                <strong>项目源文件</strong>
                <p>{project.fileName}</p>
              </div>
              <div className="list-item">
                <strong>当前挂载知识库</strong>
                <p>{project.knowledgeBase.label}</p>
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
              <h3>后端当前还没有项目</h3>
              <p>等接上创建项目或上传接口后，这里会展示新的项目目录。</p>
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
              <p>这里展示当前后端项目返回的状态提示和知识库提醒。</p>
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
                <p>等后端返回项目后，这里会展示项目级待办与提示。</p>
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

function ProjectView({
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
}) {
  const selectedConversation = conversations.find((conversation) => conversation.id === selectedConversationId)
    ?? conversations[0]
    ?? null;
  const [expandedParticipantId, setExpandedParticipantId] = useState<string | null>(project.participantAgents[0]?.id ?? null);

  return (
    <div className="view project-page-view">
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
              <strong>{project.knowledgeBase.label}</strong>
            </div>
            <div className="sidebar-kb-row">
              <span>Snapshot</span>
              <strong>{project.knowledgeBase.snapshotId ?? '--'}</strong>
            </div>
            <div className="sidebar-kb-row">
              <span>Freshness</span>
              <strong>{project.knowledgeBase.freshness.status}</strong>
            </div>
            <div className="sidebar-kb-row">
              <span>节点 / 记录</span>
              <strong>{project.knowledgeBase.nodeCount} / {project.knowledgeBase.recordCount}</strong>
            </div>
          </div>
        </section>

        <section className="surface-card conversation-panel">
          <div className="conversation-panel-header">
            <div>
              <h3>{selectedConversation?.title ?? '新对话'}</h3>
              <p>围绕当前挂载知识库提问，回答会保留 Markdown 结构和来源信息。</p>
            </div>
            <div className="conversation-panel-meta">
              <span className="pill is-mint">{project.knowledgeBase.label}</span>
              <span className="pill">{project.knowledgeBase.freshness.status}</span>
            </div>
          </div>

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
                placeholder={`围绕“${project.knowledgeBase.label}”提问，例如：${project.suggestedQuestions[0] ?? '输入你的问题'}`}
                rows={4}
                disabled={isSending}
              />
            </label>

            <div className="composer-actions">
              <span className="subtle">当前会话：{selectedConversation?.title ?? '新对话'}</span>
              <button
                className="button"
                type="button"
                onClick={() => onSend()}
                disabled={isSending || draft.trim().length === 0}
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
        <>
          <div className="participant-card-header">
            <div className={`participant-avatar ${toneClass(agent.statusTone)}`}>{agent.icon}</div>
            <span className={`status-badge ${statusToneClass(agent.statusTone)}`}>{agent.status}</span>
          </div>

          <div className="participant-copy">
            <h4>{agent.role}</h4>
          </div>

          <p className="participant-description">{agent.description}</p>

          <div className="tag-row">
            {agent.capabilities.map((capability) => (
              <span key={capability} className={`tag ${toneClass(agent.statusTone)}`}>{capability}</span>
            ))}
          </div>
        </>
      )}
    </article>
  );
}

export default function App() {
  const [activeView, setActiveView] = useState<ViewKey>('overview');
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [projectConversations, setProjectConversations] = useState<Record<string, ProjectConversation[]>>({});
  const [selectedConversationIds, setSelectedConversationIds] = useState<Record<string, string>>({});
  const [chatDrafts, setChatDrafts] = useState<Record<string, string>>({});
  const [chatErrors, setChatErrors] = useState<Record<string, string | null>>({});
  const [sendingConversationKey, setSendingConversationKey] = useState<string | null>(null);
  const deferredSearchText = useDeferredValue(searchText.trim().toLowerCase());

  const loadProjects = async () => {
    setIsLoadingProjects(true);
    setProjectsError(null);

    try {
      const response = await fetch('/api/projects');
      if (!response.ok) {
        throw new Error(`项目接口返回 ${response.status}`);
      }

      const data = (await response.json()) as ProjectListResponse;
      setProjects(data.projects);
      setSelectedProjectId((current) =>
        data.projects.some((project) => project.id === current) ? current : data.projects[0]?.id ?? null,
      );
    } catch (error) {
      setProjectsError(error instanceof Error ? error.message : '项目列表加载失败');
    } finally {
      setIsLoadingProjects(false);
    }
  };

  useEffect(() => {
    void loadProjects();
  }, []);

  useEffect(() => {
    setProjectConversations((current) => {
      const next = { ...current };
      for (const project of projects) {
        if (!next[project.id]) {
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
  }, [projects]);

  const overviewMetrics = buildOverviewMetrics(projects);
  const projectAlerts = buildProjectAlerts(projects);
  const issueDistribution = buildIssueDistribution(projects);

  const selectedProject = projects.find((project) => project.id === selectedProjectId) ?? projects[0] ?? null;
  const selectedConversations = selectedProject ? (projectConversations[selectedProject.id] ?? [buildInitialConversation(selectedProject)]) : [];
  const selectedConversationId = selectedProject ? (selectedConversationIds[selectedProject.id] ?? selectedConversations[0]?.id ?? null) : null;
  const selectedConversation = selectedConversations.find((conversation) => conversation.id === selectedConversationId) ?? selectedConversations[0] ?? null;

  const visibleProjects = deferredSearchText
    ? projects.filter((project) => {
      const candidate = [
        project.name,
        project.focus,
        project.description,
        project.fileName,
        project.knowledgeBase.label,
        ...project.suggestedQuestions,
      ].join(' ').toLowerCase();
      return candidate.includes(deferredSearchText);
    })
    : projects;

  const showProject = (projectId: string) => {
    setSelectedProjectId(projectId);
    setActiveView('project');
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
    setChatErrors((current) => ({
      ...current,
      [`${projectId}:${nextConversation.id}`]: null,
    }));
  };

  const selectConversation = (projectId: string, conversationId: string) => {
    setSelectedConversationIds((current) => ({
      ...current,
      [projectId]: conversationId,
    }));
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

  const sendQuestion = async (project: ProjectSummary, quickQuestion?: string) => {
    const conversationId = selectedConversationIds[project.id] ?? getDefaultConversationId(project.id);
    const draftKey = `${project.id}:${conversationId}`;
    const question = (quickQuestion ?? chatDrafts[draftKey] ?? '').trim();
    if (!question || sendingConversationKey === draftKey) return;

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

  const segmentsByView: Record<ViewKey, Segment[]> = {
    overview: [
      { label: '总览', active: true },
      { label: '项目', onClick: () => setActiveView('projects') },
      { label: '能力', onClick: () => setActiveView('agents') },
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
      { label: '群聊', active: true },
      { label: '证据链' },
      { label: '任务历史' },
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
      description: '这里的项目列表已经切到 Agent OS API 返回的数据，不再使用前端本地项目 mock。',
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
        ? '这是由 Agent OS API 返回的项目工作区。当前项目群聊已经接了真实问答接口。'
        : '当前还没有项目，请先同步后端项目列表。',
    },
  };

  return (
    <div className="app-frame">
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

        <button className="primary-ghost" type="button" onClick={loadProjects}>
          <span>↻</span>
          {isLoadingProjects ? '同步中...' : '同步项目'}
        </button>

        <nav className="nav-group">
          <p className="nav-caption">Workspace</p>
          <button className={`nav-item ${activeView === 'overview' ? 'active' : ''}`} type="button" onClick={() => setActiveView('overview')}>
            首页（manager agent）
          </button>
          <button className={`nav-item ${activeView === 'graph' ? 'active' : ''}`} type="button" onClick={() => setActiveView('graph')}>
            数据中心（知识工程agent）
          </button>
          <button className={`nav-item ${activeView === 'projects' ? 'active' : ''}`} type="button" onClick={() => setActiveView('projects')}>
            项目管理（manager agent）
          </button>

          <div className="nav-subtree">
            {projects.length > 0 ? projects.map((project) => (
              <button
                key={project.id}
                className={`nav-subitem ${activeView === 'project' && selectedProjectId === project.id ? 'active' : ''}`}
                type="button"
                onClick={() => showProject(project.id)}
              >
                {project.name}
              </button>
            )) : (
              <div className="nav-empty">{isLoadingProjects ? '正在同步后端项目...' : '后端当前还没有项目'}</div>
            )}
            <button className="nav-subitem create" type="button" onClick={loadProjects}>
              + 刷新项目列表
            </button>
          </div>

          <button className={`nav-item ${activeView === 'agents' ? 'active' : ''}`} type="button" onClick={() => setActiveView('agents')}>
            Agent / Skill
          </button>
        </nav>

        <div className="sidebar-footer">
          <div className="user-avatar">S</div>
          <div>
            <strong>samhar</strong>
            <p>产品负责人 · 项目群聊已接通</p>
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
              <div className="quick-links">
                <button className="button" type="button" onClick={loadProjects}>重试</button>
              </div>
            </section>
          )}

          {activeView === 'overview' && (
            <OverviewView
              metrics={overviewMetrics}
              hasProjects={projects.length > 0}
              openProjects={() => setActiveView('projects')}
              openGraph={() => setActiveView('graph')}
              openAgents={() => setActiveView('agents')}
              openLatestProject={() => projects[0] && showProject(projects[0].id)}
              refreshProjects={loadProjects}
              isLoading={isLoadingProjects}
            />
          )}
          {activeView === 'graph' && (
            <GraphView
              openProjects={() => setActiveView('projects')}
              refreshProjects={loadProjects}
              projects={projects}
              isLoading={isLoadingProjects}
            />
          )}
          {activeView === 'projects' && (
            <ProjectsView
              metrics={overviewMetrics}
              visibleProjects={visibleProjects}
              projectAlerts={projectAlerts}
              issueDistribution={issueDistribution}
              openProject={showProject}
              refreshProjects={loadProjects}
              isLoading={isLoadingProjects}
            />
          )}
          {activeView === 'agents' && <AgentsView />}
          {activeView === 'project' && selectedProject && (
            <ProjectView
              project={selectedProject}
              conversations={selectedConversations}
              selectedConversationId={selectedConversation?.id ?? null}
              draft={selectedConversation ? (chatDrafts[`${selectedProject.id}:${selectedConversation.id}`] ?? '') : ''}
              onDraftChange={(value) => updateDraft(selectedProject.id, selectedConversation?.id ?? null, value)}
              onSend={(question) => void sendQuestion(selectedProject, question)}
              onSelectConversation={(conversationId) => selectConversation(selectedProject.id, conversationId)}
              onCreateConversation={() => createConversation(selectedProject.id)}
              isSending={selectedConversation ? sendingConversationKey === `${selectedProject.id}:${selectedConversation.id}` : false}
              chatError={selectedConversation ? (chatErrors[`${selectedProject.id}:${selectedConversation.id}`] ?? null) : null}
            />
          )}
          {activeView === 'project' && !selectedProject && !isLoadingProjects && (
            <section className="surface-card empty-state">
              <div className="section-title">
                <div>
                  <h3>当前还没有项目工作区</h3>
                  <p>请先同步后端项目列表，项目页会显示后端返回的项目工作区。</p>
                </div>
              </div>
              <div className="quick-links">
                <button className="button" type="button" onClick={loadProjects}>同步项目列表</button>
              </div>
            </section>
          )}
        </section>
      </main>
    </div>
  );
}
