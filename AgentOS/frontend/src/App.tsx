import { useDeferredValue, useState } from 'react';
import {
  agents,
  graphAssets,
  graphMetrics,
  graphNodes,
  issueDistribution,
  overviewMetrics,
  projectAlerts,
  projects,
  type Metric,
  type ProjectSummary,
  type Tone,
  type ViewKey,
} from './mock/workspace';

interface Segment {
  label: string;
  onClick?: () => void;
  active?: boolean;
}

function toneClass(tone: Tone) {
  return `is-${tone}`;
}

function statusToneClass(status: ProjectSummary['status']) {
  if (status === '高关注') return 'is-rose';
  if (status === '跟踪中') return 'is-amber';
  return 'is-mint';
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
            placeholder="搜索项目、Agent、任务..."
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </label>
      </div>
    </header>
  );
}

function OverviewView({ openProjects, openGraph, openAgents, openProject }: {
  openProjects: () => void;
  openGraph: () => void;
  openAgents: () => void;
  openProject: (projectId: string) => void;
}) {
  return (
    <div className="view">
      <MetricRow metrics={overviewMetrics} />

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
                <span className="mini-stat">项目数、活跃度、风险等级、系统负载</span>
              </div>
              <span className="step-index">1</span>
            </div>
            <div className="stage-step">
              <div>
                <strong>判断去哪一层处理问题</strong>
                <span className="mini-stat">数据问题去数据中心，项目问题去项目管理，再进入具体项目页</span>
              </div>
              <span className="step-index">2</span>
            </div>
            <div className="stage-step">
              <div>
                <strong>不处理具体业务细节</strong>
                <span className="mini-stat">具体任务拆解、证据链和群聊协同都放在 Project Agent 页面</span>
              </div>
              <span className="step-index">3</span>
            </div>
          </div>

          <div className="quick-links">
            <button className="button" type="button" onClick={openProjects}>进入项目管理</button>
            <button className="button-secondary" type="button" onClick={openGraph}>进入数据中心</button>
            <button className="button-secondary" type="button" onClick={() => openProject(projects[0].id)}>进入朝阳项目页</button>
          </div>
        </section>

        <section className="surface-card">
          <div className="section-title">
            <div>
              <h3>栏目与 Agent 对应关系</h3>
              <p>前端先用 mock 数据把层级跑顺，后面再接真实任务和知识状态。</p>
            </div>
          </div>

          <div className="list-stack">
            <div className="list-item">
              <strong>首页（manager agent）</strong>
              <p>只看全局运行指标、风险态势和去哪一层处理问题。</p>
            </div>
            <div className="list-item">
              <strong>数据中心（知识工程 agent）</strong>
              <p>管理知识库底座、数据目录和图谱关系。</p>
            </div>
            <div className="list-item">
              <strong>项目管理（manager agent）</strong>
              <p>展示项目目录、待办与告警，并把人带进具体项目页。</p>
            </div>
            <div className="list-item">
              <strong>项目页（project agent）</strong>
              <p>以群聊为入口，但核心是任务链、结论卡片、证据链和审批轨迹。</p>
            </div>
            <div className="list-item">
              <strong>Agent / Skill</strong>
              <p>说明这套系统的能力模块如何装配，而不是一次性定制页面。</p>
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

function GraphView() {
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
              <strong>{asset.title === '文件导入' ? '上传文件' : '新增连接器'}</strong>
              <p className="subtle">前端阶段先保留视觉和结构，后面再接真实上传和连接流程。</p>
              <div className="tag-row">
                {asset.tags.map((tag) => (
                  <span key={tag} className={`tag ${toneClass(asset.tone)}`}>{tag}</span>
                ))}
              </div>
              <div className="quick-links">
                <button className="button" type="button">{asset.title === '文件导入' ? '上传文件' : '新增接口'}</button>
                <button className="button-secondary" type="button">{asset.title === '文件导入' ? '查看目录' : '查看连接器'}</button>
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
              <h3>知识库状态</h3>
              <p>数据中心除了“图”，还要能展示完整度、更新时间和解释能力。</p>
            </div>
          </div>

          <div className="tiny-kpi">
            <div className="row"><span>知识覆盖率</span><strong>92%</strong></div>
            <div className="row"><span>维修案例映射</span><strong>67%</strong></div>
            <div className="row"><span>投诉工单映射</span><strong>51%</strong></div>
            <div className="row"><span>最近更新</span><strong>3 项</strong></div>
          </div>
        </section>
      </div>
    </div>
  );
}

function ProjectsView({ visibleProjects, openProject }: {
  visibleProjects: ProjectSummary[];
  openProject: (projectId: string) => void;
}) {
  return (
    <div className="view">
      <MetricRow metrics={overviewMetrics} />

      <section className="portfolio-grid">
        <article className="project-card create-card">
          <div className="card-avatar">+</div>
          <h4>新增项目</h4>
          <p>创建新的 Project Agent 工作区，并绑定数据模板、权限链和基础 Agent 组合。</p>
          <div className="card-actions">
            <button className="button-secondary" type="button">创建项目</button>
          </div>
        </article>

        {visibleProjects.map((project) => (
          <article key={project.id} className="project-card">
            <div className="project-header">
              <div>
                <h4>{project.name}</h4>
                <p>{project.description}</p>
              </div>
              <span className={`status-badge ${statusToneClass(project.status)}`}>{project.status}</span>
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
                <strong>当前问题</strong>
                <p>{project.focus}</p>
              </div>
            </div>

            <div className="card-actions">
              <button className="button" type="button" onClick={() => openProject(project.id)}>进入项目页</button>
            </div>
          </article>
        ))}
      </section>

      <div className="overview-grid">
        <section className="surface-card">
          <div className="section-title">
            <div>
              <h3>待办与告警</h3>
              <p>这部分从首页下沉到项目管理页，保持 Manager Agent 的层级清晰。</p>
            </div>
          </div>

          <div className="audit-list">
            {projectAlerts.map((alert) => (
              <div key={alert} className="audit-item">
                <strong>{alert.split('：')[0]}</strong>
                <p>{alert.split('：')[1]}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="surface-card">
          <div className="section-title">
            <div>
              <h3>项目问题分布</h3>
              <p>帮助 Manager Agent 快速判断资源投向。</p>
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

function ProjectView({ project }: { project: ProjectSummary }) {
  return (
    <div className="view chat-page-layout">
      <div className="chat-summary-grid">
        {project.stats.map((stat) => (
          <article key={stat.label} className="chat-summary-card">
            <p>{stat.label}</p>
            <strong>{stat.value}</strong>
          </article>
        ))}
      </div>

      <div className="warroom-layout">
        <section className="surface-card">
          <div className="section-title">
            <div>
              <h3>项目侧栏</h3>
              <p>保留项目记忆、任务入口和当前参与 Agent。</p>
            </div>
          </div>

          <div className="list-stack">
            {project.memory.map((memory) => (
              <div key={memory} className="list-item">
                <strong>{project.shortName}</strong>
                <p>{memory}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="surface-card">
          <div className="section-title">
            <div>
              <h3>项目群聊</h3>
              <p>这页就是 Project Agent 的群聊工作台，聊天只是入口，不是全部。</p>
            </div>
            <span className="pill is-mint">当前话题：{project.focus}</span>
          </div>

          <div className="chat-thread">
            {project.chat.map((message, index) => (
              <div key={`${message.speaker}-${index}`} className={`chat-bubble ${message.role}`}>
                <span className="speaker">{message.speaker}</span>
                <p>{message.content}</p>
              </div>
            ))}
          </div>

          <div className="recommendation-grid">
            {project.recommendations.map((item) => (
              <div key={item.title} className="recommendation-card">
                <h4>{item.title}</h4>
                <p>{item.content}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="surface-card">
          <div className="section-title">
            <div>
              <h3>右侧协同轨迹</h3>
              <p>帮助客户看懂这不是普通聊天，而是一个 Agent 在组织工作。</p>
            </div>
          </div>

          <div className="timeline-list">
            {project.timeline.map((item) => (
              <div key={item.title} className="timeline-item">
                <strong>{item.title}</strong>
                <p>{item.content}</p>
              </div>
            ))}
          </div>

          <div className="footer-note">
            这一栏后续可以升级成真正可展开的证据链面板，点开后看到时序图、规程摘录、维修单和审批日志。
          </div>
        </section>
      </div>
    </div>
  );
}

export default function App() {
  const [activeView, setActiveView] = useState<ViewKey>('overview');
  const [selectedProjectId, setSelectedProjectId] = useState<string>(projects[0].id);
  const [searchText, setSearchText] = useState('');
  const deferredSearchText = useDeferredValue(searchText.trim().toLowerCase());

  const selectedProject = projects.find((project) => project.id === selectedProjectId) ?? projects[0];

  const visibleProjects = deferredSearchText
    ? projects.filter((project) => {
      const candidate = `${project.name} ${project.focus} ${project.description}`.toLowerCase();
      return candidate.includes(deferredSearchText);
    })
    : projects;

  const showProject = (projectId: string) => {
    setSelectedProjectId(projectId);
    setActiveView('project');
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
      { label: '待办与告警' },
      { label: '项目问题' },
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
      description: '这是知识工程 Agent 的入口页，用来上传文件、接入接口，并维护知识库数据底座。',
    },
    projects: {
      eyebrow: 'Manager Agent',
      title: '项目管理（manager agent）',
      description: '这里展示现有项目数据和问题，同时承接待办与告警。每个项目都对应一个独立的 Project Agent 页面。',
    },
    agents: {
      eyebrow: 'Capability Matrix',
      title: 'Agent / Skill 中心',
      description: '前端阶段先保留能力矩阵和装配关系，后续再接真实配置与技能状态。',
    },
    project: {
      eyebrow: 'Project Agent',
      title: `${selectedProject.name}（project agent）`,
      description: '这是项目对应的群聊工作区。这里的主体不是栏目，而是一个具体的 Project Agent。',
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

        <button className="primary-ghost" type="button" onClick={() => showProject(projects[0].id)}>
          <span>+</span>
          新建任务
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
            {projects.map((project) => (
              <button
                key={project.id}
                className={`nav-subitem ${activeView === 'project' && selectedProjectId === project.id ? 'active' : ''}`}
                type="button"
                onClick={() => showProject(project.id)}
              >
                {project.name}（project agent）
              </button>
            ))}
            <button className="nav-subitem create" type="button" onClick={() => setActiveView('projects')}>
              + 新增项目
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
            <p>产品负责人 · mock 模式</p>
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

        <section className="content-shell">
          {activeView === 'overview' && (
            <OverviewView
              openProjects={() => setActiveView('projects')}
              openGraph={() => setActiveView('graph')}
              openAgents={() => setActiveView('agents')}
              openProject={showProject}
            />
          )}
          {activeView === 'graph' && <GraphView />}
          {activeView === 'projects' && <ProjectsView visibleProjects={visibleProjects} openProject={showProject} />}
          {activeView === 'agents' && <AgentsView />}
          {activeView === 'project' && <ProjectView project={selectedProject} />}
        </section>
      </main>
    </div>
  );
}
