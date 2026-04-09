import type { ExecutionContext, SkillResult } from '../agents/types.js';

export async function schemaBuildSkill(ctx: ExecutionContext): Promise<SkillResult> {
  const startTime = Date.now();
  const ontologyResult = ctx.previousResults.find((r) => r.skillName === '本体提取');
  const ontologyData = ontologyResult?.data as Record<string, unknown> | undefined;

  try {
    const gatewayResult = await ctx.services.gateway.runSkill({
      taskId: ctx.taskId,
      workspaceId: ctx.workspaceId,
      skillName: 'schema-build',
      input: {
        ontologyData,
      },
    });
    const schema = String(gatewayResult.result.schema ?? '').trim();

    const classCount = (schema.match(/a\s+rdfs:Class/g) || []).length;
    const propertyCount = (schema.match(/a\s+rdf:Property/g) || []).length +
      (schema.match(/a\s+owl:DatatypeProperty/g) || []).length;

    const duration = (Date.now() - startTime) / 1000;

    return {
      skillName: 'Schema 构建',
      status: 'success',
      data: { schema, classCount, propertyCount, constraintCount: 0 },
      tokenUsed: gatewayResult.usage.inputTokens,
      duration,
    };
  } catch (err) {
    console.error('[Skill:schemaBuild] Failed:', (err as Error).message);
    const duration = (Date.now() - startTime) / 1000;
    return {
      skillName: 'Schema 构建',
      status: 'error',
      data: { error: (err as Error).message },
      tokenUsed: 0,
      duration,
    };
  }
}
