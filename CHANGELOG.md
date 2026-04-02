# Changelog

基于 [Keep a Changelog](https://keepachangelog.com/) 格式，遵循[语义化版本](https://semver.org/)。

## [Unreleased]

_新的变更在合并到 main 后添加到此处，发布版本时移至对应版本标题下。_

---

## [0.1.0] - 2025-04-02

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
