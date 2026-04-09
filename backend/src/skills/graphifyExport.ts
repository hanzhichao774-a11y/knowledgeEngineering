import type { ExecutionContext, SkillResult } from '../agents/types.js';
import { getGraphifyBridge } from '../services/GraphifyBridge.js';
import { getWorkspaceManager } from '../services/WorkspaceManager.js';

const bridge = getGraphifyBridge();

export async function graphifyExportSkill(ctx: ExecutionContext): Promise<SkillResult> {
  const startTime = Date.now();
  const ws = getWorkspaceManager();

  try {
    const prevData = ctx.previousResults[ctx.previousResults.length - 1]?.data as Record<string, unknown>;

    if (prevData?.skipped) {
      return {
        skillName: '知识导出',
        status: 'success',
        data: { skipped: true },
        tokenUsed: 0,
        duration: (Date.now() - startTime) / 1000,
      };
    }

    const communityNames = (prevData?.communityNames ?? {}) as Record<string, string>;

    ctx.onProgress({
      agentId: 'KE-01',
      role: 'worker',
      content: '生成 HTML 交互式图谱',
      timestamp: new Date().toISOString(),
    });

    const htmlPath = await bridge.exportHTML(ws.workspacePath, communityNames);

    ctx.onProgress({
      agentId: 'KE-01',
      role: 'worker',
      content: '生成 GRAPH_REPORT.md 分析报告',
      timestamp: new Date().toISOString(),
    });

    const reportPath = await bridge.generateReport(
      ws.workspacePath,
      communityNames,
      ws.rawDir,
    );

    ctx.onProgress({
      agentId: 'KE-01',
      role: 'worker',
      content: '推送图谱数据到 Neo4j',
      timestamp: new Date().toISOString(),
    });

    const pushResult = await bridge.pushToNeo4j(ws.workspacePath);

    if (pushResult.nodes > 0) {
      ctx.onProgress({
        agentId: 'KE-01',
        role: 'worker',
        content: `Neo4j 写入完成：${pushResult.nodes} 个节点，${pushResult.edges} 条关系`,
        timestamp: new Date().toISOString(),
      });
    }

    return {
      skillName: '知识导出',
      status: 'success',
      data: {
        htmlPath,
        reportPath,
        neo4j: pushResult,
        graphJsonPath: ws.graphJsonPath,
      },
      tokenUsed: 0,
      duration: (Date.now() - startTime) / 1000,
    };
  } catch (err) {
    return {
      skillName: '知识导出',
      status: 'error',
      data: { error: (err as Error).message },
      tokenUsed: 0,
      duration: (Date.now() - startTime) / 1000,
    };
  }
}
