# Agent OS MVP 集成说明

`knowledgeEngineering / gateway / graphify` 的当前资源已经足够支撑一个可运行的 Agent OS MVP。

这份文档的目标不是设计一个完整的 Agent OS，而是明确当前三个部分的职责边界、调用关系和最小迁移路径，使系统可以尽快跑通，并为后续演进保留清晰接口。

## 1. 集成目标

MVP 阶段的目标是：

- 保留现有 `frontend` 和 `backend` 的主要交互路径
- 将所有 LLM 相关能力逐步收口到 `gateway`
- 将知识编译、知识查询和知识健康检查收口到 `graphify`
- 让 `knowledgeEngineering` 继续作为 Agent OS 的应用主体
- 在不追求完善治理和复杂拆分的前提下，形成一个可以运行、可以演示、可以继续扩展的系统

本阶段不追求：

- 完整的多租户和权限平台
- 完整的 Agent Registry 平台
- 分布式任务编排
- 云端部署一致性
- 所有模块物理拆分为独立服务

## 2. 当前工程定位

### 2.1 knowledgeEngineering

`knowledgeEngineering` 是 Agent OS 的主体工程，负责：

- 前端交互界面
- 后端 REST / WebSocket API
- 任务状态与进度管理
- 文件上传和业务编排
- 最终结果聚合与对前端输出

它是用户真正使用的应用壳。

### 2.2 gateway

`gateway` 是 LLM 和 Agent 执行平面，负责：

- 模型调用
- agent runtime
- skills / tools 执行
- prompt 与上下文装配
- provider 切换和失败重试

它不应直接承担前端任务状态，也不应直接对前端暴露业务 API。

### 2.3 graphify

`graphify` 是知识运行时，负责：

- 原始资料编译
- 规范化 sidecar
- graph / records / reports / health / memory 资产生成
- 增量更新
- 基于知识资产的查询和健康检查

它不是主应用，也不是前台 agent，而是知识底座。

## 3. 推荐目标架构

```text
Frontend
  -> Backend
      -> Gateway
      -> Graphify Runtime
      -> Neo4j
      -> Docling / 文件系统

Gateway
  -> open-agent-sdk-typescript
  -> skills
  -> provider adapters

Graphify Runtime
  -> graphify-out/
  -> graph / records / reports / health / memory
```

MVP 阶段推荐采用逻辑分层、物理尽量少拆的方式：

- 前端仍由 `knowledgeEngineering/frontend` 提供
- 后端仍由 `knowledgeEngineering/backend` 提供
- `gateway` 先作为后端调用的独立模块或本地服务使用
- `graphify` 先作为本地能力侧车使用

重点是先把边界整理干净，而不是优先做服务数量扩张。

## 4. 模块职责

### 4.1 Frontend

只负责：

- 用户输入
- 任务列表
- 进度状态
- 结果展示
- 图谱展示

不负责：

- 直接调用 LLM
- 直接访问 graphify
- 直接管理 agent 生命周期

### 4.2 Backend

负责：

- REST / WebSocket
- 任务创建、状态更新、结果聚合
- 上传流程协调
- 业务工作流编排
- 调用 gateway
- 调用 graphify

不负责：

- 直接持有 provider SDK
- 长期持有 prompt 模板
- 扩展 skill 细节

### 4.3 Gateway

负责：

- 所有 LLM 调用
- agent runtime
- skills / tools / hooks
- 模型选择与 provider fallback
- 子 agent 或技能执行

不负责：

- 业务任务状态管理
- 前端接口协议
- 文件上传管理
- 知识资产存储

### 4.4 Graphify

负责：

- 知识编译
- 知识资产持久化
- 问答检索输入准备
- 记录检索
- health / freshness / coverage 反馈

不负责：

- UI
- 任务流程状态
- 模型 provider 管理

## 5. 边界规则

以下规则作为 MVP 阶段的强约束：

1. Backend 不再直接调用具体模型 provider。
2. Backend 不再直接持有长期 prompt 模板。
3. 所有 LLM 相关执行必须经由 gateway。
4. 所有知识相关编译和知识查询能力优先经由 graphify。
5. Frontend 不直接接触 gateway 或 graphify。
6. Frontend 到 Backend 的现有交互协议尽量不变。
7. Gateway 不直接承担任务列表、步骤状态、WebSocket 广播。
8. Graphify 不直接承担业务任务状态和页面展示。

## 6. MVP 工作流

### 6.1 Ingest 工作流

目标：上传资料，生成知识结果并写入知识资产和图数据库。

```text
用户上传文件
  -> Backend 创建任务
  -> Backend 调用文档解析能力（Docling / 本地解析）
  -> Backend 调用 Gateway 执行 LLM 步骤
  -> Backend 调用 Graphify 进行知识编译 / 更新
  -> Backend 写入 Neo4j
  -> Backend 聚合结果并推送前端
```

MVP 阶段保留现有 5 步知识工程流程，不强制重写业务编排。

### 6.2 Query 工作流

目标：用户对话提问，从已有知识库中返回整理好的结果。

```text
用户提问
  -> Backend 创建任务
  -> Backend 调用 Graphify 检索知识资产
  -> Backend 调用 Gateway 进行答案生成 / 结果整理
  -> Backend 返回结构化结果
  -> Frontend 展示结论、证据、图谱或表格
```

Query 工作流是 MVP 的关键，因为它最能体现 Agent OS 的持续知识价值。

## 7. 迁移范围

### 7.1 迁入 Gateway 的能力

以下能力建议逐步迁入 gateway：

- 意图分类
- 本体提取
- Schema 构建中的 LLM 步骤
- 查询答案生成
- 提示词封装
- skill/tool 调度
- provider fallback

### 7.2 暂时保留在 Backend 的能力

以下能力暂时继续保留在 backend：

- 文件上传
- REST / WebSocket
- 任务创建与任务状态
- 进度事件广播
- 结果聚合
- Docling 调用
- Neo4j 写入协调

### 7.3 迁入 Graphify 的能力

以下能力建议逐步经由 graphify 提供：

- 知识编译
- 知识资产生成
- graph / records / report / health 管理
- 基于知识资产的问答支持
- 基于记录的检索
- freshness / coverage 状态反馈

## 8. 最小接口契约

MVP 阶段不要求接口一次性完美，但必须先定义稳定的输入输出。

### 8.1 Backend -> Gateway

建议至少定义以下逻辑接口：

#### `intent.classify`

输入：

- `taskId`
- `query`
- `hasFile`
- `workspaceId`

输出：

- `intent`
- `reason`
- `usage`
- `traceId`

#### `skill.run`

输入：

- `taskId`
- `skillName`
- `input`
- `context`
- `workspaceId`

输出：

- `status`
- `result`
- `usage`
- `traceId`

#### `answer.generate`

输入：

- `taskId`
- `question`
- `retrievalContext`
- `workspaceId`

输出：

- `answer`
- `citations`
- `usage`
- `traceId`

#### `health.ping`

输入：

- `none`

输出：

- `ok`
- `providerStatus`
- `skillCount`

### 8.2 Backend -> Graphify

建议至少定义以下逻辑接口：

#### `kb.rebuild`

输入：

- `workspacePath`
- `changedFiles?`

输出：

- `snapshotId`
- `nodeCount`
- `edgeCount`
- `updatedAt`

#### `kb.ask`

输入：

- `question`
- `workspacePath`
- `format`

输出：

- `answer`
- `evidence`
- `snapshotId`
- `freshness`

#### `kb.searchRecords`

输入：

- `query`
- `workspacePath`

输出：

- `records`
- `snapshotId`

#### `kb.getHealth`

输入：

- `workspacePath`

输出：

- `coverage`
- `gaps`
- `warnings`

#### `kb.export`

输入：

- `resultId`
- `format`

输出：

- `artifactPath`
- `mimeType`

## 9. Backward Compatibility 原则

MVP 阶段遵循以下兼容原则：

- 不主动重写前端页面逻辑
- 不主动重写后端任务状态结构
- 不主动更改现有 WebSocket 事件类型
- 优先替换 Backend 内部依赖，而不是前端接口协议

这意味着：

- 前端可以继续使用当前 `task.created`、`task.status`、`agent.message` 等事件
- 后端内部只需把直接调用 LLM 的部分替换为 GatewayClient
- 后端内部只需把知识相关能力替换为 GraphifyClient

## 10. 迁移顺序

建议按以下顺序落地：

### 阶段 1：Gateway Facade

- 在 backend 内新增 `GatewayClient`
- 暂时保留现有 agent/worker 流程
- 用 `GatewayClient` 替换直接 `callLLM()` 调用

目标：

- Backend 业务流程不变
- LLM 能力开始经由 gateway 统一出口

### 阶段 2：Query 接 Graphify

- 为 query 流程新增 `GraphifyClient`
- 将知识检索与知识健康检查接到 graphify
- 保留现有 Neo4j 读取逻辑作为 fallback

目标：

- Query 流程能体现 graphify 的知识底座价值

### 阶段 3：Ingest 后知识更新

- 在 ingest 流程完成后触发 graphify rebuild
- 将 graphify 结果作为知识资产副本
- Neo4j 保留为图展示和现有业务依赖

目标：

- ingest 与 knowledge runtime 形成闭环

### 阶段 4：收口 Prompt 与 Skill

- Backend 中残留的 prompt 逐步迁出
- skill 元数据迁到 gateway
- Backend 只保留业务编排

目标：

- Backend 逐步回归业务层

## 11. 失败与降级策略

### 11.1 Gateway 不可用

- 当前任务步骤直接失败
- 任务状态清晰反馈到前端
- 不做静默降级

### 11.2 Graphify 不可用

- Query 阶段可暂时回退到现有 Neo4j 或现有检索路径
- 返回结果中标记“未使用知识资产增强”

### 11.3 Neo4j 不可用

- 允许基于 graphify 资产返回文本型结果
- 图谱展示模块可提示不可用

### 11.4 Docling 不可用

- 允许降级到基础文档解析
- 在结果中提示质量可能下降

## 12. MVP 完成标准

满足以下条件即可判定 MVP 集成完成：

1. 前端页面无需重写即可继续使用。
2. Backend 不再直接依赖具体模型 provider。
3. Gateway 成为唯一 LLM 入口。
4. 至少 1 条 ingest 工作流跑通。
5. 至少 1 条 query 工作流跑通。
6. Query 或 ingest 中至少一条链路接入 graphify。
7. 出错时前端能看到明确任务状态。

## 13. 明确不做

以下内容不属于当前 MVP 目标：

- 多租户
- 完整 RBAC / ABAC
- 分布式队列与复杂调度系统
- 云端同步
- 动态插件市场
- 完整知识治理审批流
- 全量微服务拆分
- 一次性把所有 skill 和知识能力全部重写

## 14. 下一步文档

在本说明完成后，建议继续补两份配套文档：

1. `GATEWAY_API_CONTRACT.md`
   定义 backend 与 gateway 的请求/响应格式

2. `GRAPHIFY_RUNTIME_CONTRACT.md`
   定义 backend 与 graphify 的最小调用契约、freshness、snapshot 和 fallback 规则

这两份文档会直接决定实际拼接成本。
