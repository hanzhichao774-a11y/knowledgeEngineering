import type { AgentConfig, ExecutionContext, SkillResult } from './types.js';
import { documentParseSkill } from '../skills/documentParse.js';
import { ontologyExtractSkill } from '../skills/ontologyExtract.js';
import { schemaBuildSkill } from '../skills/schemaBuild.js';
import { graphDBWriteSkill } from '../skills/graphDBWrite.js';
import { graphGenerateSkill } from '../skills/graphGenerate.js';

export type SkillFn = (ctx: ExecutionContext) => Promise<SkillResult>;

const SKILL_PIPELINE: Array<{ name: string; fn: SkillFn }> = [
  { name: '文档解析', fn: documentParseSkill },
  { name: '本体提取', fn: ontologyExtractSkill },
  { name: 'Schema 构建', fn: schemaBuildSkill },
  { name: '写入图数据库', fn: graphDBWriteSkill },
  { name: '生成知识图谱', fn: graphGenerateSkill },
];

export class KEWorker {
  config: AgentConfig = {
    id: 'KE-01',
    name: '知识工程数字员工 #KE-01',
    role: 'worker',
    description: '知识工程工作线 · 实例 01，负责文档解析、本体提取、Schema 构建、图数据库写入和知识图谱生成',
    skills: ['document-parse', 'ontology-extract', 'schema-build', 'graph-db-write', 'graph-generate'],
    model: 'minimax',
  };

  async execute(ctx: ExecutionContext): Promise<boolean> {
    for (let i = 0; i < SKILL_PIPELINE.length; i++) {
      const { name, fn } = SKILL_PIPELINE[i];

      ctx.onProgress({
        agentId: this.config.id,
        role: 'worker',
        content: `Step ${i + 1}/${SKILL_PIPELINE.length} · ${name} — 开始执行`,
        timestamp: new Date().toISOString(),
        metadata: { stepIndex: i, skillName: name },
      });

      const result = await fn(ctx);
      ctx.previousResults.push(result);

      ctx.onStepComplete(i, result);

      ctx.onProgress({
        agentId: this.config.id,
        role: 'worker',
        content: `Step ${i + 1}/${SKILL_PIPELINE.length} · ${name} — ${result.status === 'success' ? '完成' : '失败'} (${result.duration.toFixed(1)}s, ${result.tokenUsed} tokens)`,
        timestamp: new Date().toISOString(),
        metadata: { stepIndex: i, skillName: name, result: result.status },
      });

      if (result.status === 'error') {
        for (let j = i + 1; j < SKILL_PIPELINE.length; j++) {
          ctx.onStepComplete(j, {
            skillName: SKILL_PIPELINE[j].name,
            status: 'error',
            data: { error: `跳过：前置步骤「${name}」执行失败` },
            tokenUsed: 0,
            duration: 0,
          });
          ctx.onProgress({
            agentId: this.config.id,
            role: 'worker',
            content: `Step ${j + 1}/${SKILL_PIPELINE.length} · ${SKILL_PIPELINE[j].name} — 已跳过`,
            timestamp: new Date().toISOString(),
            metadata: { stepIndex: j, skillName: SKILL_PIPELINE[j].name, result: 'skipped' },
          });
        }
        return false;
      }
    }
    return true;
  }
}
