import type { ExecutionContext, SkillResult } from '../agents/types.js';
import { getGraphifyBridge } from '../services/GraphifyBridge.js';
import { getWorkspaceManager } from '../services/WorkspaceManager.js';

const bridge = getGraphifyBridge();

export async function graphifyAssetsSkill(ctx: ExecutionContext): Promise<SkillResult> {
  const startTime = Date.now();
  const ws = getWorkspaceManager();

  try {
    const prevData = ctx.previousResults[ctx.previousResults.length - 1]?.data as Record<string, unknown>;

    if (prevData?.skipped) {
      return {
        skillName: '资产构建',
        status: 'success',
        data: { skipped: true },
        tokenUsed: 0,
        duration: (Date.now() - startTime) / 1000,
      };
    }

    ctx.onProgress({
      agentId: 'KE-01',
      role: 'worker',
      content: '构建知识资产（records.jsonl + manifest + 健康报告）',
      timestamp: new Date().toISOString(),
    });

    const assetsResult = await bridge.buildAssets(ws.workspacePath);
    await bridge.saveManifest(ws.workspacePath);

    ctx.onProgress({
      agentId: 'KE-01',
      role: 'worker',
      content: '知识资产构建完成',
      timestamp: new Date().toISOString(),
    });

    return {
      skillName: '资产构建',
      status: 'success',
      data: {
        assets: assetsResult,
        recordsPath: ws.recordsPath,
        manifestPath: ws.manifestPath,
      },
      tokenUsed: 0,
      duration: (Date.now() - startTime) / 1000,
    };
  } catch (err) {
    return {
      skillName: '资产构建',
      status: 'error',
      data: { error: (err as Error).message },
      tokenUsed: 0,
      duration: (Date.now() - startTime) / 1000,
    };
  }
}
