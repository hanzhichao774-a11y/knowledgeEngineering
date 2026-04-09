import type { ExecutionContext, SkillResult } from '../agents/types.js';
import { queryByKeywords, isNeo4jConnected, vectorSearch } from '../db/neo4j.js';
import { getGraphifyBridge } from '../services/GraphifyBridge.js';
import { getWorkspaceManager } from '../services/WorkspaceManager.js';
import type { DocSnippet } from '../services/GraphifyBridge.js';

const bridge = getGraphifyBridge();

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
  const ws = getWorkspaceManager();

  try {
    if (ws.hasExistingGraph()) {
      const docSnippets = bridge.searchConvertedDocs(question, ws.workspacePath, 8);

      const [askResult, recordsResult] = await Promise.allSettled([
        bridge.ask(question, ws.workspacePath, 5),
        bridge.searchRecords(question, ws.workspacePath, 10),
      ]);

      const graphAnswer = askResult.status === 'fulfilled' ? askResult.value : '';
      const recordResults = recordsResult.status === 'fulfilled' ? recordsResult.value : [];

      if (askResult.status === 'rejected') {
        console.warn('[knowledgeRetrieve] bridge.ask failed:', (askResult.reason as Error).message);
      }
      if (recordsResult.status === 'rejected') {
        console.warn('[knowledgeRetrieve] bridge.searchRecords failed:', (recordsResult.reason as Error).message);
      }

      const resultCount = recordResults.length + docSnippets.length + (graphAnswer ? 1 : 0);

      return {
        skillName: '知识检索',
        status: 'success',
        data: {
          question,
          resultCount,
          source: 'graphify-local',
          graphifyAnswer: graphAnswer,
          recordResults,
          docSnippets,
          graphifySources: [
            ...recordResults.map((r) => String(r.source_file ?? '')).filter(Boolean),
            ...docSnippets.map((s) => s.file).filter(Boolean),
          ],
          fallbackUsed: false,
        },
        tokenUsed: 0,
        duration: (Date.now() - startTime) / 1000,
      };
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
          fallbackUsed: false,
        },
        tokenUsed: 0,
        duration: (Date.now() - startTime) / 1000,
      };
    }

    const keywords = extractKeywords(question);

    let entityResults: Record<string, unknown>[] = [];
    if (keywords.length > 0) {
      const keywordResults = await queryByKeywords(keywords);
      if (keywordResults && keywordResults.length > 0) {
        entityResults = keywordResults as unknown as Record<string, unknown>[];
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
        }
      }
    }

    let chunkResults: Array<{ text: string; source: string; score: number }> = [];
    try {
      const { embedQuery } = await import('../services/EmbeddingService.js');
      const queryEmbedding = await embedQuery(question);
      const vectorHits = await vectorSearch(queryEmbedding, 5);
      if (vectorHits.length > 0) {
        chunkResults = vectorHits.map((hit) => ({
          text: hit.text,
          source: hit.source,
          score: hit.score,
        }));
      }
    } catch (vectorError) {
      console.warn('[knowledgeRetrieve] Vector search skipped:', (vectorError as Error).message);
    }

    const resultCount = entityResults.length + chunkResults.length;

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
        fallbackUsed: true,
      },
      tokenUsed: 0,
      duration: (Date.now() - startTime) / 1000,
    };
  } catch (err) {
    console.error('[knowledgeRetrieve] Failed:', (err as Error).message);
    return {
      skillName: '知识检索',
      status: 'error',
      data: { error: (err as Error).message },
      tokenUsed: 0,
      duration: (Date.now() - startTime) / 1000,
    };
  }
}
