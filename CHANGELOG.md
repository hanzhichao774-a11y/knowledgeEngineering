# Changelog

基于 [Keep a Changelog](https://keepachangelog.com/) 格式，遵循[语义化版本](https://semver.org/)。

## [Unreleased]

*暂无*

---

## [0.3.0] - 2026-04-02

知识检索闭环：入库后可直接提问查询已有知识，无需重新上传文档。

### Added

- **知识检索闭环**：ManagerAgent 通过 LLM 判断用户意图（入库 vs 查询），自动分发到对应工作线
- **QueryWorker 检索工作线**：2 步精简流程（知识检索 → 答案生成）替代纯文本提问时的 5 步入库流程
- **knowledgeRetrieve Skill**：LLM 根据图数据库 Schema 生成 Cypher 查询，从 Neo4j 检索相关知识，关键词兜底
- **answerGenerate Skill**：基于检索到的知识上下文，LLM 生成结构化回答
- **Neo4j 检索能力**：`queryByKeywords()`、`runCypher()`（带安全校验）、`getGraphSchema()`、`isNeo4jConnected()`
- **Neo4j 启动初始化**：后端启动时自动调用 `initNeo4j()` 连接图数据库
- **assistant 角色**：前端新增知识助手消息样式（金色头像/标签），用于展示检索回答
- **TaskService 双流程**：入库任务 5 步 / 检索任务 2 步，steps 动态生成
- **taskStore.replaceSteps()**：支持后端动态重置任务步骤列表

### Changed

- **ManagerAgent 重构**：从硬编码入库流程改为 LLM 意图判断 + 双流程分发（KEWorker / QueryWorker）
- **ExecutionContext 扩展**：新增 `intent`（ingest/query）和 `query` 字段
- **前端 App.tsx**：处理 `task.steps.reset` 事件，AgentDetail 动态适配步骤数
- **ChatMessage 类型**：增加 `assistant` role 和 `metadata` 字段

### Fixed

- **pendingFileId 残留**：上传文件后 `pendingFileId` 未清除，导致后续纯文本提问仍携带旧 fileId 走入库流程

---

## [0.2.0] - 2026-04-02

真实 LLM 集成 + 流水线健壮性修复，完整流程跑通。

### Added

- **LLM 真实集成**：通过 KodaX `@kodax/ai` 接入 MiniMax LLM，文档解析、本体提取、Schema 构建调用真实 LLM
- **前后端打通**：前端 WebSocket 接收后端实时推送，REST API 创建任务和上传文件
- **LLMService 封装**：统一 LLM 调用、结果日志和 JSON 解析
- **Mock/Real 双模式**：前端 `?mock=true` URL 参数切换 Mock 演示和真实后端
- **.env 加载器**：后端启动时自动加载 `backend/.env`，支持带引号的值自动剥离
- **PDF 文本提取**：使用 `pdf-parse@1.1.1` 解析 PDF 文件，提取纯文本供 LLM 分析
- **排查文档**：新增 `docs/TROUBLESHOOT.md`，记录 5 个常见问题及解决方案

### Changed

- **TaskService 重构**：移除 `runMockExecution`，改为调用 `ManagerAgent.analyzeAndDispatch()` 真实执行 pipeline
- **Skills 重写**：5 个 Skill 从 sleep+硬编码改为真实 LLM 调用和数据驱动
- **GraphService 重构**：从固定 Mock 数据改为存储/读取任务产出的真实图谱
- **文件上传增强**：新增 `fileRegistry` 映射 fileId → filePath，供 Skills 读取文件内容

### Fixed

- **流水线失败不中断**：KEWorker 步骤失败后继续执行后续步骤 → 失败时立即中断，后续标记为 skipped
- **任务状态不正确**：步骤失败后 task.status 仍为 completed → 根据步骤结果正确设置 failed/completed
- **最终消息误导**：步骤失败后仍提示"所有步骤执行成功" → 显示具体失败步骤名称
- **pdf-parse v2 不兼容**：v2 API 重构导致 `pdf is not a function` → 降级到 v1.1.1
- **API Key 引号问题**：.env 中带引号的值导致 401 认证失败 → 加载器自动剥离引号
- **错误静默吞掉**：Skill 和 LLM 调用失败无日志 → 添加 console.error 详细输出
- **前端 error/skipped 状态缺失**：Step 只渲染 done/running/pending → 增加 error（红色）和 skipped（虚线灰色）样式

---

## [0.1.0] - 2026-04-02

首次发布，完整的知识工程端到端 Mock 演示。

### Added

- **三栏布局前端**：React + Vite + TypeScript，暗色主题
  - 左栏：任务列表、5 步执行进度、资源消耗面板
  - 中栏：多角色对话流、文件上传、输入框
  - 右栏：本体提取结果表格、Schema 展示、智能体详情、力导向知识图谱
- **Zustand 状态管理**：taskStore / chatStore / resultStore
- **Mock 演示流程**：页面加载后自动播放 28 秒完整流程动画
- **后端 Fastify 服务**：7 个 REST API 端点 + WebSocket 实时推送
- **Agent 框架**：ManagerAgent 任务委派 + KEWorker 串行执行 5 个 Skill
- **5 个 Mock Skill**：文档解析 / 本体提取 / Schema 构建 / 图DB写入 / 图谱生成
- **Neo4j 集成框架**：连接管理 + Mock 数据模式
- **项目文档**：README、API 文档、组件文档、部署指南

---

<!--
## 模板

## [x.y.z] - YYYY-MM-DD

### Added（新功能）
- 描述新增功能

### Changed（变更）
- 描述行为变更

### Fixed（修复）
- 描述 Bug 修复

### Removed（移除）
- 描述移除的功能
-->
