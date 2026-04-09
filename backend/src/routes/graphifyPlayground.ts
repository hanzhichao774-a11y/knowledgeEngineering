import { randomUUID } from 'node:crypto';
import { readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { basename, extname, resolve } from 'node:path';
import type { FastifyPluginAsync } from 'fastify';
import type { GatewayClientLike } from '../clients/GatewayClient.js';
import type { GraphifyClientLike } from '../clients/GraphifyClient.js';
import { resolveGraphifyRuntimeConfig } from '../clients/GraphifyClient.js';

interface GraphifyPlaygroundRouteOptions {
  gatewayClient: GatewayClientLike;
  graphifyClient: GraphifyClientLike;
}

const GRAPHIFY_OUTPUT_DIR = 'graphify-out';
const WORKSPACE_PROTECTED_NAMES = new Set([
  '.graphify_python',
]);

export const graphifyPlaygroundRoutes: FastifyPluginAsync<GraphifyPlaygroundRouteOptions> = async (app, options) => {
  const runtimeConfig = resolveGraphifyRuntimeConfig();
  const workspacePath = runtimeConfig.workspacePath;
  const graphifySkillCommand = `/graphify ${workspacePath}`;

  app.get('/graphify-playground/status', async (_req, reply) => {
    const [snapshot, health, files] = await Promise.all([
      options.graphifyClient.getSnapshotStatus(),
      options.graphifyClient.getHealth().catch(() => ({
        ok: false,
        snapshotId: null,
        health: { warnings: ['health_unavailable'] },
      })),
      listWorkspaceFiles(workspacePath),
    ]);
    const requiresManualGraphify = shouldRunGraphifySkill(files, snapshot.updatedAt);

    return reply.send({
      ok: true,
      workspacePath,
      importDir: workspacePath,
      graphifySkillCommand,
      requiresManualGraphify,
      snapshot,
      health,
      files,
    });
  });

  app.post<{
    Querystring: {
      replaceExisting?: string;
    };
  }>('/graphify-playground/upload', async (req, reply) => {
    const replaceExisting = req.query.replaceExisting !== 'false';
    if (replaceExisting) {
      await clearWorkspaceUploads(workspacePath);
    }

    const uploadedFiles: Array<{
      id: string;
      filename: string;
      storedPath: string;
      size: number;
      mimetype: string;
      uploadedAt: string;
    }> = [];

    const parts = req.files();
    for await (const part of parts) {
      if (part.type !== 'file') continue;
      const fileId = randomUUID();
      const safeName = sanitizeFilename(part.filename || `${fileId}.bin`);
      const extension = extname(safeName);
      const baseName = basename(safeName, extension) || 'upload';
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const targetPath = resolve(workspacePath, `${timestamp}-${fileId}-${baseName}${extension}`);
      const buffer = await part.toBuffer();
      await writeFile(targetPath, buffer);
      uploadedFiles.push({
        id: fileId,
        filename: safeName,
        storedPath: targetPath,
        size: buffer.length,
        mimetype: part.mimetype,
        uploadedAt: new Date().toISOString(),
      });
    }

    if (uploadedFiles.length === 0) {
      return reply.code(400).send({
        ok: false,
        error: 'No files uploaded',
      });
    }

    return reply.send({
      ok: true,
      workspacePath,
      importDir: workspacePath,
      replaceExisting,
      uploadedFiles,
      graphifySkillCommand,
      graphifyRunRequired: true,
      requiresManualGraphify: true,
      message: 'Upload completed. Run the Codex graphify skill to refresh graphify-out.',
    });
  });

  app.post('/graphify-playground/run', async (_req, reply) => {
    return reply.code(409).send({
      ok: false,
      error: 'Playground run endpoint is deprecated. Run the Codex graphify skill instead.',
      workspacePath,
      importDir: workspacePath,
      graphifySkillCommand,
    });
  });

  app.post<{
    Body: {
      question: string;
      outputMode?: 'text' | 'structured' | 'artifact-draft';
      graphifyFormat?: 'direct' | 'evidence' | 'structured' | 'artifact';
      topN?: number;
      recordTopN?: number;
    };
  }>('/graphify-playground/query', async (req, reply) => {
    const question = String(req.body.question ?? '').trim();
    if (!question) {
      return reply.code(400).send({
        ok: false,
        error: 'Question is required',
      });
    }

    const snapshot = await options.graphifyClient.getSnapshotStatus();
    const assetResults = await searchPlaygroundAssets(workspacePath, question, req.body.topN ?? 5);
    if (!snapshot.exists && assetResults.length === 0) {
      return reply.code(503).send({
        ok: false,
        error: 'Graphify knowledge base is not ready and no parsed playground assets were found',
        snapshot,
      });
    }

    const [graphifyAsk, graphifyRecords] = snapshot.exists
      ? await Promise.all([
        options.graphifyClient.ask({
          question,
          format: req.body.graphifyFormat ?? 'structured',
          topN: req.body.topN ?? 5,
        }).catch((error) => ({
          ok: false,
          snapshotId: snapshot.snapshotId,
          freshness: snapshot.freshness,
          answer: null,
          error: error instanceof Error ? error.message : 'graphify ask failed',
        })),
        options.graphifyClient.searchRecords({
          query: question,
          topN: req.body.recordTopN ?? 10,
        }).catch((error) => ({
          ok: false,
          snapshotId: snapshot.snapshotId,
          records: [],
          error: error instanceof Error ? error.message : 'graphify search failed',
        })),
      ])
      : [
        {
          ok: false,
          snapshotId: snapshot.snapshotId,
          freshness: snapshot.freshness,
          answer: null,
          error: 'graphify snapshot missing',
        },
        {
          ok: false,
          snapshotId: snapshot.snapshotId,
          records: [],
          error: 'graphify snapshot missing',
        },
      ];

    const graphifyAnswer = normalizeStructuredGraphifyAnswer(graphifyAsk.answer);
    const graphifySources = graphifyAnswer.sources.length > 0
      ? graphifyAnswer.sources
      : assetResults.map((item) => item.source_file);
    const recordResults = graphifyRecords.records.length > 0
      ? graphifyRecords.records
      : assetResults;
    const retrievalContext = {
      source: assetResults.length > 0 ? 'graphify-assets' : 'graphify',
      graphifyAnswer,
      graphifySources,
      recordResults,
      assetResults,
      snapshotId: graphifyAsk.snapshotId ?? snapshot.snapshotId,
      freshness: graphifyAsk.freshness ?? snapshot.freshness,
    };

    const gateway = await options.gatewayClient.generateAnswer({
      taskId: `graphify-playground-${Date.now()}`,
      workspaceId: 'default',
      question,
      retrievalContext,
      context: {
        source: 'graphify-playground',
      },
    });

    return reply.send({
      ok: true,
      question,
      workspacePath,
      snapshot,
      graphify: {
        ask: graphifyAsk,
        recordResults,
        normalizedAnswer: graphifyAnswer,
        assetResults,
      },
      gateway,
    });
  });
};

async function listWorkspaceFiles(workspacePath: string) {
  try {
    const names = await readdir(workspacePath);
    const files = await Promise.all(
      names
        .filter((name) => shouldTreatAsWorkspaceInput(name))
        .map(async (name) => {
          const filePath = resolve(workspacePath, name);
          const fileStat = await stat(filePath);
          if (!fileStat.isFile()) return null;
          return {
            name,
            path: filePath,
            size: fileStat.size,
            updatedAt: fileStat.mtime.toISOString(),
          };
        }),
    );
    return files
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch {
    return [];
  }
}

function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._\-\u4e00-\u9fa5]/g, '_');
}

function shouldTreatAsWorkspaceInput(name: string): boolean {
  if (name.startsWith('.')) return false;
  if (name === GRAPHIFY_OUTPUT_DIR) return false;
  return true;
}

async function clearWorkspaceUploads(workspacePath: string): Promise<void> {
  const names = await readdir(workspacePath).catch(() => []);
  await Promise.all(
    names
      .filter((name) => !WORKSPACE_PROTECTED_NAMES.has(name))
      .map((name) => rm(resolve(workspacePath, name), { recursive: true, force: true })),
  );
}

function shouldRunGraphifySkill(
  files: Array<{ updatedAt: string }>,
  snapshotUpdatedAt?: string,
): boolean {
  if (files.length === 0) return false;
  if (!snapshotUpdatedAt) return true;
  const snapshotTime = Date.parse(snapshotUpdatedAt);
  if (Number.isNaN(snapshotTime)) return true;
  return files.some((file) => Date.parse(file.updatedAt) > snapshotTime);
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

async function searchPlaygroundAssets(workspacePath: string, question: string, topN: number) {
  const sourceIndexPath = resolve(workspacePath, `${GRAPHIFY_OUTPUT_DIR}/raw/source_index.json`);
  const payload = await readJsonFile<Array<Record<string, unknown>>>(sourceIndexPath);
  if (!payload) return [];

  const terms = tokenize(question);
  const matches: Array<{
    source_file: string;
    normalized_path?: string;
    snippet: string;
    content: string;
    score: number;
    location: string;
  }> = [];

  for (const entry of payload) {
    const sourcePath = String(entry.source_path ?? '');
    if (!sourcePath.startsWith(workspacePath)) continue;
    if (sourcePath.includes(`/${GRAPHIFY_OUTPUT_DIR}/`)) continue;

    const normalizedPath = typeof entry.normalized_path === 'string' ? entry.normalized_path : undefined;
    const readablePath = normalizedPath ?? sourcePath;
    const content = await readTextFile(readablePath);
    if (!content) continue;

    const score = scoreText(content, terms) + scoreText(sourcePath, terms) * 0.4;
    if (score <= 0) continue;

    matches.push({
      source_file: sourcePath,
      ...(normalizedPath ? { normalized_path: normalizedPath } : {}),
      snippet: buildSnippet(content, terms),
      content: content.slice(0, 2400),
      score,
      location: normalizedPath ? 'normalized asset' : 'source file',
    });
  }

  return matches
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);
}

async function readJsonFile<T>(path: string): Promise<T | null> {
  try {
    const raw = await readFile(path, 'utf-8');
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function readTextFile(path: string): Promise<string> {
  try {
    return await readFile(path, 'utf-8');
  } catch {
    return '';
  }
}

function tokenize(question: string): string[] {
  const directTerms = question
    .split(/[，。？！、；：""''（）\s,.\?!;:()[\]{}<>·\-—_\/\\|@#$%^&*+=~`]+/)
    .map((term) => term.trim().toLowerCase())
    .filter((term) => term.length >= 2);

  const expanded = new Set<string>();
  for (const term of directTerms) {
    expanded.add(term);
    if (/[\u4e00-\u9fa5]/.test(term) && term.length > 4) {
      for (let size = 2; size <= Math.min(4, term.length); size += 1) {
        for (let index = 0; index <= term.length - size; index += 1) {
          expanded.add(term.slice(index, index + size));
        }
      }
    }
  }

  return Array.from(expanded);
}

function scoreText(content: string, terms: string[]): number {
  const lower = content.toLowerCase();
  return terms.reduce((score, term) => score + (lower.includes(term) ? 1 : 0), 0);
}

function buildSnippet(content: string, terms: string[]): string {
  const lower = content.toLowerCase();
  for (const term of terms) {
    const index = lower.indexOf(term);
    if (index >= 0) {
      const start = Math.max(0, index - 80);
      const end = Math.min(content.length, index + 220);
      return content.slice(start, end).trim();
    }
  }
  return content.slice(0, 240).trim();
}
