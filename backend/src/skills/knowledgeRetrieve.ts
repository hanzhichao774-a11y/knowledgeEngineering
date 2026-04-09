import type { ExecutionContext, SkillResult } from '../agents/types.js';
import { queryByKeywords, isNeo4jConnected, vectorSearch } from '../db/neo4j.js';
import { embedQuery } from '../services/EmbeddingService.js';

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
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);

  const keywords: string[] = [];
  for (const token of tokens) {
    const cleaned = [...stopWords].reduce((value, stopWord) => value.replace(new RegExp(`^${stopWord}|${stopWord}$`, 'g'), ''), token).trim();
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

  try {
    const graphifySnapshot = await ctx.services.graphify.getSnapshotStatus().catch(() => ({
      ok: false,
      exists: false,
      snapshotId: null,
      assetRoot: '',
      nodeCount: 0,
      edgeCount: 0,
      recordCount: 0,
      freshness: { status: 'missing' as const },
    }));

    if (graphifySnapshot.exists) {
      try {
        const [graphifyAsk, graphifyRecords] = await Promise.all([
          ctx.services.graphify.ask({ question, format: 'structured', topN: 5 }),
          ctx.services.graphify.searchRecords({ query: question, topN: 10 }),
        ]);

        const graphifyAnswer = normalizeStructuredGraphifyAnswer(graphifyAsk.answer);
        const resultCount = graphifyAnswer.records.length + graphifyAnswer.nodes.length + graphifyRecords.records.length;

        return {
          skillName: '知识检索',
          status: 'success',
          data: {
            question,
            resultCount,
            source: 'graphify',
            graphifyAnswer,
            recordResults: graphifyRecords.records,
            graphifySources: graphifyAnswer.sources,
            snapshotId: graphifyAsk.snapshotId ?? graphifySnapshot.snapshotId,
            freshness: graphifyAsk.freshness ?? graphifySnapshot.freshness,
            fallbackUsed: false,
          },
          tokenUsed: 0,
          duration: (Date.now() - startTime) / 1000,
        };
      } catch (graphifyError) {
        console.warn('[Skill:knowledgeRetrieve] Graphify query failed, falling back to Neo4j:', (graphifyError as Error).message);
      }
    }

    if (!isNeo4jConnected()) {
      return {
        skillName: '知识检索',
        status: 'success',
        data: {
          question,
          resultCount: 0,
          source: 'empty',
          entityResults: [],
          chunkResults: [],
          keywords: [],
          snapshotId: graphifySnapshot.snapshotId,
          freshness: graphifySnapshot.freshness,
          fallbackUsed: false,
        },
        tokenUsed: 0,
        duration: (Date.now() - startTime) / 1000,
      };
    }

    const keywords = extractKeywords(question);
    console.log(`[Skill:knowledgeRetrieve] Keywords: [${keywords.join(', ')}]`);

    let entityResults: Record<string, unknown>[] = [];
    if (keywords.length > 0) {
      const keywordResults = await queryByKeywords(keywords);
      if (keywordResults && keywordResults.length > 0) {
        entityResults = keywordResults as unknown as Record<string, unknown>[];
        console.log(`[Skill:knowledgeRetrieve] Keyword channel: ${entityResults.length} entities`);
      }
    }

    if (entityResults.length === 0) {
      const fragments = question.replace(/[？?。，！!,.]/g, '').trim();
      const twoCharKeywords: string[] = [];
      for (let i = 0; i < fragments.length - 1; i += 1) {
        twoCharKeywords.push(fragments.slice(i, i + 2));
      }
      const uniqueFragments = [...new Set(twoCharKeywords)].slice(0, 10);
      if (uniqueFragments.length > 0) {
        const fallbackResults = await queryByKeywords(uniqueFragments);
        if (fallbackResults && fallbackResults.length > 0) {
          entityResults = fallbackResults as unknown as Record<string, unknown>[];
          console.log(`[Skill:knowledgeRetrieve] Keyword fallback: ${entityResults.length} entities`);
        }
      }
    }

    let chunkResults: Array<{ text: string; source: string; score: number }> = [];
    let embeddingTokenUsed = 0;
    try {
      const queryEmbedding = await embedQuery(question);
      embeddingTokenUsed = Math.ceil(question.length / 2);
      const vectorHits = await vectorSearch(queryEmbedding, 5);
      if (vectorHits.length > 0) {
        chunkResults = vectorHits.map((hit) => ({
          text: hit.text,
          source: hit.source,
          score: hit.score,
        }));
        console.log(`[Skill:knowledgeRetrieve] Vector channel: ${chunkResults.length} chunks (top score: ${chunkResults[0].score.toFixed(3)})`);
      }
    } catch (vectorError) {
      console.warn('[Skill:knowledgeRetrieve] Vector search skipped:', (vectorError as Error).message);
    }

    const resultCount = entityResults.length + chunkResults.length;
    const duration = (Date.now() - startTime) / 1000;
    console.log(`[Skill:knowledgeRetrieve] Done in ${duration.toFixed(2)}s — ${entityResults.length} entities + ${chunkResults.length} chunks`);

    return {
      skillName: '知识检索',
      status: 'success',
      data: {
        question,
        entityResults,
        chunkResults,
        resultCount,
        source: chunkResults.length > 0 ? 'neo4j-hybrid' : 'neo4j-keywords',
        keywords,
        snapshotId: graphifySnapshot.snapshotId,
        freshness: graphifySnapshot.freshness,
        fallbackUsed: true,
      },
      tokenUsed: embeddingTokenUsed,
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

function normalizeStructuredGraphifyAnswer(answer: unknown): {
  question: string;
  records: Array<Record<string, unknown>>;
  nodes: Array<Record<string, unknown>>;
  sources: string[];
} {
  if (!answer || typeof answer !== 'object') {
    return {
      question: '',
      records: [],
      nodes: [],
      sources: [],
    };
  }

  const payload = answer as Record<string, unknown>;
  return {
    question: String(payload.question ?? ''),
    records: Array.isArray(payload.records) ? payload.records as Array<Record<string, unknown>> : [],
    nodes: Array.isArray(payload.nodes) ? payload.nodes as Array<Record<string, unknown>> : [],
    sources: Array.isArray(payload.sources) ? payload.sources.filter((item): item is string => typeof item === 'string') : [],
  };
}
