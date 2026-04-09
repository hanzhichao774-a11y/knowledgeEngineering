import type { ExecutionContext, SkillResult } from '../agents/types.js';

export interface OntologyClass {
  name: string;
  desc: string;
}

export interface OntologyEntity {
  name: string;
  class: string;
  desc: string;
}

export interface OntologyRelation {
  name: string;
  source: string;
  target: string;
  desc: string;
}

export interface OntologyAttribute {
  name: string;
  entity: string;
  value: string;
  desc: string;
}

export interface OntologyData {
  classes: OntologyClass[];
  entities: OntologyEntity[];
  relations: OntologyRelation[];
  attributes: OntologyAttribute[];
}

export async function ontologyExtractSkill(ctx: ExecutionContext): Promise<SkillResult> {
  const startTime = Date.now();
  const docResult = ctx.previousResults.find((r) => r.skillName === '多模态文档解析');
  const docData = docResult?.data as Record<string, unknown> | undefined;
  const rawText = (docData?.rawText as string) ?? '';
  const summary = (docData?.summary as string) ?? '';

  const docContent = rawText || summary || '无文档内容';

  try {
    const gatewayResult = await ctx.services.gateway.runSkill({
      taskId: ctx.taskId,
      workspaceId: ctx.workspaceId,
      skillName: 'ontology-extract',
      input: {
        documentText: docContent,
      },
      context: {
        filePath: ctx.filePath,
      },
    });
    const data = gatewayResult.result as unknown as OntologyData;

    const entityNames = new Set(data.entities?.map((entity) => entity.name) ?? []);
    const validRelations = (data.relations ?? []).filter(
      (relation) => entityNames.has(relation.source) && entityNames.has(relation.target),
    );
    const validAttributes = (data.attributes ?? []).filter(
      (attribute) => entityNames.has(attribute.entity),
    );

    const result: OntologyData & Record<string, unknown> = {
      classes: data.classes ?? [],
      entities: data.entities ?? [],
      relations: validRelations,
      attributes: validAttributes,
      classCount: data.classes?.length ?? 0,
      entityCount: data.entities?.length ?? 0,
      relationCount: validRelations.length,
      attrCount: validAttributes.length,
    };

    console.log(
      `[Skill:ontologyExtract] Extracted: ${result.classCount} classes, ${result.entityCount} entities, ${result.relationCount} relations, ${result.attrCount} attributes`,
    );

    const duration = (Date.now() - startTime) / 1000;
    return {
      skillName: '本体提取',
      status: 'success',
      data: result,
      tokenUsed: gatewayResult.usage.inputTokens,
      duration,
    };
  } catch (err) {
    console.error('[Skill:ontologyExtract] Failed:', (err as Error).message);
    const duration = (Date.now() - startTime) / 1000;
    return {
      skillName: '本体提取',
      status: 'error',
      data: { error: (err as Error).message },
      tokenUsed: 0,
      duration,
    };
  }
}
