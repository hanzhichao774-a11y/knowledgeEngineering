import type { AgentConfig, ExecutionContext, SkillResult } from './types.js';
import { knowledgeRetrieveSkill } from '../skills/knowledgeRetrieve.js';
import { answerGenerateSkill } from '../skills/answerGenerate.js';

const QUERY_PIPELINE: Array<{
  name: string;
  fn: (ctx: ExecutionContext) => Promise<SkillResult>;
}> = [
  { name: '知识检索', fn: knowledgeRetrieveSkill },
  { name: '答案生成', fn: answerGenerateSkill },
];

export { QUERY_PIPELINE };

export class QueryWorker {
  config: AgentConfig = {
    id: `query-worker-${Date.now().toString(36)}`,
    name: '知识检索数字员工',
    role: 'worker',
    description: '负责从知识图谱中检索信息并生成回答',
    skills: ['knowledge-retrieve', 'answer-generate'],
    model: 'minimax',
  };

  async execute(ctx: ExecutionContext): Promise<boolean> {
    for (let i = 0; i < QUERY_PIPELINE.length; i++) {
      const { name, fn } = QUERY_PIPELINE[i];

      ctx.onProgress({
        agentId: this.config.id,
        role: 'worker',
        content: `Step ${i + 1}/${QUERY_PIPELINE.length} · ${name} — 开始执行`,
        timestamp: new Date().toISOString(),
        metadata: { stepIndex: i, skillName: name },
      });

      const result = await fn(ctx);
      ctx.previousResults.push(result);
      ctx.onStepComplete(i, result);

      ctx.onProgress({
        agentId: this.config.id,
        role: 'worker',
        content: `Step ${i + 1}/${QUERY_PIPELINE.length} · ${name} — ${result.status === 'success' ? '完成' : '失败'} (${result.duration.toFixed(1)}s, ${result.tokenUsed} tokens)`,
        timestamp: new Date().toISOString(),
        metadata: { stepIndex: i, skillName: name, result: result.status },
      });

      if (result.status === 'error') {
        for (let j = i + 1; j < QUERY_PIPELINE.length; j++) {
          ctx.onStepComplete(j, {
            skillName: QUERY_PIPELINE[j].name,
            status: 'error',
            data: { error: `跳过：前置步骤「${name}」执行失败` },
            tokenUsed: 0,
            duration: 0,
          });
          ctx.onProgress({
            agentId: this.config.id,
            role: 'worker',
            content: `Step ${j + 1}/${QUERY_PIPELINE.length} · ${QUERY_PIPELINE[j].name} — 已跳过`,
            timestamp: new Date().toISOString(),
            metadata: { stepIndex: j, skillName: QUERY_PIPELINE[j].name, result: 'skipped' },
          });
        }
        return false;
      }
    }
    return true;
  }
}
