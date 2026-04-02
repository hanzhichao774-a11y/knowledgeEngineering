# 后端 API 文档

Base URL: `http://localhost:3001`

所有 REST 接口以 `/api` 为前缀，WebSocket 端点为 `/ws`。

---

## REST API

### 任务管理

#### POST /api/tasks — 创建任务

创建一个知识工程任务，后端自动启动 Mock 执行流程。

**请求体：**
```json
{
  "title": "企业信息安全管理制度.pdf",
  "description": "提取关键概念、规则和关系，构建知识图谱",
  "fileId": "abc-123"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| title | string | 是 | 任务标题 |
| description | string | 否 | 任务描述 |
| fileId | string | 否 | 关联的上传文件 ID |

**响应：**
```json
{
  "id": "uuid",
  "title": "企业信息安全管理制度.pdf",
  "status": "queued",
  "steps": [
    {
      "name": "文档解析",
      "status": "pending",
      "skill": "多模态文档解析",
      "skillIcon": "📑",
      "tokenUsed": 0,
      "tokenLimit": 8000
    }
  ],
  "cost": {
    "inputTokens": 0,
    "outputTokens": 0,
    "estimatedCost": 0,
    "elapsed": "0s"
  },
  "createdAt": "2025-04-02T12:00:00.000Z"
}
```

---

#### GET /api/tasks — 任务列表

返回所有任务（不含 `result` 字段）。

**响应：** `Task[]`

---

#### GET /api/tasks/:id — 任务详情

返回指定任务的完整信息。

**参数：** `id` — 任务 ID

**响应：** `Task` 对象，或 `{ "error": "Task not found" }`

---

#### GET /api/tasks/:id/result — 任务产出

返回任务完成后的产出结果。

**响应：**
```json
{
  "ontology": {
    "entities": [
      { "name": "信息安全策略", "type": "entity", "desc": "组织信息安全总体方针" },
      { "name": "管辖", "type": "relation", "desc": "安全策略 → 数据分类" }
    ],
    "entityCount": 18,
    "relationCount": 12,
    "ruleCount": 9,
    "attrCount": 25
  },
  "schema": "RDF Schema generated",
  "summary": "本文档为企业信息安全管理制度，共 7 章 38 页。",
  "graphNodeCount": 10,
  "graphEdgeCount": 10
}
```

未完成时返回 `{ "error": "No result available" }`。

---

### 消息

#### POST /api/chat — 发送消息

**请求体：**
```json
{
  "taskId": "uuid",
  "content": "请帮我处理这份文档"
}
```

**响应：**
```json
{
  "id": "msg-1712000000000",
  "role": "user",
  "content": "请帮我处理这份文档",
  "taskId": "uuid",
  "timestamp": "2025-04-02T12:00:00.000Z"
}
```

---

### 知识图谱

#### GET /api/graph/:taskId — 图谱数据

返回指定任务的知识图谱可视化数据。

**响应：**
```json
{
  "nodes": [
    { "id": "n1", "label": "信息安全策略", "type": "entity" },
    { "id": "n2", "label": "数据分类", "type": "concept" },
    { "id": "n4", "label": "安全等级", "type": "rule" }
  ],
  "edges": [
    { "source": "n1", "target": "n2", "label": "管辖" },
    { "source": "n1", "target": "n3", "label": "包含" }
  ]
}
```

节点类型：`entity`（蓝色）、`concept`（绿色）、`rule`（紫色）

---

### 文件上传

#### POST /api/upload — 上传文档

**Content-Type:** `multipart/form-data`

| 字段 | 类型 | 说明 |
|------|------|------|
| file | File | PDF/Word/Excel 文件，最大 50MB |

**响应：**
```json
{
  "fileId": "uuid",
  "filename": "企业信息安全管理制度.pdf",
  "size": 2516582,
  "mimetype": "application/pdf"
}
```

---

## WebSocket

### 连接

```
ws://localhost:3001/ws
```

连接成功后服务端发送：
```json
{ "type": "connected", "timestamp": 1712000000000 }
```

### 心跳

客户端发送：
```json
{ "type": "ping" }
```

服务端回复：
```json
{ "type": "pong", "timestamp": 1712000000000 }
```

### 服务端推送事件

#### task.created

新任务创建时推送。

```json
{
  "type": "task.created",
  "task": { "id": "uuid", "title": "...", "status": "queued", "steps": [...] }
}
```

#### task.status

任务状态变更时推送。

```json
{
  "type": "task.status",
  "taskId": "uuid",
  "status": "running"
}
```

#### task.step.start

某个步骤开始执行时推送。

```json
{
  "type": "task.step.start",
  "taskId": "uuid",
  "stepIndex": 0
}
```

#### task.step.complete

某个步骤执行完成时推送。

```json
{
  "type": "task.step.complete",
  "taskId": "uuid",
  "stepIndex": 0,
  "step": {
    "name": "文档解析",
    "status": "done",
    "tokenUsed": 1247,
    "duration": 3.2
  },
  "cost": {
    "inputTokens": 1247,
    "outputTokens": 420,
    "estimatedCost": 0.08,
    "elapsed": "6s"
  }
}
```

#### task.complete

任务全部步骤完成时推送。

```json
{
  "type": "task.complete",
  "taskId": "uuid"
}
```

#### agent.message

智能体产生消息时推送。

```json
{
  "type": "agent.message",
  "message": {
    "id": "msg-xxx",
    "role": "worker",
    "name": "知识工程 #KE-01",
    "content": "<p><strong>Step 1/5 · 文档解析</strong></p>",
    "timestamp": "14:32",
    "agentStatus": {
      "skill": "多模态文档解析",
      "skillIcon": "📑",
      "tokenUsed": 1247,
      "tokenLimit": 8000,
      "status": "done",
      "duration": 3.2
    }
  }
}
```

---

## 数据模型

### Task

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | UUID |
| title | string | 任务标题 |
| status | `queued` \| `running` \| `completed` \| `failed` | 任务状态 |
| steps | Step[] | 执行步骤（固定 5 步） |
| cost | CostInfo | 资源消耗 |
| createdAt | string | ISO 时间戳 |

### Step

| 字段 | 类型 | 说明 |
|------|------|------|
| name | string | 步骤名 |
| status | `pending` \| `running` \| `done` \| `error` | 步骤状态 |
| skill | string | 调用的 Skill 名称 |
| skillIcon | string | Skill 图标 |
| tokenUsed | number | 已消耗 Token |
| tokenLimit | number | Token 上限 |
| duration | number? | 耗时（秒） |

### CostInfo

| 字段 | 类型 | 说明 |
|------|------|------|
| inputTokens | number | 输入 Token 数 |
| outputTokens | number | 输出 Token 数 |
| estimatedCost | number | 预估费用（元） |
| elapsed | string | 已用时间 |
