const state = {
  view: "workspace",
  segments: {
    workspace: ["总览", "项目", "驾驶舱"],
    coldstart: ["向导", "激活结果", "接入日志"],
    graph: ["资产图谱", "事件图谱", "知识映射"],
    warroom: ["会话", "证据链", "审批"],
    governance: ["总览", "风险", "审计"],
    agents: ["基础 Agent", "项目 Agent", "Skills"],
  },
  activeSegment: {
    workspace: "总览",
    coldstart: "向导",
    graph: "资产图谱",
    warroom: "会话",
    governance: "总览",
    agents: "基础 Agent",
  },
};

const pageMeta = {
  workspace: {
    eyebrow: "HeatGraph AI",
    title: "工作台首页",
    description:
      "把供热项目、知识图谱、Agent 能力和治理控制放进同一个控制台里，作为整个 Demo 的统一入口。",
  },
  coldstart: {
    eyebrow: "Onboarding",
    title: "冷启动向导",
    description:
      "先问对问题，再生成数据模型、场景配置清单和基础 Agent 组合，让系统不是空白聊天框，而是有业务上下文的工作台。",
  },
  graph: {
    eyebrow: "Graph Foundation",
    title: "数据与图谱中心",
    description:
      "把时序数据、规程文档、维修日志和资产关系编织成企业真相层，让后续分析和建议都建立在可追溯的图谱之上。",
  },
  warroom: {
    eyebrow: "Project Room",
    title: "项目作战室",
    description:
      "围绕一个具体项目问题，让 Project Agent 编排分析 Agent、知识 Agent 和预测 Agent 协同工作，并输出带证据链的结论。",
  },
  governance: {
    eyebrow: "Governance",
    title: "管理驾驶舱",
    description:
      "把高风险指令拦截、审批待办、资源冲突和系统日志放到一个管理视图里，体现企业级 AI 的可控与可审计。",
  },
  agents: {
    eyebrow: "Capability Matrix",
    title: "Agent / Skill 中心",
    description:
      "展示基础 Agent、项目 Agent 和工具技能的装配方式，说明这套系统为什么能行业化复制，而不是一次性项目。",
  },
};

const navItems = [...document.querySelectorAll(".nav-item")];
const contentShell = document.getElementById("content-shell");
const segmentedControl = document.getElementById("segmented-control");
const pageTitle = document.getElementById("page-title");
const pageDescription = document.getElementById("page-description");
const eyebrow = document.getElementById("eyebrow");

navItems.forEach((item) => {
  item.addEventListener("click", () => {
    state.view = item.dataset.view;
    render();
  });
});

function renderSegments() {
  const currentSegments = state.segments[state.view];
  const active = state.activeSegment[state.view];
  segmentedControl.innerHTML = currentSegments
    .map(
      (segment) => `
        <button
          class="segment ${segment === active ? "active" : ""}"
          data-segment="${segment}"
        >
          ${segment}
        </button>
      `,
    )
    .join("");

  segmentedControl.querySelectorAll(".segment").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeSegment[state.view] = button.dataset.segment;
      render();
    });
  });
}

function renderWorkspace() {
  return `
    <div class="view">
      <div class="metric-row">
        <article class="metric-card is-mint">
          <h3>在线项目</h3>
          <div class="value">06</div>
          <div class="trend">其中 3 个处于高频协同状态</div>
        </article>
        <article class="metric-card is-blue">
          <h3>活跃 Agent</h3>
          <div class="value">18</div>
          <div class="trend">知识工程、预测、平衡与治理并行运行</div>
        </article>
        <article class="metric-card is-amber">
          <h3>待审批动作</h3>
          <div class="value">03</div>
          <div class="trend">2 条调控建议，1 条资源调用申请</div>
        </article>
        <article class="metric-card is-rose">
          <h3>高风险提醒</h3>
          <div class="value">02</div>
          <div class="trend">都已被 Manager Agent 拦截</div>
        </article>
      </div>

      <div class="overview-grid">
        <section class="surface-card">
          <div class="section-title">
            <div>
              <h3>产品 Demo 主路径</h3>
              <p>用一条完整闭环把 AI Native、知识图谱和企业治理一起讲清楚。</p>
            </div>
            <span class="pill is-mint">建议主场景</span>
          </div>
          <div class="stage-flow">
            <div class="stage-step">
              <div>
                <strong>冷启动识别业务边界</strong>
                <span class="mini-stat">行业、重点场景、资产规模、接入数据</span>
              </div>
              <span class="step-index">1</span>
            </div>
            <div class="stage-step">
              <div>
                <strong>构建供热项目图谱</strong>
                <span class="mini-stat">设备、管网、规程、日志、事件自动映射</span>
              </div>
              <span class="step-index">2</span>
            </div>
            <div class="stage-step">
              <div>
                <strong>在项目作战室发起问题</strong>
                <span class="mini-stat">“A 站昨晚回水温度过低的原因是什么？”</span>
              </div>
              <span class="step-index">3</span>
            </div>
            <div class="stage-step">
              <div>
                <strong>多 Agent 协同诊断与建议</strong>
                <span class="mini-stat">分析 Agent + 知识 Agent + 预测 Agent</span>
              </div>
              <span class="step-index">4</span>
            </div>
            <div class="stage-step">
              <div>
                <strong>治理拦截与人工审批</strong>
                <span class="mini-stat">高风险调控动作必须留痕并经人确认</span>
              </div>
              <span class="step-index">5</span>
            </div>
          </div>
        </section>

        <section class="surface-card">
          <div class="section-title">
            <div>
              <h3>本次 Demo 应强调什么</h3>
              <p>不是“有很多 Agent”，而是“它真的能在企业里工作”。</p>
            </div>
          </div>
          <div class="list-stack">
            <div class="list-item">
              <strong>图谱是底座</strong>
              <p>Agent 不是盲聊，而是站在设备、事件、文档和组织关系之上推理。</p>
            </div>
            <div class="list-item">
              <strong>群聊只是入口</strong>
              <p>真正重要的是任务拆解、证据链、审批流和项目记忆。</p>
            </div>
            <div class="list-item">
              <strong>B 端可信度</strong>
              <p>所有建议动作都有风险分级、权限边界和审计日志。</p>
            </div>
            <div class="list-item">
              <strong>可复制交付</strong>
              <p>通过 Agent / Skill 组合与冷启动模板，快速迁移到不同供热项目。</p>
            </div>
          </div>
        </section>
      </div>

      <section class="agent-grid">
        ${agentCard({
          icon: "冷",
          title: "冷启动向导",
          desc: "把行业、场景、资产和数据接入流程做成一个有解释能力的启动器。",
          tags: ["向导式接入", "业务编译", "模板配置"],
          badgeClass: "is-blue",
        })}
        ${agentCard({
          icon: "图",
          title: "图谱中心",
          desc: "把时序数据、规程、日志和工单映射到同一个项目图谱，为 Agent 提供真相层。",
          tags: ["知识图谱", "Schema 映射", "证据链"],
          badgeClass: "is-mint",
        })}
        ${agentCard({
          icon: "战",
          title: "项目作战室",
          desc: "以群聊为交互入口，以任务编排和结论卡片为主界面，承载整个异常诊断闭环。",
          tags: ["Project Agent", "多智能体协同", "审批"],
          badgeClass: "is-amber",
        })}
      </section>
    </div>
  `;
}

function renderColdStart() {
  return `
    <div class="view">
      <div class="wizard-layout">
        <section class="surface-card">
          <div class="section-title">
            <div>
              <h3>为什么系统先问这些问题</h3>
              <p>先确定业务边界，再决定后面的数据模型、图谱类型和 Agent 组合。</p>
            </div>
            <span class="pill is-blue">Q1-Q4</span>
          </div>
          <div class="list-stack">
            <div class="list-item">
              <strong>Q1 行业场景</strong>
              <p>默认是城市集中供热，但页面会保留行业扩展能力，方便后续做更多 B 端行业版本。</p>
            </div>
            <div class="list-item">
              <strong>Q2 业务重点</strong>
              <p>比如换热站调控、接诉即办、漏损检测。这个选择直接影响会激活哪些专业 Agent。</p>
            </div>
            <div class="list-item">
              <strong>Q3 资产规模</strong>
              <p>站点数量、覆盖区域、核心设备，是项目图谱和治理复杂度的关键输入。</p>
            </div>
            <div class="list-item">
              <strong>Q4 可接入数据</strong>
              <p>时序表、规程文档、维修日志、工单系统决定第一版 Demo 的分析能力边界。</p>
            </div>
          </div>
        </section>

        <section class="surface-card">
          <div class="section-title">
            <div>
              <h3>冷启动配置</h3>
              <p>UI 借鉴参考图的轻卡片和圆角系统，但内容完全按我们的供热场景来做。</p>
            </div>
            <button class="button">生成场景配置清单</button>
          </div>

          <div class="field-group">
            <div class="input-card">
              <label>行业场景</label>
              <div class="option-row">
                <span class="option-pill selected">城市集中供热</span>
                <span class="option-pill">工业园区热网</span>
                <span class="option-pill">热源厂联调</span>
              </div>
            </div>

            <div class="input-card">
              <label>业务重点</label>
              <div class="option-row">
                <span class="option-pill selected">换热站异常诊断</span>
                <span class="option-pill selected">负荷预测</span>
                <span class="option-pill">接诉即办协同</span>
                <span class="option-pill">管网漏损检测</span>
              </div>
            </div>

            <div class="input-card">
              <label>资产规模</label>
              <div class="pill-row">
                <span class="pill">换热站 48</span>
                <span class="pill">热源厂 3</span>
                <span class="pill">监测点 1264</span>
                <span class="pill">服务面积 820 万平米</span>
              </div>
            </div>

            <div class="upload-area">
              <strong>数据源上传</strong>
              <p class="subtle">支持时序数据、PDF 规程、TXT 维修日志、资产台账、工单导出文件。</p>
              <div class="upload-list">
                <div class="list-item">
                  <strong>station_timeseries_apr.csv</strong>
                  <p>识别为温度 / 压力 / 流量时序表，待映射 7 个关键字段。</p>
                </div>
                <div class="list-item">
                  <strong>供热运行规程.pdf</strong>
                  <p>已切片 86 段知识单元，待绑定设备与规则节点。</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <div class="hero-grid">
        <section class="surface-card">
          <div class="section-title">
            <div>
              <h3>自动激活的基础 Agent</h3>
              <p>系统会根据冷启动结果生成一份有业务针对性的能力装配方案。</p>
            </div>
          </div>
          <div class="pill-row">
            <span class="pill is-mint">知识工程 Agent</span>
            <span class="pill is-blue">负荷预测 Agent</span>
            <span class="pill is-blue">水力平衡 Agent</span>
            <span class="pill is-amber">异常分析 Agent</span>
            <span class="pill is-rose">Manager Agent 审计规则</span>
          </div>
        </section>

        <section class="surface-card">
          <div class="section-title">
            <div>
              <h3>即将生成</h3>
              <p>冷启动完成后，系统自动建立项目图谱、项目工作区和权限边界。</p>
            </div>
          </div>
          <div class="tiny-kpi">
            <div class="row"><span>项目模板</span><strong>智慧供热调控模板</strong></div>
            <div class="row"><span>图谱类型</span><strong>资产图 + 事件图 + 规则图</strong></div>
            <div class="row"><span>默认工作区</span><strong>朝阳区智慧供热改造</strong></div>
            <div class="row"><span>治理策略</span><strong>高风险动作强制审批</strong></div>
          </div>
        </section>
      </div>
    </div>
  `;
}

function renderGraphCenter() {
  return `
    <div class="view">
      <div class="graph-layout">
        <section class="surface-card">
          <div class="section-title">
            <div>
              <h3>数据源目录</h3>
              <p>按供热业务实际类型来组织接入，而不是按文件格式堆在一起。</p>
            </div>
          </div>
          <div class="list-stack">
            <div class="list-item">
              <strong>时序数据</strong>
              <p>回水温度、供水温度、压力、流量、阀位、泵频。</p>
            </div>
            <div class="list-item">
              <strong>规程文档</strong>
              <p>运行规程、应急预案、设备操作手册。</p>
            </div>
            <div class="list-item">
              <strong>运维修复记录</strong>
              <p>维修日志、故障单、历史处置经验。</p>
            </div>
            <div class="list-item">
              <strong>组织与审批关系</strong>
              <p>项目经理、调度员、技术负责人、审批链路。</p>
            </div>
          </div>
        </section>

        <section class="surface-card">
          <div class="section-title">
            <div>
              <h3>供热项目图谱</h3>
              <p>这里先用静态骨架表达未来的图谱中心布局，重点是“可解释关系”。</p>
            </div>
            <span class="pill is-mint">资产图谱</span>
          </div>
          <div class="graph-canvas">
            <div class="graph-line" style="left: 206px; top: 120px; width: 160px; transform: rotate(9deg);"></div>
            <div class="graph-line" style="left: 220px; top: 162px; width: 200px; transform: rotate(0deg);"></div>
            <div class="graph-line" style="left: 186px; top: 236px; width: 220px; transform: rotate(-10deg);"></div>
            <div class="graph-line" style="left: 382px; top: 228px; width: 126px; transform: rotate(18deg);"></div>

            <div class="graph-node is-mint" style="left: 64px; top: 102px;">
              <strong>换热站 A</strong>
              回水温度异常
            </div>
            <div class="graph-node is-blue" style="left: 314px; top: 124px;">
              <strong>回水温度传感器</strong>
              T-return-04
            </div>
            <div class="graph-node is-amber" style="left: 430px; top: 190px;">
              <strong>运行规程 4.2</strong>
              温差异常判断规则
            </div>
            <div class="graph-node is-blue" style="left: 274px; top: 282px;">
              <strong>维修事件</strong>
              3 月 31 日阀门维护
            </div>
            <div class="graph-node is-mint" style="left: 82px; top: 308px;">
              <strong>项目工作区</strong>
              朝阳区智慧供热改造
            </div>
          </div>
        </section>

        <section class="surface-card">
          <div class="section-title">
            <div>
              <h3>实体详情</h3>
              <p>选中图谱节点后，需要看到属性、关联规则和历史事件。</p>
            </div>
          </div>
          <div class="tiny-kpi">
            <div class="row"><span>当前节点</span><strong>换热站 A</strong></div>
            <div class="row"><span>区域</span><strong>朝阳区北苑片区</strong></div>
            <div class="row"><span>关联传感器</span><strong>12 个</strong></div>
            <div class="row"><span>关联规程</span><strong>8 条</strong></div>
            <div class="row"><span>近 30 天事件</span><strong>4 起</strong></div>
          </div>

          <div class="list-stack" style="margin-top: 16px;">
            <div class="list-item">
              <strong>关键关联</strong>
              <p>回水温度低于阈值时，需结合外温、负荷与阀位变化判断是否属于调控异常。</p>
            </div>
            <div class="list-item">
              <strong>知识覆盖率</strong>
              <p>站点级规则覆盖 92%，维修案例覆盖 67%，可继续补历史运维档案。</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  `;
}

function renderWarRoom() {
  return `
    <div class="view">
      <div class="warroom-layout">
        <section class="surface-card">
          <div class="section-title">
            <div>
              <h3>项目目录</h3>
              <p>项目作战室不是聊天列表，而是项目级任务、模板、成员和记忆的总入口。</p>
            </div>
          </div>
          <div class="list-stack">
            <div class="list-item">
              <strong>项目概览</strong>
              <p>活跃 Agent 5 个，待处理异常 2 个，本周节能指标提升 4.3%。</p>
            </div>
            <div class="list-item">
              <strong>历史任务</strong>
              <p>“东区二次网压差异常”、“夜间负荷预测偏差解释”、“住户投诉联动分析”。</p>
            </div>
            <div class="list-item">
              <strong>任务模板</strong>
              <p>异常诊断、调控建议、周报生成、值班交接摘要。</p>
            </div>
            <div class="list-item">
              <strong>项目成员</strong>
              <p>项目经理、调度、运维专家、管理 Agent、知识工程 Agent。</p>
            </div>
          </div>
        </section>

        <section class="surface-card">
          <div class="section-title">
            <div>
              <h3>项目群聊</h3>
              <p>聊天是入口，但真正的价值来自背后的 Agent 编排、证据链和结论卡片。</p>
            </div>
            <span class="pill is-mint">当前任务：A 站回水温度异常</span>
          </div>

          <div class="chat-thread">
            <div class="chat-bubble user">
              <span class="speaker">项目经理</span>
              <p>分析一下 A 站昨晚回水温度过低的原因，并给出处理建议。</p>
            </div>
            <div class="chat-bubble agent">
              <span class="speaker">Project Agent</span>
              <p>已拆分为 3 个子任务：读取时序数据、检索运行规程、比对历史维修事件。</p>
            </div>
            <div class="chat-bubble agent">
              <span class="speaker">Analysis Agent</span>
              <p>23:10 到 00:05 期间回水温度连续低于基线 2.8 摄氏度，同时阀位波动明显。</p>
            </div>
            <div class="chat-bubble agent">
              <span class="speaker">Knowledge Agent</span>
              <p>根据规程 4.2，这类温差异常需要优先排查阀门执行状态与末端负荷突增。</p>
            </div>
            <div class="chat-bubble agent">
              <span class="speaker">Forecast Agent</span>
              <p>昨晚外部气温下降 3.1 摄氏度，但不足以单独解释这次回水异常，怀疑存在局部调控问题。</p>
            </div>
          </div>

          <div class="recommendation-grid" style="margin-top: 18px;">
            <div class="recommendation-card">
              <h4>异常结论</h4>
              <p>A 站回水温度偏低更可能是“局部阀位执行异常 + 短时负荷波动”叠加造成。</p>
            </div>
            <div class="recommendation-card">
              <h4>建议动作</h4>
              <p>先做阀门状态复核，再进行 5% 以内的试探性调节，并观察 20 分钟回水变化。</p>
            </div>
            <div class="recommendation-card">
              <h4>风险等级</h4>
              <p>建议动作涉及调控参数变更，需 Manager Agent 审计并由项目经理审批后执行。</p>
            </div>
          </div>
        </section>

        <section class="surface-card">
          <div class="section-title">
            <div>
              <h3>Agent 工作轨迹</h3>
              <p>这是右侧必须保留的部分，否则页面会退化成普通聊天机器人。</p>
            </div>
          </div>
          <div class="timeline-list">
            <div class="timeline-item">
              <strong>23:12 Project Agent 路由任务</strong>
              <p>唤醒 Analysis Agent、Knowledge Agent、Forecast Agent。</p>
            </div>
            <div class="timeline-item">
              <strong>23:12 调用时序数据</strong>
              <p>station_timeseries_apr.csv / 节点 A / 时间窗口 22:00-00:30</p>
            </div>
            <div class="timeline-item">
              <strong>23:13 检索规程</strong>
              <p>命中《供热运行规程》第 4.2 节和历史故障案例 2 条。</p>
            </div>
            <div class="timeline-item">
              <strong>23:14 触发风险审计</strong>
              <p>建议动作包含参数调整，已交由 Manager Agent 审计。</p>
            </div>
          </div>

          <div class="footer-note" style="margin-top: 16px;">
            这里后续可以继续增强成“可展开的证据链视图”，点开后能看到具体时序图、规程摘录和历史工单引用。
          </div>
        </section>
      </div>
    </div>
  `;
}

function renderGovernance() {
  return `
    <div class="view">
      <div class="governance-grid">
        <section class="surface-card">
          <div class="section-title">
            <div>
              <h3>项目态势</h3>
              <p>适合给管理层看“项目在哪、风险在哪、哪些地方值得关注”。</p>
            </div>
          </div>
          <div class="list-stack">
            <div class="list-item">
              <strong>朝阳区智慧供热改造</strong>
              <p>活跃度高，今日产生 11 次 Agent 协作，2 条建议待审批。</p>
            </div>
            <div class="list-item">
              <strong>海淀热源调优试点</strong>
              <p>负荷预测准确率 93%，本周暂无高风险动作。</p>
            </div>
            <div class="list-item">
              <strong>客服投诉联动项目</strong>
              <p>今日新增投诉 7 条，系统已自动生成 3 条排查建议。</p>
            </div>
          </div>
        </section>

        <section class="surface-card">
          <div class="section-title">
            <div>
              <h3>风险与冲突总览</h3>
              <p>这是 B 端可信度的关键页，不只是统计图，而是要能看清具体风险对象。</p>
            </div>
          </div>
          <div class="audit-list">
            <div class="audit-item">
              <strong>高风险建议已拦截</strong>
              <p>A 站调泵建议超出安全阈值预设范围，Manager Agent 已阻断自动执行。</p>
            </div>
            <div class="audit-item">
              <strong>资源冲突待协调</strong>
              <p>“朝阳区项目”和“海淀项目”同时请求调用同一调控泵资源。</p>
            </div>
            <div class="audit-item">
              <strong>审批超时提醒</strong>
              <p>有 1 项夜间调控建议超过 20 分钟未获人工处理。</p>
            </div>
          </div>
        </section>

        <section class="surface-card">
          <div class="section-title">
            <div>
              <h3>系统资源监控</h3>
              <p>把 Agent 调用和平台运行指标统一展示，体现平台化能力。</p>
            </div>
          </div>
          <div class="tiny-kpi">
            <div class="row"><span>今日 Token 消耗</span><strong>182k</strong></div>
            <div class="row"><span>平均响应时延</span><strong>2.4s</strong></div>
            <div class="row"><span>图谱查询耗时</span><strong>380ms</strong></div>
            <div class="row"><span>Agent 调用次数</span><strong>246</strong></div>
          </div>
        </section>
      </div>

      <div class="hero-grid">
        <section class="surface-card">
          <div class="section-title">
            <div>
              <h3>审计日志</h3>
              <p>任何建议动作、拦截、审批、权限变化都应该有时间线。</p>
            </div>
          </div>
          <div class="timeline-list">
            <div class="timeline-item">
              <strong>09:18 Manager Agent</strong>
              <p>拦截 A 站 8% 调泵建议，原因：超过项目预设安全阈值。</p>
            </div>
            <div class="timeline-item">
              <strong>09:22 项目经理</strong>
              <p>批准“阀位状态复核 + 5% 以内试探性调节”的替代建议。</p>
            </div>
            <div class="timeline-item">
              <strong>09:40 知识工程 Agent</strong>
              <p>补充入库 1 份维修报告，并重建 A 站关联规则节点。</p>
            </div>
          </div>
        </section>

        <section class="surface-card">
          <div class="section-title">
            <div>
              <h3>权限层级</h3>
              <p>要把“谁能看、谁能建议、谁能拦截、谁能批准”讲明白。</p>
            </div>
          </div>
          <div class="pill-row">
            <span class="pill is-rose">管理 Agent：Audit & Stop</span>
            <span class="pill is-amber">项目 Agent：Read & Suggest</span>
            <span class="pill is-blue">知识工程 Agent：Build & Validate</span>
            <span class="pill">基础 Agent：Read Only / Analyse</span>
            <span class="pill is-mint">人类用户：Final Approve</span>
          </div>
        </section>
      </div>
    </div>
  `;
}

function renderAgents() {
  return `
    <div class="view">
      <section class="agent-grid">
        <article class="agent-card create-card">
          <div class="card-avatar">+</div>
          <h4>新增能力包</h4>
          <p>后续可以接入新的专业 Agent 或企业工具技能，继续行业化复制。</p>
          <div class="card-actions">
            <button class="button-secondary">创建 Agent</button>
          </div>
        </article>

        ${agentCard({
          icon: "知",
          title: "知识工程 Agent",
          desc: "接入规程、日志、台账和时序数据，做 Schema 识别、结构化和图谱映射，是整个产品最贴近你们公司基因的核心能力。",
          tags: ["数据接入", "图谱构建", "知识校验"],
          badgeClass: "is-mint",
        })}
        ${agentCard({
          icon: "负",
          title: "负荷预测 Agent",
          desc: "结合时序数据、天气和历史模式做负荷趋势预测，为异常解释和调控建议提供前置判断。",
          tags: ["预测", "外部因素", "趋势判断"],
          badgeClass: "is-blue",
        })}
        ${agentCard({
          icon: "衡",
          title: "水力平衡 Agent",
          desc: "围绕压差、流量和站点工况做平衡分析，更适合在项目作战室中被 Project Agent 按需唤醒。",
          tags: ["平衡分析", "调控建议", "约束校验"],
          badgeClass: "is-amber",
        })}
        ${agentCard({
          icon: "项",
          title: "项目 Agent",
          desc: "作为每个项目工作区的编排器，负责拆解任务、唤醒专业 Agent、汇总结论和保留项目级记忆。",
          tags: ["项目编排", "群聊入口", "项目记忆"],
          badgeClass: "is-blue",
        })}
        ${agentCard({
          icon: "管",
          title: "Manager Agent",
          desc: "站在所有项目之上做审计、熔断和资源协调，让这套系统真正具备企业级治理属性。",
          tags: ["审计", "熔断", "冲突协调"],
          badgeClass: "is-rose",
        })}
      </section>

      <div class="settings-grid">
        <section class="surface-card">
          <div class="section-title">
            <div>
              <h3>能力装配关系</h3>
              <p>这页不是单纯展示卡片，而是向客户说明系统如何从通用底座变成行业方案。</p>
            </div>
          </div>
          <div class="list-stack">
            <div class="list-item">
              <strong>基础 Agent 层</strong>
              <p>知识工程、负荷预测、水力平衡、异常分析等可复用能力。</p>
            </div>
            <div class="list-item">
              <strong>项目 Agent 层</strong>
              <p>把基础能力组装成项目级工作流，并绑定项目数据、项目记忆和审批链。</p>
            </div>
            <div class="list-item">
              <strong>Skill / Tool 层</strong>
              <p>报告导出、图表生成、PPT 生成、数据库查询、外部 API 等执行工具。</p>
            </div>
          </div>
        </section>

        <section class="surface-card">
          <div class="section-title">
            <div>
              <h3>未来扩展位</h3>
              <p>这部分能帮助你们把产品讲成平台，而不是一个只服务热力的单点 Demo。</p>
            </div>
          </div>
          <div class="pill-row">
            <span class="pill">接入天气 API</span>
            <span class="pill">接入能源价格 API</span>
            <span class="pill">移动审批</span>
            <span class="pill">报表生成 Skill</span>
            <span class="pill">工单系统 Connector</span>
            <span class="pill">PLC / DCS 网关</span>
          </div>
        </section>
      </div>
    </div>
  `;
}

function agentCard({ icon, title, desc, tags, badgeClass }) {
  return `
    <article class="agent-card">
      <div class="card-avatar">${icon}</div>
      <div>
        <h4>${title}</h4>
        <p>${desc}</p>
      </div>
      <div class="tag-row">
        ${tags
          .map((tag, index) => `<span class="tag ${index === 0 ? badgeClass : ""}">${tag}</span>`)
          .join("")}
      </div>
      <div class="card-actions">
        <button class="button">查看详情</button>
        <button class="button-secondary">加入项目</button>
      </div>
    </article>
  `;
}

function renderView() {
  switch (state.view) {
    case "coldstart":
      return renderColdStart();
    case "graph":
      return renderGraphCenter();
    case "warroom":
      return renderWarRoom();
    case "governance":
      return renderGovernance();
    case "agents":
      return renderAgents();
    case "workspace":
    default:
      return renderWorkspace();
  }
}

function render() {
  navItems.forEach((item) => {
    item.classList.toggle("active", item.dataset.view === state.view);
  });

  const meta = pageMeta[state.view];
  eyebrow.textContent = meta.eyebrow;
  pageTitle.textContent = meta.title;
  pageDescription.textContent = meta.description;

  renderSegments();
  contentShell.innerHTML = renderView();
}

render();
