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
| 文档解析 | Docling (Docker) | IBM 开源 TableFormer，表格精度 97.9% |
| 多格式支持 | exceljs / mammoth | Excel 原生解析 + Word 转 Markdown |
| Agent 底座 | KodaX | 独立仓库引用 |
| LLM | MiniMax（主）/ 千问（备） | 已采购 |
| 图数据库 | Neo4j | Bolt 协议连接 |

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
- Docker Desktop（用于 Docling 文档解析服务）
- Neo4j（`brew install neo4j` 或 Docker）
- GraphicsMagick + Ghostscript（`brew install graphicsmagick ghostscript`，PDF 转图片需要）

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

### 4. 启动 Docling 文档解析服务（Docker）

Docling 是 IBM 开源的文档解析引擎，使用 TableFormer 深度学习模型识别表格结构（精度 97.9%）。通过 Docker 容器本地部署：

```bash
# 首次启动（会自动拉取镜像，约 2-3GB）
docker run -d --name docling-serve -p 5001:5001 ghcr.io/docling-project/docling-serve-cpu:latest

# 验证服务是否就绪
curl http://localhost:5001/health
# 应返回: {"status":"ok"}
```

后续启动只需：

```bash
docker start docling-serve
```

> **注意**：如果 Docker Desktop 未运行，需先启动 Docker Desktop 应用，等待引擎就绪后再执行上述命令。

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
DOCLING_API_URL=http://localhost:5001
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
