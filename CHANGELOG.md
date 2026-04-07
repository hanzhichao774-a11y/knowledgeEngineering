# Changelog

基于 [Keep a Changelog](https://keepachangelog.com/) 格式，遵循[语义化版本](https://semver.org/)。

## [Unreleased]

*暂无*

---

## [0.6.0] - 2026-04-07

前端体验优化：知识图谱布局散开 + 全屏查看 + 数据持久化 + 清除按钮。

### Added

- **知识图谱全屏浮窗**：图谱标题栏新增全屏展开按钮（⤢），点击弹出覆盖全视口的 Modal 浮窗，支持 Escape 键和点击遮罩关闭
- **图谱缩放控制按钮**：图谱右上角 +/-/重置 三个工具按钮，支持手动缩放和一键适应画布
- **图谱自动缩放**：力模拟稳定后自动调用 `zoomToFit`，确保所有节点可见
- **数据持久化（localStorage）**：三个 Zustand store（taskStore / chatStore / resultStore）均添加 `persist` 中间件，页面刷新后任务进度、对话记录、提取结果完整恢复
- **清除数据按钮**：Header 右侧新增「清除数据」按钮（红色垃圾桶），确认后重置全部 store 数据；提示"不会删除图数据库中的知识"

### Changed

- **图谱力模拟参数优化**：charge 排斥力 -300（默认 -30）、link distance 120（默认 30）、cooldownTicks 150、d3AlphaDecay 0.02、d3VelocityDecay 0.3，节点自然散开
- **图谱容器高度**：从 260px 增大到 500px，给节点更多展开空间
- **GraphTab 重构**：抽取 `GraphRenderer` 共享组件，小面板和全屏 Modal 各自实例化，全屏模式力参数更大（charge -400, link distance 160）
- **节点/连线渲染微调**：字体增大（12px/13px）、圆角增大、箭头和标签更清晰

---

## [0.5.0] - 2026-04-07

文档解析架构升级：Docling 结构化解析替代 pdf-parse，多格式支持，双通道交叉校验框架。

### Added

- **Docling 结构化解析（Docker）**：替代 pdf-parse，使用 IBM 开源 TableFormer 模型识别表格结构，精度 97.9%，通过 Docker 容器 `docling-serve` 本地部署
- **多格式文档支持**：Excel（`exceljs` 原生单元格读取，100% 精确）、Word（`mammoth` HTML 转 Markdown）、PDF（Docling）、纯文本
- **DocumentParserService**：统一格式路由，按扩展名自动分发到对应解析器
- **双通道交叉校验框架**：CrossValidator 对比引擎（逐单元格比对、数值容差 0.1%、置信度评分 high/medium/low），VisionExtractService（MiniMax-VL 视觉提取 + pdf2pic PDF 转图片）
- **ChunkService Markdown 感知**：识别 Markdown 表格，按 5 行一组分块，每个 chunk 自动附加表头上下文
- **解析校验信息**：文档摘要末尾展示解析模式（单通道/双通道）、置信度、单元格匹配率
- **`ENABLE_VISION_CHANNEL` 环境变量**：在 `backend/.env` 中设置 `ENABLE_VISION_CHANNEL=true` 启用 MiniMax-VL 视觉双通道校验（默认关闭）

### Changed

- **documentParse Skill 重写**：移除 pdf-parse 和全部 preprocessTableText/tokenizeNumbers 启发式代码，改用 DocumentParserService
- **PDF 表格数据不再拼接错误**：之前 pdf-parse 将表格列数据拼接为连续字符串（如 396→3968），Docling 从表格结构层面解决

### Removed

- **pdf-parse 依赖**：已由 Docling + exceljs + mammoth 替代
- **preprocessTableText / tokenizeNumbers**：启发式数字拆分逻辑，不再需要

### 系统依赖

- Docker Desktop（运行 Docling 容器）
- GraphicsMagick + Ghostscript（`brew install graphicsmagick ghostscript`，pdf2pic 需要）

### 启用双通道交叉校验

> **重要**：当前默认只走 Docling 单通道（快速、稳定、免费）。如需启用 MiniMax-VL 视觉双通道交叉校验，需要：
>
> 1. 在 `backend/.env` 中添加 `ENABLE_VISION_CHANNEL=true`
> 2. 确保 MiniMax API 套餐支持视觉模型（如 MiniMax-Text-01）
> 3. 重启后端服务
>
> 未来接入更强 VLM（如 GPT-4V、Claude Vision）时，只需修改 VisionExtractService 中的模型和端点配置。

---

## [0.4.0] - 2026-04-07

知识图谱三项优化 + LLM 调用健壮性 + 知识检索本地化。

### Added

- **知识图谱可视化增强**：节点按类型着色（类=金色椭圆、实体=蓝色、属性=紫色），关系连线带方向箭头和标签背景
- **四层本体提取**：LLM prompt 重写，输出 classes / entities / relations（显式 source→target）/ attributes 四层结构
- **Markdown 答案渲染**：前端集成 `react-markdown` + `remark-gfm`，assistant 消息支持标题、列表、表格、代码块
- **页面刷新数据恢复**：前端启动时调用 `GET /api/knowledge/status` 和 `GET /api/graph/neo4j/all` 从 Neo4j 加载已有图谱
- **Neo4j 全属性搜索**：`_searchText` 属性记录实体的所有属性键值对，`queryByKeywords` 搜索覆盖 name + description + _searchText
- **LLM 空响应自动重试**：`callLLM` 遇到空响应 / 超时 / 连接重置时自动重试（最多 2 次），递增等待
- **JSON 解析容错**：`extractJSON` 三层修复（直接解析 → 修尾逗号+补引号 → 截断补括号），大幅降低 LLM 输出格式不规范导致的失败率
- **图谱节点类型图例**：GraphTab 底部显示颜色图例（类、实体、概念、规则、属性）

### Changed

- **知识检索零 token 消耗**：`knowledgeRetrieveSkill` 从 LLM 生成 Cypher 改为纯本地关键词提取 + Neo4j 关键词搜索，检索步骤不再消耗 LLM token
- **检索结果包含完整属性**：`queryByKeywords` 返回 `properties(n)` 全部属性，答案生成器可引用具体数值（如 `总耗气量值: 18912Nm³`）
- **答案生成 prompt 优化**：明确要求 LLM 引用原始数值，结构化传入实体属性和关联关系
- **本体提取 prompt 重写**：从简单 entities 列表改为 classes/entities/relations/attributes 四层结构
- **graphDBWrite 适配新结构**：写入 Class 节点、Entity 节点（带动态 label）、显式 source→target 关系、属性作为节点 property
- **graphGenerate 适配新结构**：类节点椭圆、实体节点方块、关系基于显式 source/target、移除模糊关联
- **ResultTab 重构**：本体结果分三表展示（本体类 / 实体 / 关系）

### Fixed

- **LLM 偶发空响应导致文档解析失败**：MiniMax 偶尔返回 0 tokens，之前直接失败；现在自动重试最多 2 次
- **本体提取 JSON 解析失败**：LLM 输出 JSON 尾逗号 / 截断时 `JSON.parse` 直接报错；现在三层容错修复
- **知识检索消耗 token**：检索步骤调 LLM 生成 Cypher 浪费 token；改为纯本地关键词搜索，零 token
- **检索到记录但缺少具体数值**：`queryByKeywords` 只返回 name/desc，不含属性值；现在返回节点全部属性

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
