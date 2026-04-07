import type { ExecutionContext, SkillResult } from '../agents/types.js';
import { writeOntologyToGraph, storeChunks, linkChunksToEntities, type OntologyInput, type ChunkInput } from '../db/neo4j.js';
import { splitIntoChunks } from '../services/ChunkService.js';
import { embedTexts } from '../services/EmbeddingService.js';

export async function graphDBWriteSkill(ctx: ExecutionContext): Promise<SkillResult> {
  const startTime = Date.now();
  const ontologyResult = ctx.previousResults.find((r) => r.skillName === '本体提取');
  const ontologyData = ontologyResult?.data as OntologyInput | undefined;

  if (!ontologyData) {
    return {
      skillName: '图数据库写入',
      status: 'error',
      data: { error: '未找到本体提取结果' },
      tokenUsed: 0,
      duration: (Date.now() - startTime) / 1000,
    };
  }

  try {
    const result = await writeOntologyToGraph(ontologyData);
    const usedRealDB = result !== null;

    const nodeCount = (ontologyData.classes?.length ?? 0) + (ontologyData.entities?.length ?? 0);
    const edgeCount = ontologyData.relations?.length ?? 0;

    let chunksStored = 0;
    let linksCreated = 0;

    if (usedRealDB) {
      const docResult = ctx.previousResults.find((r) => r.skillName === '多模态文档解析');
      const rawText = (docResult?.data as Record<string, unknown> | undefined)?.rawText as string | undefined;

      if (rawText) {
        try {
          const taskTitle = ctx.query || 'document';
          const chunks = splitIntoChunks(rawText, { source: taskTitle });

          if (chunks.length > 0) {
            const texts = chunks.map((c) => c.text);
            console.log(`[graphDBWrite] Embedding ${texts.length} chunks...`);
            const embeddings = await embedTexts(texts);

            const chunkInputs: ChunkInput[] = chunks.map((c, i) => ({
              text: c.text,
              embedding: embeddings[i],
              position: c.position,
              source: c.source,
            }));

            chunksStored = await storeChunks(chunkInputs);

            const entityNames = ontologyData.entities?.map((e) => e.name) ?? [];
            linksCreated = await linkChunksToEntities(entityNames);
          }
        } catch (chunkErr) {
          console.error('[graphDBWrite] Chunk storage failed (non-fatal):', (chunkErr as Error).message);
        }
      }
    }

    const duration = (Date.now() - startTime) / 1000;
    return {
      skillName: '图数据库写入',
      status: 'success',
      data: {
        nodesWritten: nodeCount,
        edgesWritten: edgeCount,
        chunksStored,
        linksCreated,
        database: usedRealDB ? 'neo4j' : 'mock',
      },
      tokenUsed: 0,
      duration,
    };
  } catch (err) {
    const duration = (Date.now() - startTime) / 1000;
    return {
      skillName: '图数据库写入',
      status: 'error',
      data: { error: (err as Error).message },
      tokenUsed: 0,
      duration,
    };
  }
}
