import type { ExecutionContext, SkillResult } from '../agents/types.js';

export async function answerGenerateSkill(ctx: ExecutionContext): Promise<SkillResult> {
  const startTime = Date.now();
  const question = ctx.query ?? '';

  const retrieveResult = ctx.previousResults.find((r) => r.skillName === '知识检索');
  const retrieveData = retrieveResult?.data as Record<string, unknown> | undefined;

  if (!retrieveResult || retrieveResult.status !== 'success') {
    return {
      skillName: '答案生成',
      status: 'error',
      data: { error: '前置知识检索步骤未成功，无法生成回答' },
      tokenUsed: 0,
      duration: (Date.now() - startTime) / 1000,
    };
  }

  const totalCount = (retrieveData?.resultCount as number | undefined) ?? 0;

  try {
    const gatewayResult = await ctx.services.gateway.generateAnswer({
      taskId: ctx.taskId,
      workspaceId: ctx.workspaceId,
      question,
      retrievalContext: retrieveData ?? {},
      context: {
        source: String(retrieveData?.source ?? 'unknown'),
      },
    });

    const duration = (Date.now() - startTime) / 1000;
    return {
      skillName: '答案生成',
      status: 'success',
      data: {
        answer: gatewayResult.answer,
        basedOnResults: totalCount,
        citations: gatewayResult.citations,
        source: retrieveData?.source,
        snapshotId: retrieveData?.snapshotId,
        freshness: retrieveData?.freshness,
      },
      tokenUsed: gatewayResult.usage.inputTokens,
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
