# 前端组件文档

## 组件架构

```
App
└── AppShell (三栏布局)
    ├── Header (顶部导航)
    ├── LeftPanel
    │   ├── TaskList (任务列表)
    │   ├── StepProgress (执行进度)
    │   └── CostPanel (资源消耗)
    ├── CenterPanel
    │   ├── ChatArea (消息流)
    │   │   └── MessageBubble (消息气泡)
    │   └── InputArea (输入框 + 文件上传)
    ├── RightPanel
    │   ├── ResultTab (产出结果)
    │   ├── AgentTab (智能体详情)
    │   └── GraphTab (知识图谱)
    └── Footer (页脚)
```

---

## Layout 组件

### AppShell

三栏布局容器，CSS Grid 实现。

**文件：** `components/Layout/AppShell.tsx`

**Props：**

| 属性 | 类型 | 说明 |
|------|------|------|
| left | ReactNode | 左侧面板内容 |
| center | ReactNode | 中间面板内容 |
| right | ReactNode | 右侧面板内容 |

**布局：** `grid-template: 48px 1fr 32px / 220px minmax(300px, 1fr) minmax(300px, 380px)`

### Header

顶部导航栏。固定展示 Logo、系统状态、LLM 标签和用户信息。

**文件：** `components/Layout/Header.tsx`

### Footer

页脚。固定展示版本号和 KodaX 链接。

**文件：** `components/Layout/Footer.tsx`

---

## LeftPanel 组件

### TaskList

任务列表。展示所有任务的标题、状态和时间，支持点击切换当前任务。

**文件：** `components/LeftPanel/TaskList.tsx`

**数据来源：** `useTaskStore` — `tasks`, `activeTaskId`, `setActiveTask`

**状态映射：**

| status | 图标 | 文本 |
|--------|------|------|
| queued | ⏳ | 排队中 |
| running | 🔄 | 执行中 |
| completed | ✅ | 已完成 |
| failed | ❌ | 失败 |

### StepProgress

执行进度。以时间线形式展示当前任务的 5 个步骤及其状态。

**文件：** `components/LeftPanel/StepProgress.tsx`

**数据来源：** `useTaskStore` — 当前激活任务的 `steps` 数组

**步骤状态样式：**
- `done` — 绿色圆点 + ✓
- `running` — 黄色圆点 + 脉冲动画
- `pending` — 灰色空心圆点

### CostPanel

资源消耗面板。展示输入/输出 Token、预估费用和已用时间。

**文件：** `components/LeftPanel/CostPanel.tsx`

**数据来源：** `useTaskStore` — 当前激活任务的 `cost` 对象

---

## CenterPanel 组件

### ChatArea

消息流容器。滚动展示所有聊天消息，新消息自动滚动到底部。

**文件：** `components/CenterPanel/ChatArea.tsx`

**数据来源：** `useChatStore` — `messages`

### MessageBubble

单条消息气泡。根据角色展示不同样式，支持附件、AgentStatus 卡片和思考指示器。

**文件：** `components/CenterPanel/MessageBubble.tsx`

**Props：**

| 属性 | 类型 | 说明 |
|------|------|------|
| msg | ChatMessage | 消息对象 |

**角色样式：**

| role | 头像 | 背景色 | 标签 |
|------|------|--------|------|
| user | 👤 | 蓝色 | 用户 |
| manager | 🧠 | 紫色 | 管理 |
| worker | 📝 | 绿色 | 数字员工 |
| system | ⚙️ | 灰色 | 系统 |

**子元素（按条件渲染）：**
- `msg.attachment` → 文件预览卡片
- `msg.agentStatus` → Agent 状态卡片（Skill 标签 + Token 进度条 + 状态）
- `msg.thinking` → 思考动画指示器

### InputArea

输入区域。包含文本输入框、文件上传按钮和发送按钮。

**文件：** `components/CenterPanel/InputArea.tsx`

**Props：**

| 属性 | 类型 | 说明 |
|------|------|------|
| onSend | (text: string) => void | 发送文本回调 |
| onFileUpload | (file: File) => void | 上传文件回调 |
| disabled | boolean? | 禁用状态 |

**支持的文件类型：** `.pdf`, `.doc`, `.docx`, `.xls`, `.xlsx`

---

## RightPanel 组件

右侧面板包含三个 Tab：产出结果、智能体、图谱。

**文件：** `components/RightPanel/index.tsx`

**Tab 切换：** `useResultStore` — `activeTab`, `setActiveTab`

### ResultTab

产出结果展示。包含本体提取表格、Schema 代码块和文档摘要三个卡片。

**文件：** `components/RightPanel/ResultTab.tsx`

**数据来源：** `useResultStore`

| 数据 | 展示形式 |
|------|----------|
| ontologyResult | 表格（名称 / 类型标签 / 描述） |
| schemaContent | 代码块（语法高亮 HTML） |
| documentSummary | 文本卡片 |

**类型标签颜色：**
- `entity` — 蓝色
- `relation` — 橙色
- `attr` — 紫色

### AgentTab

智能体详情。展示当前数字员工的指标卡片和 Skills 列表。

**文件：** `components/RightPanel/AgentTab.tsx`

**数据来源：** `useResultStore` — `agentDetail`

**指标卡片（2x2 网格）：** 输入 Token / 输出 Token / 执行耗时 / 当前步骤

### GraphTab

知识图谱力导向图。使用 `react-force-graph-2d` 渲染 Canvas 图谱。

**文件：** `components/RightPanel/GraphTab.tsx`

**数据来源：** `useResultStore` — `graphData`

**节点样式（Canvas 自定义绘制）：**

| type | 颜色 | 背景 |
|------|------|------|
| entity | #3b82f6 (蓝) | rgba(59,130,246,0.12) |
| concept | #22c55e (绿) | rgba(34,197,94,0.12) |
| rule | #a855f7 (紫) | rgba(168,85,247,0.12) |

**交互：** 支持缩放、拖拽节点

---

## Zustand Stores

### useTaskStore

**文件：** `store/taskStore.ts`

| State | 类型 | 说明 |
|-------|------|------|
| tasks | Task[] | 任务列表 |
| activeTaskId | string \| null | 当前选中的任务 ID |

| Action | 参数 | 说明 |
|--------|------|------|
| setActiveTask | id: string | 切换当前任务 |
| addTask | task: Task | 添加任务 |
| updateStep | taskId, stepIndex, updates | 更新步骤状态 |
| updateCost | taskId, cost | 更新资源消耗 |
| updateTaskStatus | taskId, status | 更新任务状态 |
| getActiveTask | — | 获取当前任务（getter） |

### useChatStore

**文件：** `store/chatStore.ts`

| State | 类型 | 说明 |
|-------|------|------|
| messages | ChatMessage[] | 消息列表 |

| Action | 参数 | 说明 |
|--------|------|------|
| addMessage | msg: ChatMessage | 添加消息 |
| setMessages | msgs: ChatMessage[] | 批量设置 |
| clearMessages | — | 清空 |

### useResultStore

**文件：** `store/resultStore.ts`

| State | 类型 | 默认值 | 说明 |
|-------|------|--------|------|
| activeTab | RightTab | 'result' | 右侧面板当前 Tab |
| ontologyResult | OntologyResult \| null | null | 本体提取结果 |
| schemaContent | string \| null | null | Schema HTML 内容 |
| schemaStatus | 'pending' \| 'building' \| 'done' | 'pending' | Schema 构建状态 |
| schemaProgress | number | 0 | Schema 构建进度 (%) |
| documentSummary | string \| null | null | 文档摘要 |
| graphData | GraphData \| null | null | 图谱数据 |
| agentDetail | AgentDetail \| null | null | 智能体详情 |

所有 state 均有对应的 `set*` action。

---

## Hooks

### useMockFlow

Mock 演示流程 Hook。页面加载时自动初始化 3 个任务并播放完整的 5 步执行动画。

**文件：** `hooks/useMockFlow.ts`

**返回：** `{ initialize: () => void }`

**时间线（约 28 秒）：**
- 0.3s — 用户消息
- 1.5s — 管理智能体委派
- 2.5s~5.5s — Step 1 文档解析
- 6.5s~11s — Step 2 本体提取
- 12.5s~17s — Step 3 Schema 构建
- 18.5s~21.5s — Step 4 图数据库写入
- 22.5s~26s — Step 5 知识图谱生成
- 27.5s — 管理智能体完成总结

### useWebSocket

WebSocket 连接管理 Hook。自动重连（3 秒间隔）。

**文件：** `hooks/useWebSocket.ts`

**参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| url | string | WebSocket 地址 |
| onMessage | (data: any) => void | 消息处理回调 |

**返回：** `{ send: (data: unknown) => void }`

---

## TypeScript 类型

所有类型定义在 `types/index.ts`，关键类型：

- **Task** — 任务（含 steps、cost）
- **Step** — 执行步骤
- **CostInfo** — 资源消耗
- **ChatMessage** — 聊天消息
- **AgentStatus** — 智能体执行状态卡片数据
- **OntologyResult / OntologyEntity** — 本体提取结果
- **GraphData / GraphNode / GraphEdge** — 图谱数据
- **AgentDetail / SkillInfo** — 智能体详情
- **WSEvent** — WebSocket 事件联合类型
- **RightTab** — 右侧面板 Tab 类型

## 样式系统

全局 CSS 变量定义在 `styles/variables.css`，暗色主题。组件样式使用 CSS Modules (`.module.css`)。

关键变量：`--bg`, `--bg-secondary`, `--bg-tertiary`, `--border`, `--text`, `--accent`, `--green`, `--yellow`, `--blue`, `--purple`, `--orange`, `--radius`
