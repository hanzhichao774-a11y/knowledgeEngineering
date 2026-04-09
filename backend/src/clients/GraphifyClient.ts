import { execFile } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { promisify } from 'node:util';

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

export interface GraphifyClientLike {
  ask(input: { question: string; format?: 'direct' | 'evidence' | 'structured' | 'artifact'; topN?: number }): Promise<{
    ok: boolean;
    snapshotId: string | null;
    freshness: GraphifyFreshness;
    answer: unknown;
    evidence?: Record<string, unknown>;
  }>;
  searchRecords(input: { query: string; topN?: number }): Promise<{
    ok: boolean;
    snapshotId: string | null;
    records: Array<Record<string, unknown>>;
  }>;
  getHealth(): Promise<{
    ok: boolean;
    snapshotId: string | null;
    health: Record<string, unknown>;
    healthPath?: string;
  }>;
  getSnapshotStatus(): Promise<GraphifySnapshotStatus>;
  rebuild(input: { mode?: 'full' | 'incremental'; changedFiles?: string[]; reason?: string }): Promise<{
    ok: boolean;
    snapshotId: string | null;
    assetRoot: string;
    graphPath?: string;
    nodeCount: number;
    edgeCount: number;
    recordCount: number;
    updatedAt?: string;
  }>;
}

interface GraphifyBridgePayload {
  workspacePath: string;
  question?: string;
  query?: string;
  format?: 'direct' | 'evidence' | 'structured' | 'artifact';
  topN?: number;
  mode?: 'full' | 'incremental';
  changedFiles?: string[];
  reason?: string;
}

export function resolveGraphifyRuntimeConfig(options: { pythonBin?: string; repoPath?: string; workspacePath?: string } = {}) {
  const defaultRepoPath = resolve(import.meta.dirname, '../../../../graphify-v3');
  const defaultWorkspacePath = resolve(import.meta.dirname, '../../../graphify-workspace');
  const repoPath = options.repoPath ?? process.env.GRAPHIFY_REPO_PATH ?? defaultRepoPath;
  const workspacePath = options.workspacePath ?? process.env.GRAPHIFY_WORKSPACE_PATH ?? defaultWorkspacePath;
  const pythonBin = options.pythonBin
    ?? process.env.GRAPHIFY_PYTHON_BIN
    ?? readGraphifyPythonHint(workspacePath)
    ?? readGraphifyPythonHint(repoPath)
    ?? '/usr/bin/python3';
  return { pythonBin, repoPath, workspacePath };
}

function readGraphifyPythonHint(rootPath: string): string | undefined {
  const hintPath = resolve(rootPath, '.graphify_python');
  if (!existsSync(hintPath)) return undefined;
  const value = readFileSync(hintPath, 'utf-8').trim();
  return value || undefined;
}

export class GraphifyClient implements GraphifyClientLike {
  private readonly pythonBin: string;
  private readonly repoPath: string;
  private readonly workspacePath: string;
  private readonly bridgeScriptPath: string;

  constructor(options: { pythonBin?: string; repoPath?: string; workspacePath?: string } = {}) {
    const runtimeConfig = resolveGraphifyRuntimeConfig(options);
    this.pythonBin = runtimeConfig.pythonBin;
    this.repoPath = runtimeConfig.repoPath;
    this.workspacePath = runtimeConfig.workspacePath;
    this.bridgeScriptPath = resolve(import.meta.dirname, '../../scripts/graphify_bridge.py');
  }

  async ask(input: { question: string; format?: 'direct' | 'evidence' | 'structured' | 'artifact'; topN?: number }) {
    return this.runBridge<{
      ok: boolean;
      snapshotId: string | null;
      freshness: GraphifyFreshness;
      answer: unknown;
      evidence?: Record<string, unknown>;
    }>('ask', {
      question: input.question,
      format: input.format ?? 'structured',
      topN: input.topN ?? 5,
      workspacePath: this.workspacePath,
    });
  }

  async searchRecords(input: { query: string; topN?: number }) {
    return this.runBridge<{
      ok: boolean;
      snapshotId: string | null;
      records: Array<Record<string, unknown>>;
    }>('search-records', {
      query: input.query,
      topN: input.topN ?? 10,
      workspacePath: this.workspacePath,
    });
  }

  async getHealth() {
    return this.runBridge<{
      ok: boolean;
      snapshotId: string | null;
      health: Record<string, unknown>;
      healthPath?: string;
    }>('health', {
      workspacePath: this.workspacePath,
    });
  }

  async getSnapshotStatus() {
    return this.runBridge<GraphifySnapshotStatus>('snapshot', {
      workspacePath: this.workspacePath,
    });
  }

  async rebuild(input: { mode?: 'full' | 'incremental'; changedFiles?: string[]; reason?: string }) {
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
      workspacePath: this.workspacePath,
      mode: input.mode ?? 'full',
      changedFiles: input.changedFiles ?? [],
      reason: input.reason ?? 'manual_refresh',
    });
  }

  private async runBridge<T>(command: string, payload: GraphifyBridgePayload): Promise<T> {
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

    if (stderr?.trim()) {
      const trimmed = stderr.trim();
      if (trimmed) {
        console.warn(`[GraphifyClient] ${trimmed}`);
      }
    }

    return JSON.parse(stdout as string) as T;
  }
}
