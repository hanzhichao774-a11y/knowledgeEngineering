import { writeFileSync } from 'node:fs';
import path from 'node:path';
import type { ExecutionContext, SkillResult } from '../agents/types.js';
import { getGraphifyBridge, type ExtractionJSON } from '../services/GraphifyBridge.js';
import { getWorkspaceManager } from '../services/WorkspaceManager.js';

const bridge = getGraphifyBridge();

function isCodeOnly(files: Record<string, string[]>): boolean {
  const nonCodeTypes = ['document', 'paper', 'image'];
  return nonCodeTypes.every((t) => (files[t] ?? []).length === 0);
}

function splitIntoChunks(files: string[], chunkSize = 22): string[][] {
  const chunks: string[][] = [];
  for (let i = 0; i < files.length; i += chunkSize) {
    chunks.push(files.slice(i, i + chunkSize));
  }
  return chunks;
}

export async function graphifyExtractSkill(ctx: ExecutionContext): Promise<SkillResult> {
  const startTime = Date.now();
  const ws = getWorkspaceManager();

  try {
    const prevData = ctx.previousResults[ctx.previousResults.length - 1]?.data as Record<string, unknown>;

    if (prevData?.skipRemaining) {
      return {
        skillName: '知识提取',
        status: 'success',
        data: { skipped: true, message: '无需提取' },
        tokenUsed: 0,
        duration: (Date.now() - startTime) / 1000,
      };
    }

    const detection = prevData?.detection as Record<string, unknown>;
    const files = (detection?.files ?? detection?.new_files ?? {}) as Record<string, string[]>;
    const isIncremental = Boolean(prevData?.isIncremental);

    const codeFiles = files.code ?? [];
    const docFiles = [
      ...(files.document ?? []),
      ...(files.paper ?? []),
      ...(files.image ?? []),
    ];

    let astResult: ExtractionJSON = { nodes: [], edges: [], input_tokens: 0, output_tokens: 0 };
    let semanticResult: ExtractionJSON = { nodes: [], edges: [], hyperedges: [], input_tokens: 0, output_tokens: 0 };
    let totalTokens = 0;

    if (codeFiles.length > 0) {
      ctx.onProgress({
        agentId: 'KE-01',
        role: 'worker',
        content: `AST 结构提取：${codeFiles.length} 个代码文件`,
        timestamp: new Date().toISOString(),
      });
      astResult = await bridge.extractAST(codeFiles, ws.workspacePath);
    }

    if (docFiles.length > 0 && !isCodeOnly(files)) {
      const cacheResult = await bridge.checkSemanticCache(docFiles, ws.workspacePath);
      const uncached = cacheResult.uncached;

      if (cacheResult.cached.nodes.length > 0) {
        semanticResult = cacheResult.cached;
        ctx.onProgress({
          agentId: 'KE-01',
          role: 'worker',
          content: `缓存命中：${docFiles.length - uncached.length} 个文件，${uncached.length} 个需要 LLM 提取`,
          timestamp: new Date().toISOString(),
        });
      }

      if (uncached.length > 0) {
        const chunks = splitIntoChunks(uncached);
        let failedCount = 0;

        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          ctx.onProgress({
            agentId: 'KE-01',
            role: 'worker',
            content: `语义提取：第 ${i + 1}/${chunks.length} 组（${chunk.length} 个文件）`,
            timestamp: new Date().toISOString(),
          });

          try {
            const result = await ctx.services.gateway.runSkill({
              taskId: ctx.taskId,
              workspaceId: ctx.workspaceId,
              skillName: 'graphify-semantic-extract',
              input: {
                fileContents: await readFilesContent(chunk, ws.workspacePath),
                chunkNum: i + 1,
                totalChunks: chunks.length,
                sourceFile: chunk.join(', '),
              },
            });

            const extracted = result.result as unknown as ExtractionJSON;
            if (extracted?.nodes) {
              semanticResult.nodes.push(...extracted.nodes);
              semanticResult.edges.push(...(extracted.edges ?? []));
              if (extracted.hyperedges) {
                semanticResult.hyperedges = semanticResult.hyperedges ?? [];
                semanticResult.hyperedges.push(...extracted.hyperedges);
              }
            }
            totalTokens += (result.usage?.totalTokens ?? 0);
          } catch (err) {
            console.warn(`[graphifyExtract] Chunk ${i + 1} failed:`, (err as Error).message);
            failedCount++;
          }
        }

        if (failedCount > chunks.length / 2) {
          return {
            skillName: '知识提取',
            status: 'error',
            data: { error: `超过半数文件组提取失败（${failedCount}/${chunks.length}）` },
            tokenUsed: totalTokens,
            duration: (Date.now() - startTime) / 1000,
          };
        }

        await bridge.saveSemanticCache(semanticResult, ws.workspacePath);
      }
    }

    const seen = new Set<string>();
    const mergedNodes: Record<string, unknown>[] = [];
    for (const n of astResult.nodes) {
      const id = (n as { id: string }).id;
      if (!seen.has(id)) {
        seen.add(id);
        mergedNodes.push(n);
      }
    }
    for (const n of semanticResult.nodes) {
      const id = (n as { id: string }).id;
      if (!seen.has(id)) {
        seen.add(id);
        mergedNodes.push(n);
      }
    }

    const merged: ExtractionJSON = {
      nodes: mergedNodes,
      edges: [...astResult.edges, ...semanticResult.edges],
      hyperedges: semanticResult.hyperedges ?? [],
      input_tokens: semanticResult.input_tokens,
      output_tokens: semanticResult.output_tokens,
    };

    const extractPath = path.join(ws.workspacePath, '.graphify_extract.json');
    writeFileSync(extractPath, JSON.stringify(merged, null, 2));

    ctx.onProgress({
      agentId: 'KE-01',
      role: 'worker',
      content: `提取完成：${mergedNodes.length} 个节点，${merged.edges.length} 条关系（AST: ${astResult.nodes.length}，语义: ${semanticResult.nodes.length}）`,
      timestamp: new Date().toISOString(),
    });

    return {
      skillName: '知识提取',
      status: 'success',
      data: { mergedExtraction: merged, extractPath, isIncremental },
      tokenUsed: totalTokens,
      duration: (Date.now() - startTime) / 1000,
    };
  } catch (err) {
    return {
      skillName: '知识提取',
      status: 'error',
      data: { error: (err as Error).message },
      tokenUsed: 0,
      duration: (Date.now() - startTime) / 1000,
    };
  }
}

async function readFilesContent(files: string[], workspacePath: string): Promise<string> {
  const { readFileSync } = await import('node:fs');
  const parts: string[] = [];
  for (const f of files) {
    try {
      const fullPath = path.isAbsolute(f) ? f : path.join(workspacePath, f);
      const content = readFileSync(fullPath, 'utf-8');
      parts.push(`--- FILE: ${f} ---\n${content.slice(0, 30000)}\n`);
    } catch {
      parts.push(`--- FILE: ${f} --- (read error)\n`);
    }
  }
  return parts.join('\n');
}
