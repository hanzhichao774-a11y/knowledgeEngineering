import type { ExecutionContext, SkillResult } from '../agents/types.js';
import type { OntologyData } from './ontologyExtract.js';

export async function graphGenerateSkill(ctx: ExecutionContext): Promise<SkillResult> {
  const startTime = Date.now();
  const ontologyResult = ctx.previousResults.find((r) => r.skillName === '本体提取');
  const data = ontologyResult?.data as OntologyData | undefined;

  const classes = data?.classes ?? [];
  const entities = data?.entities ?? [];
  const relations = data?.relations ?? [];

  let idCounter = 0;
  const nameToId = new Map<string, string>();

  const nodes: Array<{ id: string; label: string; type: string }> = [];

  for (const cls of classes) {
    const id = `c${++idCounter}`;
    nameToId.set(cls.name, id);
    nodes.push({ id, label: cls.name, type: 'class' });
  }

  for (const entity of entities) {
    const id = `e${++idCounter}`;
    nameToId.set(entity.name, id);
    nodes.push({ id, label: entity.name, type: 'entity' });
  }

  const edges: Array<{ source: string; target: string; label: string }> = [];

  for (const entity of entities) {
    if (entity.class) {
      const classId = nameToId.get(entity.class);
      const entityId = nameToId.get(entity.name);
      if (classId && entityId) {
        edges.push({ source: entityId, target: classId, label: '属于' });
      }
    }
  }

  for (const rel of relations) {
    const sourceId = nameToId.get(rel.source);
    const targetId = nameToId.get(rel.target);
    if (sourceId && targetId) {
      edges.push({ source: sourceId, target: targetId, label: rel.name });
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
