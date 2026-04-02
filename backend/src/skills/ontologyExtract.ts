import type { ExecutionContext, SkillResult } from '../agents/types.js';
import { callLLM, extractJSON } from '../services/LLMService.js';

const SYSTEM_PROMPT = `你是一个知识工程专家。根据提供的文档解析结果，提取本体（Ontology），包括实体、关系、规则和属性。

要求返回如下 JSON 结构：
\`\`\`json
{
  "entities": [
    { "name": "实体名", "type": "entity|relation|attr|rule", "desc": "简短描述" }
  ],
  "entityCount": <entity类型数量>,
  "relationCount": <relation类型数量>,
  "ruleCount": <rule类型数量>,
  "attrCount": <attr类型数量>
}
\`\`\`

type 字段只能是 entity、relation、attr、rule 四种之一。
entities 数组应包含所有四种类型的条目。
请尽量全面提取，实体数量在 10-20 个左右，关系 5-15 个，规则 5-10 个，属性 10-25 个。`;

export async function ontologyExtractSkill(ctx: ExecutionContext): Promise<SkillResult> {
  const startTime = Date.now();
  const docResult = ctx.previousResults.find((r) => r.skillName === '多模态文档解析');
  const docData = docResult?.data as Record<string, unknown> | undefined;
  const summary = (docData?.summary as string) ?? '无文档摘要';

  const userPrompt = `文档摘要：${summary}\n\n请从该文档中提取本体信息（实体、关系、规则、属性）。`;

  try {
    const { text, usage } = await callLLM(SYSTEM_PROMPT, userPrompt);
    const data = extractJSON(text);
    const duration = (Date.now() - startTime) / 1000;

    return {
      skillName: '本体提取',
      status: 'success',
      data,
      tokenUsed: usage?.inputTokens ?? 0,
      duration,
    };
  } catch (err) {
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
