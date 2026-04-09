# Graphify Runtime Contract

本文档定义 `knowledgeEngineering/backend` 与 `graphify` 之间的最小运行时契约。

目标是在 MVP 阶段将 `graphify` 作为知识运行时接入 `knowledgeEngineering`，为查询、知识编译、健康检查提供统一边界，而不要求一次性完成所有能力抽象。

## 1. 角色定位

`graphify` 在 Agent OS 中的职责是知识运行时：

- 编译原始资料为知识资产
- 提供图谱与记录层检索
- 输出知识健康状态
- 维护 `graphify-out/` 资产目录

`backend` 在与 `graphify` 对接时，只应关注以下问题：

- 何时触发重建
- 何时发起查询
- 何时读取 health
- 何时向上游返回 freshness / snapshot 信息

backend 不应深入依赖 `graphify` 内部文件布局以外的实现细节。

## 2. 运行形态

MVP 阶段允许以下实现方式：

### 2.1 首选：本地 Adapter

由 backend 内部的 `GraphifyClient` 调用本地 graphify 能力。

底层可以是：

- Python 模块调用
- Python CLI 调用
- 本地 sidecar 进程

### 2.2 可选：MCP 访问

如果后续希望让 gateway 或其他 agent 直接访问 graphify，可通过 MCP 方式暴露。

graphify 当前已经具备 MCP 服务能力，见：

- [serve.py](/Users/zhangchuang/claude/graphify-v3/graphify/serve.py)

但 MVP 阶段 backend 与 graphify 之间无需强制采用 MCP。

## 3. 知识资产边界

graphify 的运行结果以 `graphify-out/` 为中心。

对 backend 有意义的重点资产包括：

- `graphify-out/assets.json`
- `graphify-out/graph/graph.json`
- `graphify-out/records/records.jsonl`
- `graphify-out/reports/GRAPH_REPORT.md`
- `graphify-out/health/health.json`
- `graphify-out/health/HEALTH_REPORT.md`

这些资产由 `build_knowledge_assets()` 统一整理，见：

- [assets.py](/Users/zhangchuang/claude/graphify-v3/graphify/assets.py#L225)

## 4. 契约目标

backend 只依赖以下五类能力：

1. `kb.rebuild`
2. `kb.ask`
3. `kb.searchRecords`
4. `kb.getHealth`
5. `kb.getSnapshotStatus`

MVP 阶段不要求 graphify 直接负责：

- Word / Excel 导出
- 前端图形格式转换
- 前端任务状态
- 业务工作流编排

## 5. Snapshot 概念

为避免 backend 直接依赖文件时间戳的零散逻辑，MVP 阶段引入一个轻量快照概念：

### 5.1 Snapshot 定义

一个 snapshot 指一次 graphify 运行后生成的一组知识资产状态。

建议至少包含：

- `snapshotId`
- `workspacePath`
- `updatedAt`
- `assetRoot`
- `graphPath`
- `recordCount`
- `nodeCount`
- `edgeCount`

### 5.2 MVP 生成方式

MVP 阶段允许使用以下任一方式生成 `snapshotId`：

- `assets.json` 的生成时间
- `graph.json` 的修改时间
- 自定义 hash
- backend 分配的 rebuild run id

重点不在实现，而在 backend 能够拿到一个明确的“当前知识版本标识”。

## 6. 接口清单

### 6.1 `kb.rebuild`

用于在资料变更后重建或刷新知识资产。

#### 输入

```json
{
  "workspacePath": "/absolute/path/to/workspace",
  "mode": "full",
  "changedFiles": [],
  "requestedBy": "backend",
  "reason": "post_ingest_refresh"
}
```

#### 输出

```json
{
  "ok": true,
  "snapshotId": "snapshot_20260409_001",
  "assetRoot": "/absolute/path/to/workspace/graphify-out",
  "graphPath": "/absolute/path/to/workspace/graphify-out/graph/graph.json",
  "nodeCount": 1268,
  "edgeCount": 2022,
  "recordCount": 340,
  "updatedAt": "2026-04-09T01:10:00Z"
}
```

#### 说明

- `mode` MVP 阶段建议支持：
  - `full`
  - `incremental`
- 如果当前 graphify CLI 尚未固化出统一 rebuild 命令，允许由本地 adapter 封装内部 pipeline。
- backend 不感知 graphify 的具体执行脚本，只感知契约返回值。

### 6.2 `kb.ask`

用于从知识资产生成回答或证据包。

#### 输入

```json
{
  "workspacePath": "/absolute/path/to/workspace",
  "question": "制度中对访问控制有什么要求？",
  "format": "structured",
  "topN": 5
}
```

#### 输出

```json
{
  "ok": true,
  "snapshotId": "snapshot_20260409_001",
  "freshness": {
    "status": "fresh",
    "updatedAt": "2026-04-09T01:10:00Z"
  },
  "answer": "...",
  "evidence": {
    "graphEvidence": [],
    "recordEvidence": []
  }
}
```

#### 说明

- 该能力可映射到：
  - `graphify.agent.answer()`
  - `graphify agent "<question>" --format ...`
  - MCP `ask_kb`
- graphify 当前支持 `direct` / `evidence` / `structured` / `artifact`，见：
  - [agent.py](/Users/zhangchuang/claude/graphify-v3/graphify/agent.py#L173)
  - [serve.py](/Users/zhangchuang/claude/graphify-v3/graphify/serve.py#L219)

### 6.3 `kb.searchRecords`

用于检索结构化记录层。

#### 输入

```json
{
  "workspacePath": "/absolute/path/to/workspace",
  "query": "海淀分公司诉求总量",
  "topN": 10
}
```

#### 输出

```json
{
  "ok": true,
  "snapshotId": "snapshot_20260409_001",
  "records": [
    {
      "score": 0.92,
      "source": "records.jsonl",
      "data": {}
    }
  ]
}
```

#### 说明

- 该能力可映射到：
  - `graphify.agent.search_records()`
  - MCP `search_records`
- 对 backend 而言，它是 query 工作流中“精确事实层”的来源。

### 6.4 `kb.getHealth`

用于获取知识库当前健康状态。

#### 输入

```json
{
  "workspacePath": "/absolute/path/to/workspace"
}
```

#### 输出

```json
{
  "ok": true,
  "snapshotId": "snapshot_20260409_001",
  "health": {
    "warnings": [],
    "coverage": {},
    "ambiguousEdges": 0
  },
  "healthPath": "/absolute/path/to/workspace/graphify-out/health/health.json"
}
```

#### 说明

- 该能力可映射到：
  - 读取 `graphify-out/health/health.json`
  - CLI `graphify health`
  - MCP `get_health`
- graphify 当前 health 资产由：
  - [health.py](/Users/zhangchuang/claude/graphify-v3/graphify/health.py)
  - [assets.py](/Users/zhangchuang/claude/graphify-v3/graphify/assets.py#L254)
 生成。

### 6.5 `kb.getSnapshotStatus`

用于返回当前知识库可用性和 freshness。

#### 输入

```json
{
  "workspacePath": "/absolute/path/to/workspace"
}
```

#### 输出

```json
{
  "ok": true,
  "exists": true,
  "snapshotId": "snapshot_20260409_001",
  "freshness": {
    "status": "fresh",
    "updatedAt": "2026-04-09T01:10:00Z"
  },
  "assetRoot": "/absolute/path/to/workspace/graphify-out"
}
```

#### 说明

- 这是 backend 决定“是否直接回答”还是“先触发重建”的依据。
- MVP 阶段允许基于 `assets.json`、`graph.json` 和 `health.json` 的存在性加时间戳进行判断。

## 7. transport 与实现映射

### 7.1 MVP 推荐实现

建议 backend 内部提供一个 `GraphifyClient`，对外暴露：

- `rebuild()`
- `ask()`
- `searchRecords()`
- `getHealth()`
- `getSnapshotStatus()`

### 7.2 允许的底层实现

#### 方案 A：Python 模块 Adapter

优点：

- 能力最完整
- 直接映射 graphify 模块

缺点：

- Node backend 与 Python 集成成本稍高

#### 方案 B：CLI Adapter

优点：

- 拼接快
- 易于调试

缺点：

- rebuild 能力可能需要额外封装
- 返回结构需要额外解析

#### 方案 C：MCP Adapter

优点：

- 对 agent 生态友好
- 与 gateway 兼容性更好

缺点：

- 对 backend 来说比本地 adapter 更重

MVP 阶段推荐：

- rebuild 用本地 adapter
- ask / search / health 可直接映射到现有 graphify 能力

## 8. Freshness 策略

backend 在 query 场景中建议使用以下策略：

### 8.1 `fresh`

- 最近一次重建成功
- graph / records / health 资产齐全
- 可直接回答

### 8.2 `stale`

- 资产存在，但更新时间超过阈值
- 可先回答，再提示“知识库可能过期”
- 可异步触发 rebuild

### 8.3 `missing`

- 关键资产缺失
- backend 应明确返回“知识库未就绪”
- 可自动触发 rebuild

## 9. 错误模型

建议统一以下错误码：

- `KB_NOT_FOUND`
- `KB_NOT_READY`
- `KB_REBUILD_FAILED`
- `KB_QUERY_FAILED`
- `KB_HEALTH_UNAVAILABLE`
- `KB_TIMEOUT`
- `KB_INTERNAL_ERROR`

失败响应建议：

```json
{
  "ok": false,
  "error": {
    "code": "KB_NOT_READY",
    "message": "Knowledge base assets are not available yet",
    "retryable": true
  }
}
```

## 10. backend 接入建议

backend 中建议新增统一 `GraphifyClient`。

backend 只能通过它访问 graphify，避免把 `graphify-out/` 的内部路径逻辑散落到各个 route、service 和 worker 中。

推荐由 `GraphifyClient` 屏蔽以下细节：

- Python 调用方式
- CLI 参数
- MCP 接入细节
- snapshotId 生成规则
- asset 文件路径解析

## 11. fallback 策略

### 11.1 Query

- graphify 可用：优先使用 graphify
- graphify 不可用：回退到现有 Neo4j / 旧检索流程

### 11.2 Ingest

- graphify rebuild 成功：写入新 snapshot
- graphify rebuild 失败：业务流程可继续，但需把知识状态标记为未刷新

### 11.3 Health

- health 不可读：视为 `stale`
- 但不要阻塞 query 文本回答

## 12. MVP 完成标准

满足以下条件即可认为 graphify runtime 契约生效：

1. backend 中存在统一 `GraphifyClient`。
2. query 至少有一条路径通过 graphify 获取结果。
3. ingest 完成后至少有一条路径能触发 graphify 更新。
4. backend 能识别知识库是否 `fresh / stale / missing`。
5. graphify 不可用时，系统有明确 fallback。

## 13. 下一步演进

MVP 之后可继续扩展：

- `kb.watch`
- `kb.getCommunity`
- `kb.shortestPath`
- `kb.exportArtifact`
- `kb.writeMemory`
- `kb.listSnapshots`

但这些不属于当前阶段的最小必需项。
