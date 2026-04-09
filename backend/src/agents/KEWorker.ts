import type { AgentConfig, ExecutionContext, SkillResult } from './types.js';
import { graphifyNormalizeSkill } from '../skills/graphifyNormalize.js';
import { graphifyExtractSkill } from '../skills/graphifyExtract.js';
import { graphifyBuildSkill } from '../skills/graphifyBuild.js';
import { graphifyExportSkill } from '../skills/graphifyExport.js';
import { graphifyAssetsSkill } from '../skills/graphifyAssets.js';

export type SkillFn = (ctx: ExecutionContext) => Promise<SkillResult>;

const SKILL_PIPELINE: Array<{ name: string; fn: SkillFn }> = [
  { name: '文档规范化', fn: graphifyNormalizeSkill },
  { name: '知识提取', fn: graphifyExtractSkill },
  { name: '图谱构建', fn: graphifyBuildSkill },
  { name: '知识导出', fn: graphifyExportSkill },
  { name: '资产构建', fn: graphifyAssetsSkill },
];

export class KEWorker {
  config: AgentConfig = {
    id: 'KE-01',
    name: '知识工程数字员工 #KE-01',
    role: 'worker',
    description: '知识工程工作线 · 实例 01，负责文档规范化、知识提取（AST+语义）、图谱构建、知识导出和资产构建',
    skills: ['graphify-normalize', 'graphify-extract', 'graphify-build', 'graphify-export', 'graphify-assets'],
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
