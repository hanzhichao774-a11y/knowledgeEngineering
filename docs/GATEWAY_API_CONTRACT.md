# Gateway API Contract

本文档定义 `knowledgeEngineering/backend` 与 `gateway` 之间的最小契约。

目标不是一次性设计完整平台，而是为 MVP 阶段提供一套足够稳定的调用边界，使 backend 可以逐步摆脱直接调用 LLM provider 的实现，转而统一通过 gateway 执行所有模型相关能力。

## 1. 角色定位

`gateway` 是唯一的 LLM / Agent 执行入口，负责：

- 模型调用
- skills / tools 执行
- prompt 与上下文装配
- agent runtime
- provider fallback
- 失败重试和 usage 汇总

`backend` 继续负责：

- 任务创建与任务状态
- WebSocket 推送
- 文件上传
- 业务工作流编排
- 最终结果聚合与前端响应

换言之：

- backend 决定“做什么”
- gateway 决定“怎么调用模型来做”

## 2. MVP 约束

MVP 阶段的约束如下：

1. backend 不再直接持有具体 provider SDK。
2. backend 不再直接维护长期 prompt 模板。
3. 所有模型相关调用都通过 gateway 暴露的统一接口完成。
4. gateway 不管理 frontend 任务列表和页面状态。
5. gateway 不直接向 frontend 暴露业务接口。

## 3. 传输方式

MVP 阶段允许两种实现方式：

### 3.1 首选：本地 HTTP 服务

- backend 通过 localhost HTTP 调 gateway
- 优点是边界清晰，便于后续独立部署
- 推荐作为正式契约形态

### 3.2 过渡：同进程 Adapter

- backend 内部调用 gateway package
- 但必须保持与本文档一致的请求/响应结构
- 仅作为实现方式，不影响契约定义

无论采用哪一种方式，对 backend 而言，gateway 都应表现为一个独立执行平面。

## 4. 基础约定

### 4.1 基础路径

推荐基础路径：

`/api/gateway/v1`

### 4.2 通用 Header

建议 backend 每次调用都附带：

- `x-trace-id`
- `x-task-id`
- `x-workspace-id`
- `x-user-id`（如果当前阶段没有用户体系，可以先固定）

### 4.3 通用请求元信息

所有请求体中建议带上：

- `traceId`
- `taskId`
- `workspaceId`
- `requestedBy`

### 4.4 通用响应包裹格式

成功响应统一结构：

```json
{
  "ok": true,
  "traceId": "trace_xxx",
  "taskId": "task_xxx",
  "data": {},
  "usage": {
    "provider": "minimax",
    "model": "minimax-coding",
    "inputTokens": 1200,
    "outputTokens": 320,
    "totalTokens": 1520,
    "latencyMs": 1800
  },
  "meta": {
    "retryCount": 0,
    "fallbackUsed": false
  }
}
```

失败响应统一结构：

```json
{
  "ok": false,
  "traceId": "trace_xxx",
  "taskId": "task_xxx",
  "error": {
    "code": "PROVIDER_TIMEOUT",
    "message": "Gateway provider request timed out",
    "retryable": true,
    "details": {}
  }
}
```

## 5. 接口清单

MVP 阶段建议只实现 4 个接口。

### 5.1 `POST /api/gateway/v1/intent/classify`

用于分类当前任务属于：

- `ingest`
- `query`

#### 请求

```json
{
  "traceId": "trace_001",
  "taskId": "task_001",
  "workspaceId": "default",
  "query": "帮我基于已有知识回答这个问题",
  "hasFile": false,
  "context": {
    "neo4jConnected": true
  }
}
```

#### 响应

```json
{
  "ok": true,
  "traceId": "trace_001",
  "taskId": "task_001",
  "data": {
    "intent": "query",
    "reason": "未检测到附件，且问题语义更接近知识查询"
  },
  "usage": {
    "provider": "minimax",
    "model": "minimax-coding",
    "inputTokens": 180,
    "outputTokens": 8,
    "totalTokens": 188,
    "latencyMs": 420
  },
  "meta": {
    "retryCount": 0,
    "fallbackUsed": false
  }
}
```

#### 说明

- 这个接口是现有 `ManagerAgent.detectIntent()` 的替代入口。
- 如果 backend 已经通过确定性规则判断出结果，也可以跳过该接口。

### 5.2 `POST /api/gateway/v1/skills/run`

用于执行单个 LLM 驱动 skill。

MVP 阶段建议支持以下 skillName：

- `ontology-extract`
- `schema-build`
- `answer-generate`

#### 请求

```json
{
  "traceId": "trace_002",
  "taskId": "task_002",
  "workspaceId": "default",
  "skillName": "ontology-extract",
  "input": {
    "documentText": "....",
    "documentMeta": {
      "fileName": "企业制度.pdf"
    }
  },
  "context": {
    "previousResults": [],
    "businessMode": "knowledge-engineering"
  }
}
```

#### 响应

```json
{
  "ok": true,
  "traceId": "trace_002",
  "taskId": "task_002",
  "data": {
    "skillName": "ontology-extract",
    "status": "success",
    "result": {
      "entities": [],
      "relations": [],
      "rawText": "..."
    }
  },
  "usage": {
    "provider": "minimax",
    "model": "minimax-coding",
    "inputTokens": 2400,
    "outputTokens": 900,
    "totalTokens": 3300,
    "latencyMs": 3600
  },
  "meta": {
    "retryCount": 1,
    "fallbackUsed": false
  }
}
```

#### 说明

- 该接口是 backend worker pipeline 中 LLM 步骤的统一替代入口。
- 由 backend 决定 skill 顺序，gateway 只负责执行单步。

### 5.3 `POST /api/gateway/v1/answer/generate`

用于基于检索上下文生成最终回答或整理结果。

#### 请求

```json
{
  "traceId": "trace_003",
  "taskId": "task_003",
  "workspaceId": "default",
  "question": "制度中关于密码强度有什么要求？",
  "retrievalContext": {
    "graphEvidence": [],
    "recordEvidence": [],
    "neo4jEvidence": [],
    "healthWarnings": []
  },
  "outputMode": "structured"
}
```

#### 响应

```json
{
  "ok": true,
  "traceId": "trace_003",
  "taskId": "task_003",
  "data": {
    "answer": "密码应至少包含大小写字母、数字和特殊字符。",
    "sections": [
      {
        "type": "summary",
        "title": "结论",
        "content": "密码强度要求较高。"
      },
      {
        "type": "evidence",
        "title": "依据",
        "content": [
          "第 3.2 节明确提到密码强度要求"
        ]
      }
    ],
    "citations": [
      {
        "source": "企业信息安全管理制度.pdf",
        "location": "3.2"
      }
    ]
  },
  "usage": {
    "provider": "minimax",
    "model": "minimax-coding",
    "inputTokens": 1300,
    "outputTokens": 420,
    "totalTokens": 1720,
    "latencyMs": 1900
  },
  "meta": {
    "retryCount": 0,
    "fallbackUsed": false
  }
}
```

#### 说明

- 这是 `QueryWorker` 中“答案生成”步骤的标准入口。
- 推荐 `outputMode` 支持：
  - `text`
  - `structured`
  - `artifact-draft`

### 5.4 `GET /api/gateway/v1/health`

用于检查 gateway 自身状态。

#### 响应

```json
{
  "ok": true,
  "traceId": "trace_health",
  "data": {
    "status": "ok",
    "providers": [
      {
        "name": "minimax",
        "configured": true
      }
    ],
    "skills": [
      "ontology-extract",
      "schema-build",
      "answer-generate"
    ]
  }
}
```

#### 说明

- backend 启动时可用它做 readiness 检查
- frontend 不直接调用

## 6. 错误码

MVP 阶段建议统一以下错误码：

- `BAD_REQUEST`
- `SKILL_NOT_FOUND`
- `PROVIDER_NOT_CONFIGURED`
- `PROVIDER_TIMEOUT`
- `PROVIDER_EMPTY_RESPONSE`
- `PROVIDER_ERROR`
- `VALIDATION_ERROR`
- `INTERNAL_ERROR`

## 7. 超时与重试

### 7.1 backend 调 gateway

- `intent.classify`: 5 秒
- `skills.run`: 60 秒
- `answer.generate`: 30 秒
- `health`: 3 秒

### 7.2 gateway 内部 provider 调用

- 推荐最多 2 次重试
- 只对可恢复错误重试：
  - timeout
  - empty response
  - connection reset

## 8. 可观测性

每次调用必须至少记录：

- `traceId`
- `taskId`
- `workspaceId`
- `endpoint`
- `skillName`（如果有）
- `provider`
- `model`
- `latencyMs`
- `inputTokens`
- `outputTokens`
- `retryCount`
- `fallbackUsed`

## 9. backend 接入建议

backend 中建议新增统一的 `GatewayClient`，由它屏蔽 transport 细节。

`GatewayClient` 建议对 backend 暴露以下方法：

- `classifyIntent()`
- `runSkill()`
- `generateAnswer()`
- `healthCheck()`

backend 中不应再直接出现 provider 调用和 prompt 细节。

## 10. MVP 完成标准

满足以下条件即可认为 gateway 契约生效：

1. backend 不再直接依赖 provider SDK。
2. 至少一个 ingest LLM 步骤经由 `skills.run`。
3. 至少一个 query 回答经由 `answer.generate`。
4. `health` 可用于启动检查或降级判断。
5. backend 对 frontend 的既有协议无需重写。

## 11. 下一步演进

MVP 之后可以继续增加：

- `POST /agents/register`
- `POST /agents/run`
- `POST /tools/invoke`
- `POST /sessions/create`
- `POST /sessions/resume`
- `POST /policies/evaluate`

但这些不属于当前阶段必须项。
