import type { ExecutionContext, SkillResult } from '../agents/types.js';
import { callLLM } from '../services/LLMService.js';

const ANSWER_SYSTEM_PROMPT = `你是一个知识工程领域的专家助手。根据从知识图谱中检索到的知识，回答用户的问题。

规则：
- 基于提供的知识内容回答，不要编造未在知识库中出现的信息
- 如果检索结果不足以回答，明确告知用户知识库中暂无相关信息
- 使用清晰的结构化格式（标题、列表等）组织回答
- 回答用中文`;

export async function answerGenerateSkill(ctx: ExecutionContext): Promise<SkillResult> {
  const startTime = Date.now();
  const question = ctx.query ?? '';

  const retrieveResult = ctx.previousResults.find((r) => r.skillName === '知识检索');
  const retrieveData = retrieveResult?.data as { results?: unknown[]; resultCount?: number } | undefined;

  if (!retrieveResult || retrieveResult.status !== 'success') {
    return {
      skillName: '答案生成',
      status: 'error',
      data: { error: '前置知识检索步骤未成功，无法生成回答' },
      tokenUsed: 0,
      duration: (Date.now() - startTime) / 1000,
    };
  }

  const results = retrieveData?.results ?? [];
  const resultCount = retrieveData?.resultCount ?? 0;

  try {
    const knowledgeContext = resultCount > 0
      ? `从知识图谱中检索到 ${resultCount} 条相关记录：\n\n${JSON.stringify(results, null, 2)}`
      : '知识图谱中未检索到直接相关的记录。';

    const userPrompt = `用户问题：${question}\n\n知识库检索结果：\n${knowledgeContext}`;
    const { text, usage } = await callLLM(ANSWER_SYSTEM_PROMPT, userPrompt);

    const duration = (Date.now() - startTime) / 1000;
    return {
      skillName: '答案生成',
      status: 'success',
      data: {
        answer: text,
        basedOnResults: resultCount,
      },
      tokenUsed: usage?.inputTokens ?? 0,
      duration,
    };
  } catch (err) {
    console.error('[Skill:answerGenerate] Failed:', (err as Error).message);
    return {
      skillName: '答案生成',
      status: 'error',
      data: { error: (err as Error).message },
      tokenUsed: 0,
      duration: (Date.now() - startTime) / 1000,
    };
  }
}
