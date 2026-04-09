import type { ExecutionContext, SkillResult } from '../agents/types.js';
import { getGraphifyBridge } from '../services/GraphifyBridge.js';
import { getWorkspaceManager } from '../services/WorkspaceManager.js';

const bridge = getGraphifyBridge();

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

  const contextForLLM: Record<string, unknown> = { ...retrieveData };
  const rawSnippets = contextForLLM.docSnippets as Array<{ snippet: string; file: string; score: number }> | undefined;
  if (rawSnippets && rawSnippets.length > 0) {
    let totalLen = 0;
    const trimmed: typeof rawSnippets = [];
    for (const s of rawSnippets) {
      if (totalLen > 12000) break;
      trimmed.push(s);
      totalLen += s.snippet.length;
    }
    contextForLLM.docSnippets = trimmed;
  }

  try {
    const gatewayResult = await ctx.services.gateway.generateAnswer({
      taskId: ctx.taskId,
      workspaceId: ctx.workspaceId,
      question,
      retrievalContext: contextForLLM,
      context: {
        source: String(retrieveData?.source ?? 'unknown'),
      },
    });

    const answer = gatewayResult.answer;
    const citations = gatewayResult.citations ?? [];
    const sources = (retrieveData?.graphifySources as string[] | undefined) ?? [];
    const duration = (Date.now() - startTime) / 1000;

    const ws = getWorkspaceManager();
    if (ws.hasExistingGraph() && answer) {
      bridge.saveQueryResult(question, answer, sources, ws.workspacePath).catch((err) => {
        console.warn('[answerGenerate] Memory write failed:', (err as Error).message);
      });
    }

    return {
      skillName: '答案生成',
      status: 'success',
      data: {
        answer,
        basedOnResults: totalCount,
        citations,
        source: retrieveData?.source,
      },
      tokenUsed: gatewayResult.usage.inputTokens,
      duration,
    };
  } catch (err) {
    console.error('[answerGenerate] Failed:', (err as Error).message);
    return {
      skillName: '答案生成',
      status: 'error',
      data: { error: (err as Error).message },
      tokenUsed: 0,
      duration: (Date.now() - startTime) / 1000,
    };
  }
}
