import type { ExecutionContext, SkillResult } from '../agents/types.js';
import { callLLM } from '../services/LLMService.js';

const SYSTEM_PROMPT = `你是一个知识工程专家。根据提供的本体提取结果，构建 RDF/OWL Schema（Turtle 格式）。

要求：
1. 使用 @prefix biz: <http://bizagentos.ai/ontology/> 作为命名空间
2. 为每个 entity 类型创建 rdfs:Class
3. 为每个 relation 类型创建 rdf:Property（包含 domain 和 range）
4. 为每个 attr 类型创建 owl:DatatypeProperty
5. 为每个 rule 类型添加注释说明

直接返回 Turtle 格式的 Schema 文本，不要包含 JSON 和 markdown 代码块标记。`;

export async function schemaBuildSkill(ctx: ExecutionContext): Promise<SkillResult> {
  const startTime = Date.now();
  const ontologyResult = ctx.previousResults.find((r) => r.skillName === '本体提取');
  const ontologyData = ontologyResult?.data as Record<string, unknown> | undefined;

  const userPrompt = `本体提取结果：\n${JSON.stringify(ontologyData, null, 2)}\n\n请据此构建 RDF Schema。`;

  try {
    const { text, usage } = await callLLM(SYSTEM_PROMPT, userPrompt);
    const schema = text.replace(/```[\w]*\n?/g, '').trim();

    const classCount = (schema.match(/a\s+rdfs:Class/g) || []).length;
    const propertyCount = (schema.match(/a\s+rdf:Property/g) || []).length +
                          (schema.match(/a\s+owl:DatatypeProperty/g) || []).length;

    const duration = (Date.now() - startTime) / 1000;

    return {
      skillName: 'Schema 构建',
      status: 'success',
      data: { schema, classCount, propertyCount, constraintCount: 0 },
      tokenUsed: usage?.inputTokens ?? 0,
      duration,
    };
  } catch (err) {
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
