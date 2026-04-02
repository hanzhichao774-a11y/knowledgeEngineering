import type { ExecutionContext, SkillResult } from '../agents/types.js';

/**
 * Generates graph visualization data (nodes + edges) from ontology results.
 * This is a deterministic transform — no LLM call needed.
 */
export async function graphGenerateSkill(ctx: ExecutionContext): Promise<SkillResult> {
  const startTime = Date.now();
  const ontologyResult = ctx.previousResults.find((r) => r.skillName === '本体提取');
  const ontologyData = ontologyResult?.data as {
    entities?: Array<{ name: string; type: string; desc: string }>;
  } | undefined;

  const entities = ontologyData?.entities ?? [];

  const nodeEntities = entities.filter((e) => e.type !== 'relation');
  const relationEntities = entities.filter((e) => e.type === 'relation');

  const typeMap: Record<string, 'entity' | 'concept' | 'rule'> = {
    entity: 'entity',
    attr: 'concept',
    rule: 'rule',
  };

  const nodes = nodeEntities.map((e, i) => ({
    id: `n${i + 1}`,
    label: e.name,
    type: typeMap[e.type] ?? 'entity',
  }));

  const nodeNameToId = new Map(nodes.map((n) => [n.label, n.id]));

  const edges = relationEntities
    .map((rel) => {
      const parts = rel.desc.split('→').map((s) => s.trim());
      if (parts.length === 2) {
        const sourceId = nodeNameToId.get(parts[0]);
        const targetId = nodeNameToId.get(parts[1]);
        if (sourceId && targetId) {
          return { source: sourceId, target: targetId, label: rel.name };
        }
      }
      return null;
    })
    .filter((e): e is NonNullable<typeof e> => e !== null);

  if (edges.length < 3 && nodes.length >= 3) {
    for (let i = 0; i < Math.min(nodes.length - 1, 5); i++) {
      const exists = edges.some((e) => e.source === nodes[i].id && e.target === nodes[i + 1].id);
      if (!exists) {
        edges.push({ source: nodes[i].id, target: nodes[i + 1].id, label: '关联' });
      }
    }
  }

  const duration = (Date.now() - startTime) / 1000;

  return {
    skillName: '知识图谱生成',
    status: 'success',
    data: {
      nodes,
      edges,
      nodeCount: nodes.length,
      edgeCount: edges.length,
    },
    tokenUsed: 0,
    duration,
  };
}
