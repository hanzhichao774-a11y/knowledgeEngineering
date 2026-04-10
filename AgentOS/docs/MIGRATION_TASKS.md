# Agent OS 迁移任务清单

## 1. 文档目的

本文件用于总结 `AgentOS/` 从 `knowledgeEngineering/` 孵化目录迁移为独立项目的任务范围、当前状态和执行顺序。

当前口径已经明确：

- `AgentOS/` 是正式项目
- `knowledgeEngineering/` 只承担孕育作用
- 最终目标是将 `AgentOS/` 整体迁移到 `/Users/zhangchuang/claude/AgentOS`
- 迁移完成后，`AgentOS` 不能依赖 `knowledgeEngineering` 下的任何运行时代码或相对路径

相关架构边界见 [ARCHITECTURE.md](/Users/zhangchuang/claude/knowledgeEngineering/AgentOS/docs/ARCHITECTURE.md)。

## 2. 迁移目标

迁移后的 `Agent OS` 维持三层主结构：

1. `Agent OS Web`
2. `Agent OS API`
3. `Agent Runtime Gateway`

其中：

- `graphify` 归属 `Agent Runtime Gateway`
- 一个项目对应一个知识库
- 文件上传后进入项目工作目录
- 知识库构建阶段由 Codex 在项目目录执行 `graphify` skill
- 知识问答阶段直接基于已有 `graphify` 资产回答，不再依赖 Codex

## 3. 当前状态

### 已完成

- [x] 已创建独立目录：`AgentOS/frontend`、`AgentOS/backend`、`AgentOS/docs`
- [x] 前端已具备独立路由项目页，支持 `/projects/:projectId/conversations/:conversationId`
- [x] 项目页已实现 3 个工作区：`群聊`、`项目资料`、`任务历史`
- [x] 项目群聊已接后端问答接口，并支持 Markdown 渲染
- [x] 前端已形成单项目工作台形态：左侧历史对话，中间聊天，右侧参与 Agent
- [x] 后端已提供最小接口：
  - `GET /api/projects`
  - `POST /api/projects/:projectId/chat`
- [x] 后端已能直接挂载现成 `graphify` 快照并完成知识问答

### 当前遗留问题

- [ ] `项目资料` 仍是前端暂存，未接真实上传接口
- [ ] `任务历史` 仍主要来自静态项目摘要，未接真实任务流
- [ ] 后端默认仍依赖父级目录中的 `graphify-workspace` 和 `graphify-v3`
- [ ] 当前只有“使用现成知识库问答”，还没有“上传文件 -> 构建知识库”闭环
- [ ] 项目数据仍是单项目静态种子，不是可新增、可持久化的项目系统

## 4. 当前残留的外部依赖

这是迁移前必须清掉的重点。

### 4.1 运行时路径依赖

当前 `AgentOS/backend` 默认通过相对路径引用父级目录中的资源：

- `graphify-workspace`
- `graphify-v3`

这意味着当前 `AgentOS/` 还不能直接搬走，否则现有问答链路会失效。

### 4.2 知识库资产依赖

当前项目“北京热力集团智能体建设”挂载的是现成知识库快照，而不是 `AgentOS` 自己目录内生成的项目知识资产。

### 4.3 上传构建链路缺失

当前只有：

- 已有知识库 -> 问答

还没有：

- 上传文件 -> 保存到项目目录 -> 触发 build -> 生成项目知识库 -> 再问答

## 5. 迁移任务拆分

### P0. 项目自洽化

目标：让 `AgentOS/` 作为独立工程先跑通，不再依赖父级目录的代码和路径。

- [ ] 明确 `AgentOS` 根目录约定
- [ ] 在 `AgentOS/` 内补齐运行时目录，例如：
  - `runtime/projects/{projectId}/raw`
  - `runtime/projects/{projectId}/graphify-out`
  - `runtime/projects/{projectId}/meta`
- [ ] 去掉后端对 `../../../../graphify-workspace` 的默认引用
- [ ] 去掉后端对 `../../../../../graphify-v3` 的默认引用
- [ ] 统一环境变量入口和 `.env.example`

### P1. Web 前端闭环

目标：把当前展示型项目前端，推进成最小可用工作台。

- [ ] `项目资料` 接入真实上传接口
- [ ] 上传文件后刷新资料列表，不再只做前端暂存
- [ ] `任务历史` 改为读取后端任务记录
- [ ] 群聊消息中的“证据 / snapshot / freshness”继续结构化展示
- [ ] 明确“知识库构建中 / 已完成 / 失败 / 需重建”的前端状态

### P2. API 最小能力

目标：让 `Agent OS API` 真正成为项目壳和业务编排层。

建议最小接口集：

- [x] `GET /api/projects`
- [x] `POST /api/projects/:projectId/chat`
- [ ] `POST /api/projects`
- [ ] `POST /api/projects/:projectId/files`
- [ ] `GET /api/projects/:projectId/files`
- [ ] `POST /api/projects/:projectId/kb/build`
- [ ] `GET /api/projects/:projectId/kb/status`
- [ ] `GET /api/projects/:projectId/tasks`

职责要求：

- API 不直接深入 `graphify-out/` 内部实现
- API 只面向项目、文件、任务、知识库状态和问答能力编排

### P3. Runtime Gateway 落地

目标：把 `graphify` 真正收口到 `Agent Runtime Gateway`。

- [ ] 定义 `graphify runtime adapter`
- [ ] 定义 `Codex Execution Adapter`
- [ ] 统一 `build / ask / search / snapshot-status / health` 的调用边界
- [ ] 为项目级 build 加锁，避免同一项目并发重建
- [ ] 建立项目级 snapshot 元数据

这里的关键约束是：

- build 阶段依赖 Codex 执行 `graphify` skill
- ask 阶段直接读取项目知识资产，不再依赖 Codex

### P4. 项目知识库模型

目标：把“一个项目一个知识库”真正落到目录和状态模型里。

建议目录：

```text
AgentOS/runtime/projects/{projectId}/
  raw/
  graphify-out/
  meta/
```

建议状态：

- [ ] `empty`
- [ ] `dirty`
- [ ] `building`
- [ ] `ready`
- [ ] `failed`

建议规则：

- [ ] 上传文件只把知识库状态改成 `dirty`
- [ ] 只有 build 成功后才切到 `ready`
- [ ] `dirty` 时允许基于上一个 snapshot 继续问答，但要提示“知识库待刷新”

### P5. 数据与资产迁移

目标：把当前“北京热力集团智能体建设”项目从示例挂载状态迁移成真正项目资产。

- [ ] 为该项目建立自己的项目目录
- [ ] 将主文件纳入项目资料目录管理
- [ ] 将现成知识库资产迁移到项目自己的 `graphify-out/`
- [ ] 校验 `snapshotId / freshness / graph / records / health` 是否完整
- [ ] 将当前问答链路切到项目本地资产

### P6. 切出孵化仓

目标：把 `AgentOS/` 作为完整工程挪到 `/Users/zhangchuang/claude/AgentOS`。

- [ ] `AgentOS` 在当前目录下已不依赖任何父级相对路径
- [ ] `npm install`
- [ ] `frontend` 可单独启动
- [ ] `backend` 可单独启动
- [ ] 上传 / build / ask 最小闭环跑通
- [ ] 文档、环境变量、脚本路径全部更新
- [ ] 将目录整体迁移到 `/Users/zhangchuang/claude/AgentOS`

## 6. 推荐执行顺序

建议按下面顺序推进，不要并行做太多层。

1. 先清理 `AgentOS` 对父级目录的运行时依赖
2. 再补 `上传文件 -> 项目资料入库`
3. 然后补 `Codex build graphify`
4. 再补 `知识库状态 / 任务历史`
5. 最后再做目录整体迁移

## 7. 当前最小闭环定义

达到下面 5 条，就可以认为 `AgentOS` 已具备可迁移条件：

1. 能创建项目
2. 能上传项目文件
3. 能在项目目录触发 `graphify` build
4. 能基于项目自己的 `graphify-out` 回答问题
5. 将 `AgentOS/` 单独移出后仍可独立运行

## 8. 当前建议优先级

如果只做最近一轮，建议优先完成下面 3 项：

1. `项目资料` 接真实上传接口
2. `Runtime Gateway` 补 `Codex build graphify` 适配层
3. 把当前北京热力项目的知识资产迁移到 `AgentOS/runtime/projects/project-beijing-heating-agent-os/`

这 3 件做完，`AgentOS` 才算从“挂着父级能力的前端原型 + 后端样板”进入“可独立搬迁的最小系统”。
