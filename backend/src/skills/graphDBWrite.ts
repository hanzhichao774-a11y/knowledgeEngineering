import type { ExecutionContext, SkillResult } from '../agents/types.js';

/**
 * Graph database write skill.
 * In production: writes extracted ontology data to Neo4j.
 * Currently: simulates the write operation.
 */
export async function graphDBWriteSkill(_ctx: ExecutionContext): Promise<SkillResult> {
  await sleep(randomBetween(1000, 3000));

  return {
    skillName: '图数据库写入',
    status: 'success',
    data: {
      nodesWritten: 18,
      edgesWritten: 12,
      database: 'neo4j',
    },
    tokenUsed: 5800,
    duration: 2.1,
  };
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function randomBetween(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
