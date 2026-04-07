import type { ExecutionContext, SkillResult } from '../agents/types.js';
import { callLLM } from '../services/LLMService.js';

const ANSWER_SYSTEM_PROMPT = `你是一个知识工程领域的专家助手。根据从知识图谱和原始文档中检索到的知识，回答用户的问题。

规则：
- 基于提供的知识内容回答，不要编造未在知识库中出现的信息
- 特别注意 attributes 字段中的具体数值数据，这些是关键的事实信息
- 如果"原始文档片段"中包含详细数据（如表格行、统计数值），优先引用原始文档中的数据
- 使用 Markdown 格式组织回答，包括标题（##）、列表（-）、加粗（**）、表格等
- 如果有具体数值，务必在回答中**明确引用原始数值**（含单位）
- 在回答末尾标注数据来源，如"📄 数据来源：xxx文档"
- 如果检索到了相关内容，先给出直接回答，再列出相关的知识点
- 如果检索结果不足以完整回答，在回答末尾说明"以上信息来自知识库，可能不够完整"
- 如果完全没有检索到相关信息，友好地说明：知识库中暂未收录该问题的相关知识，建议上传相关文档进行知识入库
- 回答用中文`;

export async function answerGenerateSkill(ctx: ExecutionContext): Promise<SkillResult> {
  const startTime = Date.now();
  const question = ctx.query ?? '';

  const retrieveResult = ctx.previousResults.find((r) => r.skillName === '知识检索');
  const retrieveData = retrieveResult?.data as {
    entityResults?: Array<Record<string, unknown>>;
    chunkResults?: Array<{ text: string; source: string; score: number }>;
    resultCount?: number;
    // backward compat
    results?: Array<Record<string, unknown>>;
  } | undefined;

  if (!retrieveResult || retrieveResult.status !== 'success') {
    return {
      skillName: '答案生成',
      status: 'error',
      data: { error: '前置知识检索步骤未成功，无法生成回答' },
      tokenUsed: 0,
      duration: (Date.now() - startTime) / 1000,
    };
  }

  const entityResults = retrieveData?.entityResults ?? retrieveData?.results ?? [];
  const chunkResults = retrieveData?.chunkResults ?? [];
  const totalCount = (retrieveData?.resultCount ?? 0);

  try {
    const contextParts: string[] = [];

    // Part 1: structured entity data
    if (entityResults.length > 0) {
      const formatted = entityResults.map((r) => {
        const lines = [`实体: ${r.name} (${r.type})`];
        if (r.desc) lines.push(`  描述: ${r.desc}`);
        const attrs = r.attributes as Record<string, unknown> | undefined;
        if (attrs && Object.keys(attrs).length > 0) {
          lines.push('  属性数据:');
          for (const [k, v] of Object.entries(attrs)) {
            lines.push(`    - ${k}: ${v}`);
          }
        }
        const rels = r.relations as Array<{ rel: string; target: string; targetDesc?: string }> | undefined;
        if (rels && rels.length > 0) {
          lines.push('  关联:');
          for (const rel of rels) {
            lines.push(`    - [${rel.rel}] → ${rel.target}${rel.targetDesc ? ` (${rel.targetDesc})` : ''}`);
          }
        }
        return lines.join('\n');
      }).join('\n\n');
      contextParts.push(`## 知识图谱结构化数据（${entityResults.length} 条实体）\n\n${formatted}`);
    }

    // Part 2: raw document chunks from vector search
    if (chunkResults.length > 0) {
      const chunkText = chunkResults.map((c, i) =>
        `[片段${i + 1}] (来源: ${c.source}, 相似度: ${c.score.toFixed(3)})\n${c.text}`,
      ).join('\n\n');
      contextParts.push(`## 原始文档片段（${chunkResults.length} 条匹配）\n\n${chunkText}`);
    }

    let knowledgeContext: string;
    if (contextParts.length > 0) {
      knowledgeContext = contextParts.join('\n\n---\n\n');
    } else {
      knowledgeContext = '知识图谱和文档库中均未检索到直接相关的记录。';
    }

    const userPrompt = `用户问题：${question}\n\n知识库检索结果：\n${knowledgeContext}`;
    const { text, usage } = await callLLM(ANSWER_SYSTEM_PROMPT, userPrompt);

    const duration = (Date.now() - startTime) / 1000;
    return {
      skillName: '答案生成',
      status: 'success',
      data: {
        answer: text,
        basedOnResults: totalCount,
        sources: {
          entities: entityResults.length,
          chunks: chunkResults.length,
        },
      },
      tokenUsed: usage?.inputTokens ?? 0,
      duration,
    };
  } catch (err) {
    console.error('[Skill:answerGenerate] Failed:', (err as Error).message);
    return {
      skillName: '答案生成',
      status: 'error',
      data: { error: (err as Error).message },
      tokenUsed: 0,
      duration: (Date.now() - startTime) / 1000,
    };
  }
}
