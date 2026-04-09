# Agent OS Architecture

## 核心分层

`Agent OS` 当前只定义三大核心层：

1. `Agent OS Web`
2. `Agent OS API`
3. `Agent Runtime Gateway`

`graphify` 不再作为与三者平级的第四核心，而是收口到 `Agent Runtime Gateway` 内部，作为知识运行时能力域存在。

---

## 总体关系

```text
Agent OS Web
  -> Agent OS API
      -> Agent Runtime Gateway

Agent Runtime Gateway
  -> model runtime
  -> tool / skill runtime
  -> graphify runtime
  -> memory / retrieval / evidence runtime
```

外部只看三层。

内部运行时能力可以继续拆分，但这些拆分都属于 `Agent Runtime Gateway`，不再单独抬成产品主层。

---

## 1. Agent OS Web

### 负责什么

- 产品界面与交互体验
- 页面结构、导航、布局、视觉系统
- 工作台视图、项目视图、结果视图、状态展示
- 用户输入采集
- 前端态管理
- 对 API 返回结果做可视化表达

### 不负责什么

- 不直接调用模型
- 不直接执行 agent
- 不直接访问 graphify 或知识快照
- 不直接管理任务编排
- 不直接持有业务规则

### 设计原则

- Web 只表达产品，不承载运行时实现细节
- Web 看到的是“任务状态”“结果”“证据”“告警”，不是底层脚本或 provider 细节
- Web 与 Runtime 之间必须隔一层 API

---

## 2. Agent OS API

### 负责什么

- 业务 API 边界
- 任务创建、状态流转、结果聚合
- 项目、工作区、会话、权限等业务壳
- WebSocket / SSE / REST 等面向前端的协议
- 将前端请求翻译为运行时请求
- 将运行时结果整理为产品可消费的数据结构

### 不负责什么

- 不直接持有模型 SDK
- 不直接实现 prompt
- 不直接实现 tool / skill 执行
- 不直接实现 graphify 的内部知识编译逻辑
- 不把自己做成运行时

### 设计原则

- API 是产品壳和运行时之间的清晰边界
- API 负责“编排和聚合”，不负责“智能能力本身”
- API 输出的是稳定产品协议，而不是底层运行时原始结构

---

## 3. Agent Runtime Gateway

### 负责什么

- 所有 agent runtime 能力
- 模型调用与 provider 管理
- prompt / context 装配
- tool / skill 调度
- 子 agent 执行
- memory / retrieval / evidence 相关运行时能力
- 知识运行时能力

### graphify 的归属

`graphify` 属于 `Agent Runtime Gateway`。

它的定位不是独立产品层，而是运行时中的知识能力域，负责：

- 知识编译
- 知识快照
- graph / records / reports / health
- retrieval / evidence / freshness
- 面向 agent 的知识运行时支撑

所以更准确的说法不是“Gateway 调 graphify”，而是：

- `graphify runtime` 是 `Agent Runtime Gateway` 内部的一个核心域
- 它与 model runtime、tool runtime 并列存在

### 不负责什么

- 不负责页面 UI
- 不负责业务项目壳
- 不负责前端协议设计
- 不负责产品级导航和展示

### 设计原则

- Runtime Gateway 是执行平面，不是页面层，也不是业务壳
- graphify 不能被降级成普通小工具
- graphify 也不再作为与 Web / API / Gateway 平级的第四核心

---

## 边界规则

### Web -> API

- Web 只能调用 API
- Web 不允许越过 API 直接访问 Runtime Gateway

### API -> Runtime Gateway

- API 只向 Runtime Gateway 发起能力请求
- API 不复制 Runtime Gateway 内部能力

### Runtime Gateway 内部

- model runtime、tool runtime、graphify runtime 可以拆分实现
- 但对外统一表现为 `Agent Runtime Gateway`

---

## 一句话定义

`Agent OS` 的三大核心是：

- `Web`：产品界面
- `API`：业务编排边界
- `Runtime Gateway`：统一执行平面

其中 `graphify` 是 `Runtime Gateway` 内部的知识运行时核心域，而不是独立第四层。
