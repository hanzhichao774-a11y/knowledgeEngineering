import type { ExecutionContext, SkillResult } from '../agents/types.js';
import { callLLM, extractJSON } from '../services/LLMService.js';
import { readFile } from 'fs/promises';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdf = require('pdf-parse');

const SYSTEM_PROMPT = `你是一个专业的文档分析助手。用户会给你一段文档内容（可能是节选），请分析文档结构并返回 JSON 格式的结果。

要求返回如下 JSON 结构（不要包含其他内容）：
\`\`\`json
{
  "pageCount": <估计页数>,
  "chapters": <章节数>,
  "paragraphs": <段落数>,
  "tables": <表格数>,
  "summary": "<200字以内的文档摘要>"
}
\`\`\``;

export async function documentParseSkill(ctx: ExecutionContext): Promise<SkillResult> {
  const startTime = Date.now();

  let documentContent = '（未提供文档内容，请基于任务标题进行模拟分析）';
  if (ctx.filePath) {
    try {
      const buffer = await readFile(ctx.filePath);
      if (ctx.filePath.toLowerCase().endsWith('.pdf')) {
        const pdfData = await pdf(buffer);
        documentContent = pdfData.text.slice(0, 15000);
        console.log(`[Skill:documentParse] PDF extracted: ${pdfData.numpages} pages, ${pdfData.text.length} chars`);
      } else {
        documentContent = buffer.toString('utf-8').slice(0, 15000);
      }
    } catch (readErr) {
      console.error('[Skill:documentParse] File read error:', (readErr as Error).message);
      documentContent = `（无法读取文件 ${ctx.filePath}，请基于任务标题进行分析）`;
    }
  }

  const userPrompt = `请分析以下文档内容：\n\n${documentContent}`;

  try {
    const { text, usage } = await callLLM(SYSTEM_PROMPT, userPrompt);
    const data = extractJSON(text);
    const duration = (Date.now() - startTime) / 1000;

    return {
      skillName: '多模态文档解析',
      status: 'success',
      data,
      tokenUsed: usage?.inputTokens ?? 0,
      duration,
    };
  } catch (err) {
    console.error('[Skill:documentParse] Failed:', (err as Error).message);
    const duration = (Date.now() - startTime) / 1000;
    return {
      skillName: '多模态文档解析',
      status: 'error',
      data: { error: (err as Error).message },
      tokenUsed: 0,
      duration,
    };
  }
}
