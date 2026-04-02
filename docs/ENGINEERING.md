# 工程纪律

本文档定义 BizAgentOS 知识工程 Demo 项目的工程规范，所有参与者（含 AI 辅助开发）均需遵守。

---

## 1. Git 分支策略

```
main                          稳定分支，始终可运行
 ├── feat/xxx                 新功能
 ├── fix/xxx                  Bug 修复
 ├── refactor/xxx             重构（不改变外部行为）
 ├── docs/xxx                 纯文档修改
 └── chore/xxx                构建/依赖/工具链调整
```

**规则：**

- `main` 分支保持可编译、可运行状态，禁止直接推送未验证的代码
- 功能开发在 `feat/*` 分支进行，完成后通过 PR 合并到 `main`
- 小幅 Bug 修复和文档修改可直接在 `main` 上提交
- 分支命名格式：`<type>/<简短描述>`，如 `feat/upload-progress`、`fix/ws-reconnect`

---

## 2. Commit 规范

采用 [Conventional Commits](https://www.conventionalcommits.org/) 格式：

```
<type>(<scope>): <description>

[optional body]
```

### Type（必填）

| type | 用途 | 示例 |
|------|------|------|
| `feat` | 新功能 | `feat(frontend): add document upload progress bar` |
| `fix` | Bug 修复 | `fix(backend): handle empty file upload gracefully` |
| `refactor` | 重构 | `refactor(agent): extract skill execution into pipeline` |
| `docs` | 文档 | `docs: update API endpoint descriptions` |
| `style` | 样式/格式 | `style(frontend): adjust graph node colors` |
| `chore` | 构建/工具 | `chore: upgrade vite to v8.1` |
| `test` | 测试 | `test(backend): add task creation unit tests` |

### Scope（推荐填写）

| scope | 覆盖范围 |
|-------|----------|
| `frontend` | 前端 React 应用 |
| `backend` | 后端 Fastify 服务 |
| `agent` | Agent 层（ManagerAgent / KEWorker / Skills） |
| `graph` | 知识图谱相关（Neo4j / 可视化） |
| `docs` | 项目文档 |
| `ws` | WebSocket 通信 |

### Description（必填）

- 用英文，小写开头，不加句号
- 描述"做了什么"而非"改了哪个文件"
- 好：`add retry logic for websocket reconnection`
- 差：`modified useWebSocket.ts`

### Body（可选）

当改动需要解释"为什么"时添加，用空行与 description 隔开。

---

## 3. 变更分级制度

每次改动根据影响范围分为三个级别，对应不同的操作流程：

### S 级 — 新功能 / 架构变更

**判断标准：** 新增用户可见功能、修改核心架构、新增 API 端点、修改数据模型

**操作流程：**
1. 从 `main` 创建功能分支 `feat/*`
2. 开发并自测
3. 更新 CHANGELOG.md（在 `[Unreleased]` 下添加条目）
4. 同步更新受影响的文档（见第 4 节）
5. 提交 PR，合并到 `main`

**示例：** 接入真实 LLM、新增批量任务、重写图谱可视化组件

### A 级 — Bug 修复 / 性能优化

**判断标准：** 修复已有功能的缺陷、优化性能、改善用户体验

**操作流程：**
1. 可新建 `fix/*` 分支，也可直接在 `main` 上修改
2. 提交时 commit message 用 `fix` 类型
3. 如修复了用户可感知的 Bug，更新 CHANGELOG.md

**示例：** 修复 WebSocket 断线重连、修复消息滚动不到底部

### B 级 — 文档 / 样式微调

**判断标准：** 纯文档修改、CSS 微调、注释优化、依赖小版本升级

**操作流程：**
1. 直接在 `main` 上提交
2. commit message 用 `docs` / `style` / `chore` 类型
3. 无需更新 CHANGELOG

**示例：** 修正 README 拼写错误、调整面板间距、升级 eslint 插件版本

---

## 4. 文档同步规则

以下操作**必须**同步更新对应文档，否则视为未完成：

| 改动内容 | 需要更新的文档 |
|----------|----------------|
| 新增/修改/删除 REST API 端点 | `backend/API.md` |
| 新增/修改 WebSocket 事件类型 | `backend/API.md` |
| 新增/修改/删除前端组件 | `frontend/COMPONENTS.md` |
| 新增/修改 Zustand Store 或 Hook | `frontend/COMPONENTS.md` |
| 修改 TypeScript 核心类型定义 | `frontend/COMPONENTS.md` + `backend/API.md`（如涉及接口协议） |
| 修改启动方式或构建流程 | `docs/DEPLOY.md` |
| 新增/修改环境变量 | `docs/DEPLOY.md` + `README.md` |
| 新增外部依赖（npm 包） | `README.md`（技术栈表） |
| S 级变更 | `CHANGELOG.md` |

---

## 5. 版本号规则

采用 [语义化版本](https://semver.org/) `MAJOR.MINOR.PATCH`：

| 版本位 | 何时递增 | 示例 |
|--------|----------|------|
| MAJOR | 不兼容的 API 变更、架构重写 | 0.x → 1.0.0 |
| MINOR | 新增功能（向后兼容） | 0.1.0 → 0.2.0 |
| PATCH | Bug 修复、文档修正 | 0.1.0 → 0.1.1 |

**当前阶段**（0.x.x）为快速迭代期，不严格要求 MAJOR 递增规则。

**版本发布流程：**
1. 确认 `[Unreleased]` 中的 CHANGELOG 条目
2. 将 `[Unreleased]` 改为版本号和日期：`## [0.2.0] - 2025-04-15`
3. 更新 `package.json` 中的 `version` 字段
4. 提交 `chore: release v0.2.0`
5. 打 Git tag：`git tag v0.2.0`

---

## 6. 代码质量检查

### 提交前

- 前端：`cd frontend && npm run lint` 无错误
- 后端：`cd backend && npm run build` 编译通过

### PR 合并前

- 代码已自测，核心功能可运行
- commit message 符合 Conventional Commits 格式
- 受影响的文档已同步更新

---

## 7. 快速参考卡片

```
┌─ 改动前 ─────────────────────────────────────────────┐
│  1. 判断变更级别（S / A / B）                          │
│  2. S 级：创建功能分支；A/B 级：可直接 main            │
├─ 开发中 ─────────────────────────────────────────────┤
│  3. 代码改动                                           │
│  4. 跑 lint / build 确认无错                           │
├─ 提交时 ─────────────────────────────────────────────┤
│  5. git commit -m "type(scope): description"          │
│  6. S 级：更新 CHANGELOG.md                            │
│  7. 检查文档同步规则表，更新受影响的文档                  │
├─ 合并后 ─────────────────────────────────────────────┤
│  8. git push                                           │
│  9. 发布版本时：改 CHANGELOG 标题 + 更新 version + tag │
└──────────────────────────────────────────────────────┘
```
