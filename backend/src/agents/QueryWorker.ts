import type { AgentConfig, ExecutionContext, SkillResult } from './types.js';
import { getKodaXOrchestrator } from '../services/KodaXOrchestrator.js';
import { getWorkspaceManager } from '../services/WorkspaceManager.js';

const QUERY_STEP_NAMES = ['知识检索', '答案生成'];

export { QUERY_STEP_NAMES as QUERY_PIPELINE };

export class QueryWorker {
  config: AgentConfig = {
    id: `query-worker-${Date.now().toString(36)}`,
    name: '知识检索数字员工',
    role: 'worker',
    description: '由 KodaX 编排，通过 graphify skill.md query 模式检索知识图谱并生成回答',
    skills: ['kodax-graphify-query'],
    model: 'minimax',
  };

  async execute(ctx: ExecutionContext): Promise<boolean> {
    const totalSteps = QUERY_STEP_NAMES.length;
    const question = ctx.query ?? ctx.taskId;

    ctx.onProgress({
      agentId: this.config.id,
      role: 'worker',
      content: `Step 1/${totalSteps} · ${QUERY_STEP_NAMES[0]} — 开始执行`,
      timestamp: new Date().toISOString(),
      metadata: { stepIndex: 0, skillName: QUERY_STEP_NAMES[0] },
    });

    const ws = getWorkspaceManager();
    const orchestrator = getKodaXOrchestrator();

    const result = await orchestrator.runQuery(question, ws.workspacePath, {
      onProgress: ctx.onProgress,
      onStepComplete: (stepIndex: number, skillResult: SkillResult) => {
        if (stepIndex < totalSteps) {
          ctx.previousResults.push(skillResult);
          ctx.onStepComplete(stepIndex, skillResult);
        }
      },
    });

    if (!result.success) {
      for (let j = 0; j < totalSteps; j++) {
        const hasResult = ctx.previousResults.some((r) => r.skillName === QUERY_STEP_NAMES[j]);
        if (!hasResult) {
          const errorResult: SkillResult = {
            skillName: QUERY_STEP_NAMES[j],
            status: 'error',
            data: { error: 'KodaX 查询执行失败' },
            tokenUsed: 0,
            duration: 0,
          };
          ctx.previousResults.push(errorResult);
          ctx.onStepComplete(j, errorResult);
        }
      }
      return false;
    }

    const hasRetrieve = ctx.previousResults.some((r) => r.skillName === '知识检索');
    if (!hasRetrieve) {
      const retrieveResult: SkillResult = {
        skillName: '知识检索',
        status: 'success',
        data: { source: 'kodax-graphify', resultCount: 1 },
        tokenUsed: Math.floor(result.totalTokens * 0.6),
        duration: 0,
      };
      ctx.previousResults.push(retrieveResult);
      ctx.onStepComplete(0, retrieveResult);

      ctx.onProgress({
        agentId: this.config.id,
        role: 'worker',
        content: `Step 1/${totalSteps} · ${QUERY_STEP_NAMES[0]} — 完成`,
        timestamp: new Date().toISOString(),
        metadata: { stepIndex: 0, skillName: QUERY_STEP_NAMES[0], result: 'success' },
      });
    }

    const hasAnswer = ctx.previousResults.some((r) => r.skillName === '答案生成');
    if (!hasAnswer) {
      const answerResult: SkillResult = {
        skillName: '答案生成',
        status: 'success',
        data: { answer: result.answer, source: 'kodax-graphify' },
        tokenUsed: Math.floor(result.totalTokens * 0.4),
        duration: 0,
      };
      ctx.previousResults.push(answerResult);
      ctx.onStepComplete(1, answerResult);

      ctx.onProgress({
        agentId: this.config.id,
        role: 'worker',
        content: `Step 2/${totalSteps} · ${QUERY_STEP_NAMES[1]} — 完成`,
        timestamp: new Date().toISOString(),
        metadata: { stepIndex: 1, skillName: QUERY_STEP_NAMES[1], result: 'success' },
      });
    }

    return true;
  }
}
