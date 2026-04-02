import type { ExecutionContext, SkillResult } from '../agents/types.js';
import { writeOntologyToGraph } from '../db/neo4j.js';

/**
 * Writes ontology data to Neo4j if a driver is available.
 * Falls back to counting nodes/edges when Neo4j is not configured.
 */
export async function graphDBWriteSkill(ctx: ExecutionContext): Promise<SkillResult> {
  const startTime = Date.now();
  const ontologyResult = ctx.previousResults.find((r) => r.skillName === '本体提取');
  const ontologyData = ontologyResult?.data as {
    entities?: Array<{ name: string; type: string; desc: string }>;
    entityCount?: number;
    relationCount?: number;
  } | undefined;

  const entities = ontologyData?.entities ?? [];
  const nodeCount = entities.filter((e) => e.type !== 'relation').length;
  const edgeCount = entities.filter((e) => e.type === 'relation').length;

  try {
    const result = await writeOntologyToGraph({ entities });
    const usedRealDB = result !== null;
    const duration = (Date.now() - startTime) / 1000;

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
