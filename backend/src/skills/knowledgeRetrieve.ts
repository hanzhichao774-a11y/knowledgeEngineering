import type { ExecutionContext, SkillResult } from '../agents/types.js';
import { queryByKeywords, isNeo4jConnected } from '../db/neo4j.js';

/**
 * Extract search keywords from a Chinese question without LLM.
 * Splits on common stop words / punctuation and filters short fragments.
 */
function extractKeywords(question: string): string[] {
  const stopWords = new Set([
    '的', '了', '吗', '呢', '是', '在', '有', '和', '与', '及', '或',
    '请问', '什么', '多少', '哪些', '怎么', '如何', '为什么', '请',
    '告诉', '我', '你', '他', '她', '它', '们', '这', '那', '个',
    '一', '不', '也', '都', '就', '还', '会', '能', '要', '该',
    '当', '当天', '今天', '昨天', '目前', '现在', '其中',
    '一下', '一些', '所有', '全部', '关于', '对于',
  ]);

  const separators = /[，。？！、；：""''（）\s,.\?!;:()[\]{}<>·\-—_\/\\|@#$%^&*+=~`]/;
  const tokens = question
    .split(separators)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);

  const keywords: string[] = [];
  for (const token of tokens) {
    const cleaned = [...stopWords].reduce((s, w) => s.replace(new RegExp(`^${w}|${w}$`, 'g'), ''), token).trim();
    if (cleaned.length >= 2) {
      keywords.push(cleaned);
    }
  }

  if (keywords.length === 0 && question.trim().length >= 2) {
    keywords.push(question.trim());
  }

  return [...new Set(keywords)];
}

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
    const keywords = extractKeywords(question);
    console.log(`[Skill:knowledgeRetrieve] Local keywords: [${keywords.join(', ')}]`);

    let results: Record<string, unknown>[] = [];

    if (keywords.length > 0) {
      const kwResults = await queryByKeywords(keywords);
      if (kwResults && kwResults.length > 0) {
        results = kwResults as unknown as Record<string, unknown>[];
        console.log(`[Skill:knowledgeRetrieve] Found ${results.length} records via keyword search`);
      }
    }

    if (results.length === 0) {
      const fragments = question.replace(/[？?。，！!,.]/g, '').trim();
      const twoCharKeywords: string[] = [];
      for (let i = 0; i < fragments.length - 1; i++) {
        twoCharKeywords.push(fragments.slice(i, i + 2));
      }
      const uniqueFragments = [...new Set(twoCharKeywords)].slice(0, 10);
      if (uniqueFragments.length > 0) {
        console.log(`[Skill:knowledgeRetrieve] Fallback sliding-window keywords: [${uniqueFragments.join(', ')}]`);
        const fallbackResults = await queryByKeywords(uniqueFragments);
        if (fallbackResults && fallbackResults.length > 0) {
          results = fallbackResults as unknown as Record<string, unknown>[];
          console.log(`[Skill:knowledgeRetrieve] Fallback found ${results.length} records`);
        }
      }
    }

    const duration = (Date.now() - startTime) / 1000;
    console.log(`[Skill:knowledgeRetrieve] Done in ${duration.toFixed(2)}s — ${results.length} results, 0 tokens used`);
    return {
      skillName: '知识检索',
      status: 'success',
      data: {
        question,
        results,
        resultCount: results.length,
        source: 'local',
        keywords,
      },
      tokenUsed: 0,
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
