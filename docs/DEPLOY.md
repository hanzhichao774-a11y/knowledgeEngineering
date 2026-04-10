# 部署与启动指南

## 整体架构

```
浏览器 (localhost:5173)
  │
  │  REST + WebSocket
  ▼
Frontend (React + Vite)          ← npm run dev
  │
  │  HTTP → localhost:3001/api
  ▼
Backend (Fastify + TypeScript)   ← npm run dev
  │
  ├─→ KodaX (npm 本地包)         ← 库引用，无需单独启动
  ├─→ GraphifyBridge             ← 子进程调用 Python，无需单独启动
  │     └─→ .venv/bin/python (graphify-v3)
  ├─→ .kodax/skills/ (SKILL.md)  ← 文件读取，无需单独启动
  └─→ Neo4j (bolt://localhost:7687) ← 需提前启动
```

**关键点**：只需启动 **后端** + **前端** + **Neo4j** 三个服务，其余组件均为库引用或子进程调用。

| 组件 | 启动方式 | 说明 |
|------|---------|------|
| Frontend | `npm run dev` | Vite 开发服务器，端口 5173 |
| Backend | `npm run dev` | Fastify 服务，端口 3001 |
| Neo4j | Docker 或 Desktop | 图数据库，端口 7687 |
| KodaX | **无需启动** | 作为 npm 包 `"kodax": "file:../../KodaX"` 被 backend 引用 |
| gateway/ | **无需启动** | 技能定义和提示词文件，被代码直接读取 |
| graphify Python | **无需启动** | 通过 `GraphifyBridge` 以 `child_process.execFile` 子进程方式按需调用 |
| .kodax/skills/ | **无需启动** | KodaX 运行时读取 SKILL.md 文件，无独立进程 |

---

## 前提条件

| 依赖 | 版本要求 | 用途 |
|------|---------|------|
| Node.js | ≥ 18 | 后端 + 前端 |
| Python | ≥ 3.10 | graphify-v3 知识工程管线 |
| Neo4j | 5.x | 图数据库存储知识图谱 |
| KodaX 仓库 | 最新 | Agent 编排框架（本地 npm 包引用） |
| Docker（可选） | 任意 | 运行 Neo4j 容器 |

---

## 一、环境准备（首次）

### 1.1 克隆项目

```bash
git clone <仓库地址> knowledgeEngineeringDemo
cd knowledgeEngineeringDemo
```

### 1.2 克隆 KodaX（上级目录）

```bash
cd ..
git clone https://github.com/icetomoyo/KodaX.git
cd KodaX
npm install && npm run build:packages
cd ../knowledgeEngineeringDemo
```

> backend/package.json 中通过 `"kodax": "file:../../KodaX"` 引用，所以 KodaX 需放在项目的上两级目录。

### 1.3 Python 虚拟环境

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install graphify-v3   # 或项目指定的 graphify 包
```

### 1.4 安装前后端依赖

```bash
# 后端
cd backend && npm install && cd ..

# 前端
cd frontend && npm install && cd ..
```

### 1.5 配置环境变量

在 `backend/.env` 中配置：

```env
# ─── 必填 ───
MINIMAX_API_KEY=your_minimax_api_key    # MiniMax LLM API Key
PORT=3001                                # 后端端口

# ─── Neo4j ───
NEO4J_URI=bolt://localhost:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=your_password             # 不设密码则使用内存 Mock

# ─── Graphify Python ───
GRAPHIFY_PYTHON=/绝对路径/knowledgeEngineeringDemo/.venv/bin/python
GRAPHIFY_WORKSPACE=/绝对路径/knowledgeEngineeringDemo/graphify-workspace

# ─── 可选 ───
HF_ENDPOINT=https://hf-mirror.com       # HuggingFace 镜像（国内环境）
DOCLING_API_URL=http://localhost:5001    # Docling 服务（如使用）
```

> **注意**：`GRAPHIFY_PYTHON` 和 `GRAPHIFY_WORKSPACE` 必须使用绝对路径。

---

## 二、启动服务

### 2.1 启动 Neo4j

**Docker 方式（推荐）：**

```bash
docker run -d \
  --name neo4j \
  -p 7474:7474 -p 7687:7687 \
  -e NEO4J_AUTH=neo4j/your_password \
  neo4j:5
```

管理界面：`http://localhost:7474`

**或使用 Neo4j Desktop**，创建本地数据库并启动。

### 2.2 启动后端（终端 1）

```bash
cd backend
npm run dev
```

- 监听 `http://localhost:3001`
- `tsx watch` 模式，代码变更自动热重载
- 启动时自动连接 Neo4j（如已配置密码）
- 启动日志应显示 `Server listening on http://0.0.0.0:3001`

### 2.3 启动前端（终端 2）

```bash
cd frontend
npm run dev
```

- 监听 `http://localhost:5173`
- Vite HMR 热更新
- 自动连接后端 `http://localhost:3001/api`

### 2.4 访问应用

浏览器打开 **http://localhost:5173**

---

## 三、组件关系说明

### KodaX — 为什么不需要单独启动？

KodaX 是一个 npm 包，在 `backend/package.json` 中以本地路径引用：

```json
"kodax": "file:../../KodaX"
```

后端代码直接 import 使用：

```typescript
import { runKodaX } from 'kodax';
```

它作为库被 backend 进程加载，没有独立的服务端口或进程。

### graphify Python — 为什么不需要单独启动？

graphify 的 Python 函数（detect、normalize、extract、build 等）通过 `GraphifyBridge` 服务以**子进程**方式调用：

```
Backend GraphifyBridge.detect()
  → child_process.execFile(GRAPHIFY_PYTHON, ['-c', 'from graphify.detect import detect; ...'])
  → Python 子进程执行完返回 JSON
  → 子进程退出
```

每次调用按需启动 Python 进程，执行完自动退出，不是常驻服务。只需确保 `.env` 中 `GRAPHIFY_PYTHON` 指向正确的 Python 解释器路径，且该虚拟环境已安装 graphify 包。

### gateway/ — 为什么不需要单独启动？

`gateway/` 目录包含技能定义文件（`skills/docx/SKILL.md` 等）和提示词（`agent/src/prompts.ts`）。这些文件：
- 已被复制到 `.kodax/skills/` 供 KodaX 运行时读取
- 被 backend 代码直接 import 引用
- 不包含任何可执行服务

---

## 四、生产部署

### 构建

```bash
# 前端构建
cd frontend && npm run build    # 产物 → frontend/dist/

# 后端构建
cd backend && npm run build     # 产物 → backend/dist/
```

### 生产启动

```bash
cd backend
node dist/index.js
```

后端通过 `@fastify/static` 同时托管 `frontend/dist/` 静态文件，生产环境只需启动后端一个服务。

访问 `http://localhost:3001` 即可使用完整应用。

---

## 五、常见问题

**Q: 后端报 `EADDRINUSE: address already in use 0.0.0.0:3001`？**
端口被占用。`tsx watch` 热重载时偶发。执行 `lsof -ti:3001 | xargs kill -9` 清理后重启。

**Q: 前端启动后页面空白？**
检查 `frontend/src/main.tsx` 是否正确引入，以及 `styles/global.css` 是否已导入。

**Q: graphify Python 调用超时？**
`GraphifyBridge` 默认超时 300 秒。大文件（多个 PDF）处理时间可能超过此限制。可在 `GraphifyBridge.ts` 中调整 `timeoutMs` 参数。同时检查 `graphify-workspace/raw/` 中是否有过多重复文件，清理后重试。

**Q: WebSocket 连不上？**
确认后端已启动且 `VITE_API_URL` 配置正确。开发环境下前端默认连接 `ws://localhost:3001/ws`。

**Q: Neo4j 连接失败？**
如不需要真实图数据库，确保 `.env` 中不设置 `NEO4J_PASSWORD`，系统会自动使用 Mock 数据。

**Q: KodaX import 失败？**
确认上级目录存在 KodaX 仓库且已执行 `npm install && npm run build:packages`。检查 `../../KodaX/package.json` 是否存在。

**Q: `GRAPHIFY_PYTHON` 路径不对？**
运行 `which python3` 或 `.venv/bin/python --version` 确认路径，必须使用绝对路径。虚拟环境中需已安装 graphify：`pip list | grep graphify`。

---

## 六、快速启动速查

```bash
# 0. 确保 Neo4j 已运行
docker start neo4j

# 1. 终端 1 — 后端
cd /path/to/knowledgeEngineeringDemo/backend && npm run dev

# 2. 终端 2 — 前端
cd /path/to/knowledgeEngineeringDemo/frontend && npm run dev

# 3. 浏览器
open http://localhost:5173
```
