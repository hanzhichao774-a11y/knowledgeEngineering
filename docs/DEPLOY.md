# 部署指南

## 开发环境

### 前端开发服务器

```bash
cd frontend
npm install
npm run dev
```

Vite 开发服务器默认运行在 `http://localhost:5173`，支持 HMR 热更新。

**API 代理配置：** 如需在开发模式下代理后端请求，可在 `vite.config.ts` 中添加：

```typescript
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
      '/ws': {
        target: 'ws://localhost:3001',
        ws: true,
      },
    },
  },
});
```

配置代理后，前端代码中的 `VITE_API_URL` 可设为空字符串（使用相对路径）。

### 后端开发服务器

```bash
cd backend
npm install
npm run dev
```

使用 `tsx watch` 运行，文件变更自动重启。默认端口 `3001`。

---

## 生产环境

### 前端构建

```bash
cd frontend
npm run build
```

产物输出到 `frontend/dist/`，纯静态文件。

### 后端构建

```bash
cd backend
npm run build
```

TypeScript 编译到 `backend/dist/`。

### 生产启动

```bash
cd backend
node dist/index.js
```

后端会同时托管前端静态文件（从 `frontend/dist/` 目录），所以生产环境只需启动后端服务即可。

访问 `http://localhost:3001` 即可同时使用前端和 API。

### Mock 模式

不需要真实 LLM 和 Neo4j 时，使用 mock 模式：

```bash
# 开发环境
npm run dev -- --mock

# 生产环境
node dist/index.js --mock
```

Mock 模式下创建任务后会自动模拟 5 步执行流程。

---

## 环境变量

### 后端

在 `backend/` 目录下创建 `.env` 文件：

```env
# 服务端口（默认 3001）
PORT=3001

# Neo4j 连接（不配置密码时自动使用 Mock）
NEO4J_URI=bolt://localhost:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=your_password
```

### 前端

在 `frontend/` 目录下创建 `.env` 文件：

```env
# 后端 API 地址（默认 http://localhost:3001）
VITE_API_URL=http://localhost:3001
```

生产环境中若前后端同域部署，可设为空字符串：

```env
VITE_API_URL=
```

---

## Neo4j 配置

### 安装 Neo4j

**Docker（推荐）：**

```bash
docker run -d \
  --name neo4j \
  -p 7474:7474 -p 7687:7687 \
  -e NEO4J_AUTH=neo4j/your_password \
  neo4j:5
```

管理界面：`http://localhost:7474`

### 连接验证

后端启动时如果 `NEO4J_PASSWORD` 为空，会输出警告并自动跳过 Neo4j 连接，使用内存 Mock 数据。

配置密码后，后端启动日志会显示 `Neo4j connected to bolt://localhost:7687`。

---

## 前后端联调

### 方案 A：独立启动（推荐开发时使用）

```
前端 http://localhost:5173  →  后端 http://localhost:3001
```

前端通过 `VITE_API_URL` 环境变量或 Vite proxy 连接后端。

WebSocket 地址由 `api.ts` 中 `getWsUrl()` 自动从 HTTP 地址转换：
- `http://localhost:3001` → `ws://localhost:3001/ws`

### 方案 B：后端托管前端（推荐生产时使用）

```bash
cd frontend && npm run build    # 构建前端到 dist/
cd ../backend && node dist/index.js   # 后端同时托管静态文件
```

后端通过 `@fastify/static` 托管 `frontend/dist/` 目录，所有请求走同一个端口。

---

## KodaX 依赖

KodaX 是独立仓库，本项目中 Agent 集成部分依赖它。

```bash
# 克隆到项目根目录
git clone https://github.com/icetomoyo/KodaX.git

# 构建 KodaX
cd KodaX
npm install
npm run build:packages
```

如果不使用 KodaX Agent 功能（仅运行 Mock 模式），无需克隆此仓库。

---

## 常见问题

**Q: 前端启动后页面空白？**
检查 `frontend/src/main.tsx` 是否正确引入了 `App`，以及 `styles/global.css` 是否在 `App.tsx` 中导入。

**Q: 后端报 "root path must exist"？**
这是 `@fastify/static` 插件的警告，表示 `frontend/dist/` 目录不存在。开发环境下可忽略（前端由 Vite 独立提供）。生产环境下先执行 `cd frontend && npm run build`。

**Q: WebSocket 连不上？**
确认后端已启动且 `VITE_API_URL` 配置正确。开发环境下前端默认连接 `ws://localhost:3001/ws`。

**Q: Neo4j 连接失败？**
如不需要真实图数据库，确保 `.env` 中不设置 `NEO4J_PASSWORD`，系统会自动使用 Mock 数据。
