import { execFile } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { agentOsConfig } from '../config.js';

const execFileAsync = promisify(execFile);

export interface GraphifyFreshness {
  status: 'fresh' | 'stale' | 'missing';
  updatedAt?: string;
}

export interface GraphifySnapshotStatus {
  ok: boolean;
  exists: boolean;
  snapshotId: string | null;
  updatedAt?: string;
  assetRoot: string;
  graphPath?: string;
  nodeCount: number;
  edgeCount: number;
  recordCount: number;
  freshness: GraphifyFreshness;
}

interface GraphifyBridgePayload {
  workspacePath: string;
  mode?: 'full' | 'incremental';
  changedFiles?: string[];
  reason?: string;
}

export interface GraphifyRuntimeOptions {
  pythonBin?: string;
  repoPath?: string;
  workspacePath: string;
  buildCommand?: string;
}

interface SearchScored<T> {
  item: T;
  score: number;
}

export function resolveGraphifyRuntimeConfig(options: GraphifyRuntimeOptions) {
  const repoPath = options.repoPath ?? agentOsConfig.graphifyRepoPath;
  const workspacePath = options.workspacePath;
  const pythonBin = options.pythonBin
    ?? agentOsConfig.graphifyPythonBin
    ?? readGraphifyPythonHint(workspacePath)
    ?? (repoPath ? readGraphifyPythonHint(repoPath) : undefined)
    ?? '/usr/bin/python3';
  const buildCommand = options.buildCommand ?? agentOsConfig.graphifyBuildCommand;

  return { pythonBin, repoPath, workspacePath, buildCommand };
}

function readGraphifyPythonHint(rootPath: string) {
  const hintPath = resolve(rootPath, '.graphify_python');
  if (!existsSync(hintPath)) return undefined;
  const value = readFileSync(hintPath, 'utf-8').trim();
  return value || undefined;
}

function resolveGraphPath(workspacePath: string) {
  const candidates = [
    resolve(workspacePath, 'graphify-out/graph.json'),
    resolve(workspacePath, 'graphify-out/graph/graph.json'),
  ];

  return candidates.find((candidate) => existsSync(candidate));
}

function resolveRecordsPath(workspacePath: string) {
  const candidates = [
    resolve(workspacePath, 'graphify-out/records/records.jsonl'),
    resolve(workspacePath, 'graphify-out/records.jsonl'),
  ];

  return candidates.find((candidate) => existsSync(candidate));
}

function resolveHealthPath(workspacePath: string) {
  const candidates = [
    resolve(workspacePath, 'graphify-out/health/health.json'),
    resolve(workspacePath, 'graphify-out/health.json'),
  ];

  return candidates.find((candidate) => existsSync(candidate));
}

function buildFreshness(updatedAt?: string): GraphifyFreshness {
  if (!updatedAt) {
    return { status: 'missing' };
  }

  const updatedTime = new Date(updatedAt);
  if (Number.isNaN(updatedTime.getTime())) {
    return { status: 'missing' };
  }

  const ageMs = Date.now() - updatedTime.getTime();
  return {
    status: ageMs > 7 * 24 * 60 * 60 * 1000 ? 'stale' : 'fresh',
    updatedAt,
  };
}

function timestampToIso(mtimeMs?: number) {
  if (!mtimeMs) return undefined;
  return new Date(mtimeMs).toISOString();
}

function normalizeSearchText(value: string) {
  return value
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

function buildSearchUnits(value: string) {
  const normalized = normalizeSearchText(value);
  const units = new Set<string>();
  if (!normalized) return units;

  units.add(normalized);
  for (let size = 2; size <= 4; size += 1) {
    for (let index = 0; index <= normalized.length - size; index += 1) {
      units.add(normalized.slice(index, index + size));
      if (units.size >= 96) return units;
    }
  }

  return units;
}

function scoreCandidate(query: string, candidate: string) {
  const normalizedQuery = normalizeSearchText(query);
  const normalizedCandidate = normalizeSearchText(candidate);
  if (!normalizedQuery || !normalizedCandidate) return 0;

  let score = 0;
  if (normalizedCandidate.includes(normalizedQuery)) {
    score += normalizedQuery.length * 10;
  }

  for (const unit of buildSearchUnits(query)) {
    if (normalizedCandidate.includes(unit)) {
      score += unit.length;
    }
  }

  return score;
}

function toJsonText(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value ?? '');
  }
}

async function readJsonFile<T>(filePath: string) {
  return JSON.parse(await readFile(filePath, 'utf-8')) as T;
}

async function readRecords(workspacePath: string) {
  const recordsPath = resolveRecordsPath(workspacePath);
  if (!recordsPath) return [];
  const raw = await readFile(recordsPath, 'utf-8');
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

async function readGraph(workspacePath: string) {
  const graphPath = resolveGraphPath(workspacePath);
  if (!graphPath) {
    return {
      graphPath: undefined,
      nodes: [] as Array<Record<string, unknown>>,
      edges: [] as Array<Record<string, unknown>>,
    };
  }

  const graphData = await readJsonFile<Record<string, unknown>>(graphPath);
  return {
    graphPath,
    nodes: Array.isArray(graphData.nodes) ? graphData.nodes as Array<Record<string, unknown>> : [],
    edges: Array.isArray(graphData.links)
      ? graphData.links as Array<Record<string, unknown>>
      : Array.isArray(graphData.edges)
        ? graphData.edges as Array<Record<string, unknown>>
        : [],
  };
}

function rankItems<T>(items: T[], query: string, toSearchText: (item: T) => string, topN: number) {
  return items
    .map((item) => ({
      item,
      score: scoreCandidate(query, toSearchText(item)),
    }))
    .filter((entry): entry is SearchScored<T> => entry.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, topN)
    .map((entry) => entry.item);
}

function uniqueStrings(items: string[]) {
  return [...new Set(items.filter(Boolean))];
}

export class GraphifyClient {
  private readonly pythonBin: string;
  private readonly repoPath?: string;
  private readonly workspacePath: string;
  private readonly bridgeScriptPath: string;
  private readonly buildCommand?: string;

  constructor(options: GraphifyRuntimeOptions) {
    const runtimeConfig = resolveGraphifyRuntimeConfig(options);
    this.pythonBin = runtimeConfig.pythonBin;
    this.repoPath = runtimeConfig.repoPath;
    this.workspacePath = runtimeConfig.workspacePath;
    this.buildCommand = runtimeConfig.buildCommand;
    this.bridgeScriptPath = resolve(import.meta.dirname, '../../scripts/graphify_bridge.py');
  }

  isBuildAvailable() {
    return Boolean(this.buildCommand || this.repoPath);
  }

  async ask(input: { question: string; topN?: number }) {
    const snapshot = await this.getSnapshotStatus();
    const topN = input.topN ?? 5;
    const [records, nodes] = await Promise.all([
      this.searchRecords({ query: input.question, topN }),
      this.searchNodes({ query: input.question, topN }),
    ]);

    const sources = uniqueStrings([
      ...records.records.map((record) => String(record.source_file ?? '')),
      ...nodes.map((node) => String(node.source_file ?? '')),
    ]);

    return {
      ok: true,
      snapshotId: snapshot.snapshotId,
      freshness: snapshot.freshness,
      answer: {
        question: input.question,
        records: records.records,
        nodes,
        sources,
      },
    };
  }

  async searchRecords(input: { query: string; topN?: number }) {
    const snapshot = await this.getSnapshotStatus();
    const records = await readRecords(this.workspacePath);
    const ranked = rankItems(
      records,
      input.query,
      (record) => [
        String(record.label ?? ''),
        String(record.source_file ?? ''),
        String(record.source_location ?? ''),
        toJsonText(record.record_json),
      ].join('\n'),
      input.topN ?? 10,
    );

    return {
      ok: true,
      snapshotId: snapshot.snapshotId,
      records: ranked,
    };
  }

  async searchNodes(input: { query: string; topN?: number }) {
    const graph = await readGraph(this.workspacePath);
    return rankItems(
      graph.nodes,
      input.query,
      (node) => [
        String(node.id ?? ''),
        String(node.label ?? ''),
        String(node.source_file ?? ''),
        String(node.source_location ?? ''),
        toJsonText(node),
      ].join('\n'),
      input.topN ?? 8,
    );
  }

  async getHealth() {
    const healthPath = resolveHealthPath(this.workspacePath);
    const snapshot = await this.getSnapshotStatus();
    if (!healthPath) {
      return {
        ok: true,
        snapshotId: snapshot.snapshotId,
        health: {
          summary: {
            source_files: 0,
            normalized_files: 0,
            record_nodes: 0,
            memory_items: 0,
            graph_nodes: 0,
            graph_edges: 0,
            ambiguous_edges: 0,
            inferred_edges: 0,
            low_confidence_edges: 0,
            unrepresented_sources: 0,
          },
          warnings: [],
          checks: {},
        },
      };
    }

    return {
      ok: true,
      snapshotId: snapshot.snapshotId,
      health: await readJsonFile<Record<string, unknown>>(healthPath),
      healthPath,
    };
  }

  async getSnapshotStatus(): Promise<GraphifySnapshotStatus> {
    const graphPath = resolveGraphPath(this.workspacePath);
    const recordsPath = resolveRecordsPath(this.workspacePath);
    const assetRoot = resolve(this.workspacePath, 'graphify-out');

    if (!graphPath) {
      return {
        ok: true,
        exists: false,
        snapshotId: null,
        assetRoot,
        nodeCount: 0,
        edgeCount: 0,
        recordCount: 0,
        freshness: { status: 'missing' },
      };
    }

    const [graph, graphContent, recordContent, graphStat] = await Promise.all([
      readGraph(this.workspacePath),
      readFile(graphPath, 'utf-8'),
      recordsPath ? readFile(recordsPath, 'utf-8').catch(() => '') : Promise.resolve(''),
      stat(graphPath),
    ]);
    const graphStats = JSON.parse(graphContent) as Record<string, unknown>;
    const effectiveUpdatedAt = timestampToIso(graphStat.mtimeMs);
    const recordCount = recordContent
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .length;

    return {
      ok: true,
      exists: true,
      snapshotId: `${Math.floor(graphStat.mtimeMs)}-${graphStat.size}`,
      updatedAt: effectiveUpdatedAt,
      assetRoot,
      graphPath,
      nodeCount: Array.isArray(graphStats.nodes) ? graphStats.nodes.length : graph.nodes.length,
      edgeCount: Array.isArray(graphStats.links)
        ? graphStats.links.length
        : Array.isArray(graphStats.edges)
          ? graphStats.edges.length
          : graph.edges.length,
      recordCount,
      freshness: buildFreshness(effectiveUpdatedAt),
    };
  }

  async rebuild(input: { mode?: 'full' | 'incremental'; changedFiles?: string[]; reason?: string } = {}) {
    if (this.buildCommand) {
      await execFileAsync('/bin/zsh', ['-lc', this.buildCommand], {
        cwd: this.workspacePath,
        env: process.env,
        encoding: 'utf8',
        maxBuffer: 10 * 1024 * 1024,
      });

      const status = await this.getSnapshotStatus();
      return {
        ok: true,
        snapshotId: status.snapshotId,
        assetRoot: status.assetRoot,
        graphPath: status.graphPath,
        nodeCount: status.nodeCount,
        edgeCount: status.edgeCount,
        recordCount: status.recordCount,
        updatedAt: status.updatedAt,
      };
    }

    if (!this.repoPath) {
      throw new Error('GRAPHIFY_REPO_PATH or AGENTOS_GRAPHIFY_BUILD_COMMAND is required for build');
    }

    return this.runBridge<{
      ok: boolean;
      snapshotId: string | null;
      assetRoot: string;
      graphPath?: string;
      nodeCount: number;
      edgeCount: number;
      recordCount: number;
      updatedAt?: string;
    }>('rebuild', {
      mode: input.mode ?? 'full',
      changedFiles: input.changedFiles ?? [],
      reason: input.reason,
      workspacePath: this.workspacePath,
    });
  }

  private async runBridge<T>(command: string, payload: GraphifyBridgePayload): Promise<T> {
    if (!this.repoPath) {
      throw new Error('GRAPHIFY_REPO_PATH is required for bridge execution');
    }

    const { stdout, stderr } = await execFileAsync(
      this.pythonBin,
      [
        this.bridgeScriptPath,
        this.repoPath,
        command,
        JSON.stringify(payload),
      ],
      {
        cwd: this.workspacePath,
        env: process.env,
        encoding: 'utf8',
        maxBuffer: 10 * 1024 * 1024,
      },
    );

    const trimmed = stderr?.trim();
    if (trimmed) {
      console.warn(`[GraphifyClient] ${trimmed}`);
    }

    return JSON.parse(stdout as string) as T;
  }
}
