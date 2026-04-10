import type { AgentConfig, ExecutionContext, SkillResult } from './types.js';
import { graphifyNormalizeSkill } from '../skills/graphifyNormalize.js';
import { getKodaXOrchestrator } from '../services/KodaXOrchestrator.js';
import { getWorkspaceManager } from '../services/WorkspaceManager.js';

export type SkillFn = (ctx: ExecutionContext) => Promise<SkillResult>;

const STEP_NAMES = ['文档规范化', '知识提取', '图谱构建', '知识导出', '资产构建'];

export class KEWorker {
  config: AgentConfig = {
    id: 'KE-01',
    name: '知识工程数字员工 #KE-01',
    role: 'worker',
    description: '知识工程工作线 · 实例 01，由 KodaX 编排 graphify skill.md 执行完整 pipeline',
    skills: ['graphify-normalize', 'kodax-graphify-pipeline'],
    model: 'minimax',
  };

  async execute(ctx: ExecutionContext): Promise<boolean> {
    const totalSteps = STEP_NAMES.length;

    ctx.onProgress({
      agentId: this.config.id,
      role: 'worker',
      content: `Step 1/${totalSteps} · ${STEP_NAMES[0]} — 开始执行`,
      timestamp: new Date().toISOString(),
      metadata: { stepIndex: 0, skillName: STEP_NAMES[0] },
    });

    const normalizeResult = await graphifyNormalizeSkill(ctx);
    ctx.previousResults.push(normalizeResult);
    ctx.onStepComplete(0, normalizeResult);

    ctx.onProgress({
      agentId: this.config.id,
      role: 'worker',
      content: `Step 1/${totalSteps} · ${STEP_NAMES[0]} — ${normalizeResult.status === 'success' ? '完成' : '失败'} (${normalizeResult.duration.toFixed(1)}s)`,
      timestamp: new Date().toISOString(),
      metadata: { stepIndex: 0, skillName: STEP_NAMES[0], result: normalizeResult.status },
    });

    if (normalizeResult.status === 'error') {
      this.skipRemaining(ctx, 1, STEP_NAMES[0]);
      return false;
    }

    const normalizeData = normalizeResult.data as Record<string, unknown>;
    if (normalizeData.skipRemaining) {
      for (let j = 1; j < totalSteps; j++) {
        ctx.onStepComplete(j, {
          skillName: STEP_NAMES[j],
          status: 'success',
          data: { skipped: '知识库已是最新' },
          tokenUsed: 0,
          duration: 0,
        });
      }
      return true;
    }

    ctx.onProgress({
      agentId: this.config.id,
      role: 'worker',
      content: `Step 2-${totalSteps}/${totalSteps} · KodaX 编排引擎接管，按 skill.md 执行 pipeline...`,
      timestamp: new Date().toISOString(),
      metadata: { stepIndex: 1, skillName: '知识提取' },
    });

    const ws = getWorkspaceManager();
    const orchestrator = getKodaXOrchestrator();
    const filePaths = ctx.filePaths ?? (ctx.filePath ? [ctx.filePath] : []);

    const result = await orchestrator.runIngest(ws.workspacePath, filePaths, {
      onProgress: ctx.onProgress,
      onStepComplete: (stepIndex: number, skillResult: SkillResult) => {
        const adjustedIndex = stepIndex + 1;
        if (adjustedIndex >= 1 && adjustedIndex < totalSteps) {
          ctx.previousResults.push(skillResult);
          ctx.onStepComplete(adjustedIndex, skillResult);

          ctx.onProgress({
            agentId: this.config.id,
            role: 'worker',
            content: `Step ${adjustedIndex + 1}/${totalSteps} · ${STEP_NAMES[adjustedIndex]} — ${skillResult.status === 'success' ? '完成' : '失败'}`,
            timestamp: new Date().toISOString(),
            metadata: { stepIndex: adjustedIndex, skillName: STEP_NAMES[adjustedIndex], result: skillResult.status },
          });
        }
      },
    });

    if (!result.success) {
      const lastCompleted = ctx.previousResults.length;
      for (let j = lastCompleted; j < totalSteps; j++) {
        ctx.onStepComplete(j, {
          skillName: STEP_NAMES[j],
          status: 'error',
          data: { error: 'KodaX 编排执行失败' },
          tokenUsed: 0,
          duration: 0,
        });
      }
      return false;
    }

    for (let j = 1; j < totalSteps; j++) {
      const existingResult = ctx.previousResults.find((r) => r.skillName === STEP_NAMES[j]);
      if (!existingResult) {
        ctx.onStepComplete(j, {
          skillName: STEP_NAMES[j],
          status: 'success',
          data: { completedByKodaX: true },
          tokenUsed: Math.floor(result.totalTokens / (totalSteps - 1)),
          duration: 0,
        });
      }
    }

    return true;
  }

  private skipRemaining(ctx: ExecutionContext, fromIndex: number, failedName: string): void {
    for (let j = fromIndex; j < STEP_NAMES.length; j++) {
      ctx.onStepComplete(j, {
        skillName: STEP_NAMES[j],
        status: 'error',
        data: { error: `跳过：前置步骤「${failedName}」执行失败` },
        tokenUsed: 0,
        duration: 0,
      });
      ctx.onProgress({
        agentId: this.config.id,
        role: 'worker',
        content: `Step ${j + 1}/${STEP_NAMES.length} · ${STEP_NAMES[j]} — 已跳过`,
        timestamp: new Date().toISOString(),
        metadata: { stepIndex: j, skillName: STEP_NAMES[j], result: 'skipped' },
      });
    }
  }
}
