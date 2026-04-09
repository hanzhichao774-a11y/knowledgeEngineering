# BizAgentOS · 知识工程数字员工 Demo

知识工程端到端闭环演示系统。用户上传企业制度文档，管理智能体自动委派知识工程数字员工，依次完成文档解析、本体提取、Schema 构建、图数据库写入、知识图谱生成 5 个步骤，全过程实时可视化。

## 架构概览

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React + Vite)                   │
│  ┌──────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │LeftPanel │  │ CenterPanel  │  │     RightPanel         │ │
│  │任务/进度  │  │  对话流       │  │ 结果/智能体/图谱       │ │
│  │/资源消耗  │  │  输入框       │  │ (SchemaTable/Graph)   │ │
│  └──────────┘  └──────────────┘  └────────────────────────┘ │
│                        │ WebSocket + REST                    │
├─────────────────────────────────────────────────────────────┤
│                   Backend (Fastify + TypeScript)              │
│  ┌────────────┐  ┌─────────────────┐  ┌──────────────────┐  │
│  │ REST API   │  │ WebSocket 推送   │  │ File Upload      │  │
│  └─────┬──────┘  └────────┬────────┘  └──────────────────┘  │
│        │                  │                                   │
│  ┌─────┴──────────────────┴────────┐                         │
│  │       KodaX Agent Layer         │                         │
│  │  ManagerAgent → KEWorker        │                         │
│  │  Skills: 文档解析/本体提取/      │                         │
│  │  Schema构建/图DB写入/图谱生成    │                         │
│  └─────────────────┬───────────────┘                         │
│                    │                                          │
│  ┌─────────────────┴───────────────┐                         │
│  │         Neo4j 图数据库           │                         │
│  └─────────────────────────────────┘                         │
└─────────────────────────────────────────────────────────────┘
```

## 技术栈

| 层次 | 技术 | 说明 |
|------|------|------|
| 前端框架 | React 19 + TypeScript | Vite 构建 |
| 状态管理 | Zustand | 轻量 store (task/chat/result) |
| 图谱可视化 | react-force-graph-2d | Canvas 力导向图 |
| 图标 | Lucide React | SVG 图标库 |
| 后端框架 | Fastify + TypeScript | 高性能 Node.js 服务 |
| 实时通信 | @fastify/websocket | 双向 WebSocket |
| 文件上传 | @fastify/multipart | 50MB 限制 |
| 知识工程管线 | graphify-v3 | LLM Wiki 实现：normalize → extract → build → cluster → export |
| PDF 解析 | pypdf + MinerU 3.0 | 混合模式：pypdf 快速文本提取 + MinerU 仅 OCR 图片页 |
| 多格式支持 | exceljs / mammoth | Excel 原生解析 + Word 转 Markdown |
| Agent 底座 | KodaX | 独立仓库引用 |
| LLM | MiniMax M2.7 | 语义提取 + 社区命名 + 答案生成 |
| 图数据库 | Neo4j | Bolt 协议连接，graphify push_to_neo4j |

## 目录结构

```
knowledgeEngineeringDemo/
├── frontend/                     # React + Vite + TypeScript
│   ├── src/
│   │   ├── components/
│   │   │   ├── Layout/           # AppShell, Header, Footer
│   │   │   ├── LeftPanel/        # TaskList, StepProgress, CostPanel
│   │   │   ├── CenterPanel/      # ChatArea, MessageBubble, InputArea
│   │   │   └── RightPanel/       # ResultTab, AgentTab, GraphTab
│   │   ├── hooks/                # useMockFlow, useWebSocket
│   │   ├── store/                # taskStore, chatStore, resultStore
│   │   ├── types/                # TypeScript 类型定义
│   │   ├── services/             # API client (axios)
│   │   └── styles/               # CSS 变量, 全局样式
│   └── package.json
├── backend/                      # Fastify + TypeScript
│   ├── src/
│   │   ├── routes/               # task, chat, graph, upload
│   │   ├── services/             # TaskService, GraphService
│   │   ├── agents/               # ManagerAgent, KEWorker
│   │   ├── skills/               # 5 个 Skill 模块
│   │   ├── websocket/            # WebSocket handler + broadcast
│   │   └── db/                   # Neo4j 连接和读写
│   └── package.json
├── KodaX/                        # (需手动克隆，已 gitignore)
├── knowledgeEngineeringDemo.html # 交互原型参考
├── agentDemo.html                # 旧 Demo 参考
└── 4-15-Demo计划.md              # 项目计划文档
```

## 快速启动

### 前置条件

- Node.js >= 18.0.0
- npm
- Python >= 3.10（推荐 3.12，`brew install python@3.12`）
- Neo4j（`brew install neo4j` 或 Docker）

### 1. 克隆项目

```bash
git clone https://github.com/hanzhichao774-a11y/knowledgeEngineering.git
cd knowledgeEngineering
```

### 2. 克隆 KodaX（可选，Agent 集成时需要）

```bash
git clone https://github.com/icetomoyo/KodaX.git
```

### 3. 安装依赖

```bash
# 前端
cd frontend && npm install

# 后端
cd ../backend && npm install
```

### 4. 安装 Python 环境和 graphify-v3

```bash
# 创建虚拟环境
python3.12 -m venv .venv
source .venv/bin/activate

# 安装 graphify-v3 及其依赖
pip install -e "graphify-v3[all]"

# 安装 MinerU（用于图片表格 OCR）
pip install "mineru[core]"
```

> **MinerU 首次运行说明**：首次处理 PDF 时会从 HuggingFace 下载模型文件（约 1-2GB）。国内用户会自动使用 `hf-mirror.com` 镜像加速。模型下载后会缓存到本地，后续运行无需重复下载。

> **MinerU 混合模式**：系统采用混合 PDF 解析策略——pypdf 快速提取文本（~0.4s），MinerU 仅处理纯图片页的 OCR（~37s/2 张图），避免全文档 MinerU 解析的 8.8 分钟开销。无图片页的 PDF 处理速度与未安装 MinerU 时一致。

### 5. 启动开发服务器

```bash
# 终端 1: 启动前端 (端口 5173)
cd frontend && npm run dev

# 终端 2: 启动后端 (端口 3001)
cd backend && npm run dev
```

前端访问 http://localhost:5173，后端 API 在 http://localhost:3001。

### 6. 配置 LLM API Key

在 `backend/.env` 文件中配置：

```env
MINIMAX_API_KEY=your_api_key
NEO4J_URI=bolt://localhost:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=your_neo4j_password
GRAPHIFY_PYTHON=/path/to/project/.venv/bin/python   # 可选，默认自动检测
GRAPHIFY_WORKSPACE=/path/to/project/graphify-workspace  # 可选，默认项目根目录
```

### 7. Mock 模式

前端访问 `http://localhost:5173?mock=true` 可使用 Mock 演示模式（无需后端和 LLM）。

### 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | 3001 | 后端端口 |
| `MINIMAX_API_KEY` | (必填) | MiniMax LLM API Key |
| `VITE_API_URL` | http://localhost:3001 | 前端连接后端地址 |
| `NEO4J_URI` | bolt://localhost:7687 | Neo4j 连接地址 |
| `NEO4J_USERNAME` | neo4j | Neo4j 用户名 |
| `NEO4J_PASSWORD` | (空) | Neo4j 密码，未配置时使用 Mock 模式 |
| `DOCLING_API_URL` | http://localhost:5001 | Docling REST API 地址 |
| `ENABLE_VISION_CHANNEL` | false | 设为 `true` 启用 MiniMax-VL 视觉双通道校验 |

## 使用方式

### 真实模式

1. 设置 `MINIMAX_API_KEY` 环境变量
2. 启动后端：`cd backend && npm run dev`
3. 启动前端：`cd frontend && npm run dev`
4. 访问 `http://localhost:5173`
5. 上传文档或输入指令，后端调用真实 LLM 执行知识工程 pipeline

### Mock 演示模式

访问 `http://localhost:5173?mock=true`，页面自动播放 28 秒完整流程动画：

1. 用户上传「企业信息安全管理制度.pdf」
2. 管理智能体分析任务并委派给知识工程数字员工 #KE-01
3. 数字员工依次执行 5 步：文档解析 → 本体提取 → Schema 构建 → 图数据库写入 → 知识图谱生成
4. 执行过程中实时展示：当前步骤、Token 消耗、Skill 调用、中间产物
5. 完成后可查看：本体提取结果表格、RDF Schema、文档摘要、力导向知识图谱

## 相关文档

- [后端 API 文档](backend/API.md)
- [前端组件文档](frontend/COMPONENTS.md)
- [部署指南](docs/DEPLOY.md)
- [工程纪律](docs/ENGINEERING.md)
- [问题排查手册](docs/TROUBLESHOOT.md)
- [变更记录](CHANGELOG.md)
- [Demo 计划](4-15-Demo计划.md)
