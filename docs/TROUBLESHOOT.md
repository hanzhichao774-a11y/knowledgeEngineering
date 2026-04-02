# 问题排查手册

> 记录项目开发过程中遇到的问题、排查过程和解决方案。

---

## 1. MINIMAX_API_KEY 未加载到后端进程

**现象**

后端日志输出 `[Skill:documentParse] Failed: MINIMAX_API_KEY not set`，所有 LLM 调用瞬间失败（0.0s, 0 tokens）。

**原因**

后端进程由 Cursor IDE 终端启动，用户在自己的 shell 中执行 `export MINIMAX_API_KEY=...` 不会影响到已经运行的后端进程的环境变量。且后端原始代码没有 `.env` 加载机制。

**解决方案**

1. 在 `backend/src/index.ts` 入口添加了手工 `.env` 文件加载器（无额外依赖）
2. 创建 `backend/.env` 文件放置 API Key（已在 `.gitignore` 中排除）
3. 修改 `.env` 后需要 touch 一个 `.ts` 文件触发 `tsx watch` 重启

**涉及文件**

- `backend/src/index.ts`
- `backend/.env`

---

## 2. .env 中 API Key 被引号包裹导致 401

**现象**

后端日志输出 `minimax-coding API error: 401 authentication_error`，Provider 显示 `configured: true` 但请求被拒绝。

**原因**

用户在 `.env` 文件中将 API Key 用双引号包裹：`MINIMAX_API_KEY="sk-..."`. 手工 `.env` 加载器直接读取等号后的值（含引号），导致发送给 API 的 key 变成了 `"sk-..."` 而非 `sk-...`。

**解决方案**

在 `.env` 加载器中增加引号剥离逻辑：

```typescript
if ((value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))) {
  value = value.slice(1, -1);
}
```

**涉及文件**

- `backend/src/index.ts`

---

## 3. pdf-parse v2 API 不兼容

**现象**

后端日志输出 `[Skill:documentParse] File read error: pdf is not a function`。PDF 文件无法解析，LLM 收到的是降级文案而非文档内容。

**原因**

`npm install pdf-parse` 安装了 v2.4.5，该版本 API 完全重构：导出的不再是 `module.exports = function(buffer)` 函数，而是 `{ PDFParse }` 类。代码中 `const pdf = require('pdf-parse'); await pdf(buffer)` 调用方式与 v2 不兼容。

**解决方案**

降级到 v1.1.1：`npm install pdf-parse@1.1.1`。v1 的 API 是 `pdf(buffer)` 返回 `{ text, numpages, info, ... }`，与现有代码匹配。

**验证**

```bash
node -e "const pdf = require('pdf-parse'); console.log(typeof pdf)"
# 输出: function
```

**涉及文件**

- `backend/package.json`
- `backend/src/skills/documentParse.ts`

---

## 4. 流水线步骤失败后继续执行

**现象**

Step 1（文档解析）失败后，Step 2-5 仍然继续执行。最终任务状态显示"已完成"，消息提示"所有步骤执行成功"。

**原因**

`KEWorker.execute()` 的 for 循环中没有检查步骤执行结果，`result.status === 'error'` 时仍然继续下一个步骤。`TaskService.executeTask()` 固定设置 `task.status = 'completed'` 和成功消息，不检查是否有步骤失败。

**解决方案**

1. `KEWorker.execute()` 在步骤失败时 break 退出循环，将后续步骤标记为 `skipped`，返回 `false`
2. `ManagerAgent.analyzeAndDispatch()` 根据返回值发送对应的完成/失败消息
3. `TaskService.executeTask()` 检查是否有失败步骤，设置正确的 `task.status`（`completed` 或 `failed`），发送准确的最终消息
4. 前端 `Step` 类型增加 `skipped` 状态，`StepProgress.tsx` 渲染 error/skipped 样式

**涉及文件**

- `backend/src/agents/KEWorker.ts`
- `backend/src/agents/ManagerAgent.ts`
- `backend/src/services/TaskService.ts`
- `frontend/src/types/index.ts`
- `frontend/src/components/LeftPanel/StepProgress.tsx`
- `frontend/src/components/LeftPanel/LeftPanel.module.css`
- `frontend/src/App.tsx`

---

## 5. 错误被静默吞掉，无日志输出

**现象**

任务瞬间"完成"但所有步骤都显示 0 tokens，无法定位根本原因。后端日志中只有 HTTP 请求记录，没有任何错误信息。

**原因**

每个 Skill 的 `catch` 块只返回 `{ status: 'error', data: { error: message } }` 给调用方，但没有 `console.error` 输出。`LLMService.callLLM()` 原始版本也没有详细日志。

**解决方案**

1. 在所有 Skill 的 `catch` 块中增加 `console.error('[Skill:xxx] Failed:', err.message)`
2. 在 `LLMService.callLLM()` 中增加调用前日志（provider、configured 状态）和结果日志（耗时、token 数、text 长度）
3. LLM 返回空响应时主动抛出 `Error('LLM returned empty response')` 而非静默返回空文本

**涉及文件**

- `backend/src/services/LLMService.ts`
- `backend/src/skills/documentParse.ts`
- `backend/src/skills/ontologyExtract.ts`
- `backend/src/skills/schemaBuild.ts`

---

## 快速排查指南

| 症状 | 首先检查 |
|------|----------|
| 所有 Skill 瞬间失败，0 tokens | 后端日志搜索 `[LLM]`，检查 API Key 是否加载 |
| LLM 调用 401 错误 | 检查 `.env` 中 key 是否有多余引号或空格 |
| LLM 调用 500 insufficient balance | MiniMax 账户余额不足，需充值 |
| PDF 上传后解析失败 | 检查 `pdf-parse` 版本是否为 1.x（`npm list pdf-parse`） |
| 步骤失败但任务显示"已完成" | 检查 `KEWorker.execute()` 是否有 break 逻辑 |
| 修改 `.env` 后未生效 | `tsx watch` 不监控 `.env`，需 `touch backend/src/index.ts` 触发重启 |
