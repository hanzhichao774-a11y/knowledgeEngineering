import type { ExecutionContext, SkillResult } from '../agents/types.js';
import { writeOntologyToGraph, type OntologyInput } from '../db/neo4j.js';

export async function graphDBWriteSkill(ctx: ExecutionContext): Promise<SkillResult> {
  const startTime = Date.now();
  const ontologyResult = ctx.previousResults.find((r) => r.skillName === '本体提取');
  const ontologyData = ontologyResult?.data as OntologyInput | undefined;

  if (!ontologyData) {
    return {
      skillName: '图数据库写入',
      status: 'error',
      data: { error: '未找到本体提取结果' },
      tokenUsed: 0,
      duration: (Date.now() - startTime) / 1000,
    };
  }

  try {
    const result = await writeOntologyToGraph(ontologyData);
    const usedRealDB = result !== null;
    const duration = (Date.now() - startTime) / 1000;

    const nodeCount = (ontologyData.classes?.length ?? 0) + (ontologyData.entities?.length ?? 0);
    const edgeCount = ontologyData.relations?.length ?? 0;

    return {
      skillName: '图数据库写入',
      status: 'success',
      data: {
        nodesWritten: nodeCount,
        edgesWritten: edgeCount,
        database: usedRealDB ? 'neo4j' : 'mock',
      },
      tokenUsed: 0,
      duration,
    };
  } catch (err) {
    const duration = (Date.now() - startTime) / 1000;
    return {
      skillName: '图数据库写入',
      status: 'error',
      data: { error: (err as Error).message },
      tokenUsed: 0,
      duration,
    };
  }
}
