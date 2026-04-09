import type { ExecutionContext, SkillResult } from '../agents/types.js';
import { getGraphifyBridge, type ExtractionJSON } from '../services/GraphifyBridge.js';
import { getWorkspaceManager } from '../services/WorkspaceManager.js';

const bridge = getGraphifyBridge();

export async function graphifyBuildSkill(ctx: ExecutionContext): Promise<SkillResult> {
  const startTime = Date.now();
  const ws = getWorkspaceManager();
  let totalTokens = 0;

  try {
    const prevData = ctx.previousResults[ctx.previousResults.length - 1]?.data as Record<string, unknown>;

    if (prevData?.skipped) {
      return {
        skillName: '图谱构建',
        status: 'success',
        data: { skipped: true },
        tokenUsed: 0,
        duration: (Date.now() - startTime) / 1000,
      };
    }

    const extractPath = prevData?.extractPath as string;
    const isIncremental = Boolean(prevData?.isIncremental);

    if (isIncremental && ws.hasExistingGraph()) {
      ctx.onProgress({
        agentId: 'KE-01',
        role: 'worker',
        content: '增量模式：备份当前图谱，准备合并新数据',
        timestamp: new Date().toISOString(),
      });
      await bridge.backupGraph(ws.workspacePath);

      const mergeResult = await bridge.mergeIntoExistingGraph(extractPath, ws.workspacePath);

      ctx.onProgress({
        agentId: 'KE-01',
        role: 'worker',
        content: `图合并完成：共 ${mergeResult.totalNodes} 个节点，${mergeResult.totalEdges} 条关系（新增 +${mergeResult.newNodes}/${mergeResult.newEdges}）`,
        timestamp: new Date().toISOString(),
      });
    } else {
      ctx.onProgress({
        agentId: 'KE-01',
        role: 'worker',
        content: '全量模式：构建 NetworkX 图 + Leiden 社区检测',
        timestamp: new Date().toISOString(),
      });

      await bridge.build(extractPath, ws.workspacePath);
    }

    const analysis = await bridge.analyze(ws.workspacePath);

    const communityNames: Record<string, string> = {};
    const communityIds = Object.keys(analysis.communities);

    if (communityIds.length > 0 && communityIds.length <= 50) {
      ctx.onProgress({
        agentId: 'KE-01',
        role: 'worker',
        content: `社区命名：${communityIds.length} 个社区`,
        timestamp: new Date().toISOString(),
      });

      try {
        const labelsInput = communityIds.map((cid) => ({
          communityId: cid,
          members: analysis.communities[cid].slice(0, 20),
          cohesion: analysis.cohesion[cid] ?? 0,
        }));

        const result = await ctx.services.gateway.runSkill({
          taskId: ctx.taskId,
          workspaceId: ctx.workspaceId,
          skillName: 'graphify-community-label',
          input: { communities: labelsInput },
        });

        totalTokens += (result.usage?.totalTokens ?? 0);

        const labels = (result.result as Record<string, string>) ?? {};
        for (const [cid, label] of Object.entries(labels)) {
          communityNames[cid] = label;
        }
      } catch (err) {
        console.warn('[graphifyBuild] Community labeling failed, using defaults:', (err as Error).message);
        for (const cid of communityIds) {
          communityNames[cid] = `社区 ${cid}`;
        }
      }
    } else {
      for (const cid of communityIds) {
        communityNames[cid] = `社区 ${cid}`;
      }
    }

    if (isIncremental) {
      const diff = await bridge.graphDiff(ws.workspacePath);
      ctx.onProgress({
        agentId: 'KE-01',
        role: 'worker',
        content: `图谱变更：+${diff.newNodes} 节点，+${diff.newEdges} 关系，-${diff.removedNodes} 节点`,
        timestamp: new Date().toISOString(),
      });
    }

    return {
      skillName: '图谱构建',
      status: 'success',
      data: {
        communityNames,
        analysis,
        isIncremental,
        gods: analysis.gods,
        questions: analysis.questions,
      },
      tokenUsed: totalTokens,
      duration: (Date.now() - startTime) / 1000,
    };
  } catch (err) {
    return {
      skillName: '图谱构建',
      status: 'error',
      data: { error: (err as Error).message },
      tokenUsed: totalTokens,
      duration: (Date.now() - startTime) / 1000,
    };
  }
}
