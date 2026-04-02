import type { ExecutionContext, SkillResult } from '../agents/types.js';
import { callLLM, extractJSON } from '../services/LLMService.js';
import { queryByKeywords, runCypher, getGraphSchema, isNeo4jConnected } from '../db/neo4j.js';

const CYPHER_SYSTEM_PROMPT = `你是一个 Neo4j Cypher 查询专家。根据用户的问题和图数据库的 Schema 信息，生成一条 Cypher 查询语句来检索相关知识。

规则：
- 只生成 MATCH / OPTIONAL MATCH / WHERE / RETURN / LIMIT 语句
- 不要使用 CREATE / DELETE / SET / MERGE 等写操作
- 使用模糊匹配：WHERE n.name CONTAINS '关键词' 或 WHERE n.description CONTAINS '关键词'
- LIMIT 不超过 20
- 同时返回关联的关系和邻居节点

返回 JSON 格式：
\`\`\`json
{
  "cypher": "<Cypher查询语句>",
  "keywords": ["关键词1", "关键词2"]
}
\`\`\``;

export async function knowledgeRetrieveSkill(ctx: ExecutionContext): Promise<SkillResult> {
  const startTime = Date.now();
  const question = ctx.query ?? '';

  if (!isNeo4jConnected()) {
    return {
      skillName: '知识检索',
      status: 'error',
      data: { error: 'Neo4j 未连接，无法检索知识库' },
      tokenUsed: 0,
      duration: (Date.now() - startTime) / 1000,
    };
  }

  try {
    const schema = await getGraphSchema();
    const schemaDesc = schema
      ? `节点标签: ${schema.nodeLabels.join(', ')}\n关系类型: ${schema.relationshipTypes.join(', ')}`
      : '无 Schema 信息';

    const userPrompt = `图数据库 Schema:\n${schemaDesc}\n\n用户问题: ${question}`;
    const { text, usage } = await callLLM(CYPHER_SYSTEM_PROMPT, userPrompt);
    const parsed = extractJSON<{ cypher: string; keywords: string[] }>(text);

    let results: Record<string, unknown>[] = [];
    let source = 'cypher';

    try {
      const cypherResults = await runCypher(parsed.cypher);
      results = cypherResults ?? [];
      console.log(`[Skill:knowledgeRetrieve] Cypher returned ${results.length} records`);
    } catch (cypherErr) {
      console.warn('[Skill:knowledgeRetrieve] Cypher failed, falling back to keyword search:', (cypherErr as Error).message);
      source = 'keywords';
    }

    if (results.length === 0 && parsed.keywords?.length > 0) {
      const kwResults = await queryByKeywords(parsed.keywords);
      if (kwResults && kwResults.length > 0) {
        results = kwResults as unknown as Record<string, unknown>[];
        source = 'keywords';
        console.log(`[Skill:knowledgeRetrieve] Keyword search returned ${results.length} records`);
      }
    }

    const duration = (Date.now() - startTime) / 1000;
    return {
      skillName: '知识检索',
      status: 'success',
      data: {
        question,
        results,
        resultCount: results.length,
        source,
        cypher: parsed.cypher,
      },
      tokenUsed: usage?.inputTokens ?? 0,
      duration,
    };
  } catch (err) {
    console.error('[Skill:knowledgeRetrieve] Failed:', (err as Error).message);
    return {
      skillName: '知识检索',
      status: 'error',
      data: { error: (err as Error).message },
      tokenUsed: 0,
      duration: (Date.now() - startTime) / 1000,
    };
  }
}
