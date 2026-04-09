import { existsSync, mkdirSync, copyFileSync } from 'node:fs';
import path from 'node:path';

const WORKSPACE_DIR = 'graphify-workspace';

export class WorkspaceManager {
  private readonly root: string;

  constructor(projectRoot?: string) {
    const defaultPath = path.join(path.resolve(process.cwd(), '..'), WORKSPACE_DIR);
    this.root = path.resolve(
      projectRoot ?? process.env.GRAPHIFY_WORKSPACE ?? defaultPath,
    );
    this.ensureDirs();
  }

  get workspacePath(): string {
    return this.root;
  }

  get rawDir(): string {
    return path.join(this.root, 'raw');
  }

  get outDir(): string {
    return path.join(this.root, 'graphify-out');
  }

  get graphJsonPath(): string {
    return path.join(this.outDir, 'graph.json');
  }

  get graphHtmlPath(): string {
    return path.join(this.outDir, 'graph.html');
  }

  get graphReportPath(): string {
    return path.join(this.outDir, 'GRAPH_REPORT.md');
  }

  get healthReportPath(): string {
    return path.join(this.outDir, 'health', 'HEALTH_REPORT.md');
  }

  get recordsPath(): string {
    return path.join(this.outDir, 'records', 'records.jsonl');
  }

  get manifestPath(): string {
    return path.join(this.root, '.graphify_manifest.json');
  }

  get costPath(): string {
    return path.join(this.outDir, 'cost.json');
  }

  hasExistingGraph(): boolean {
    return existsSync(this.graphJsonPath);
  }

  hasManifest(): boolean {
    return existsSync(this.manifestPath);
  }

  isIncremental(): boolean {
    return this.hasExistingGraph() && this.hasManifest();
  }

  copyToRaw(filePath: string): string {
    const filename = path.basename(filePath);
    const dest = path.join(this.rawDir, filename);
    copyFileSync(filePath, dest);
    return dest;
  }

  private ensureDirs(): void {
    const dirs = [
      this.root,
      this.rawDir,
      this.outDir,
      path.join(this.outDir, 'converted'),
      path.join(this.outDir, 'records'),
      path.join(this.outDir, 'reports'),
      path.join(this.outDir, 'health'),
      path.join(this.outDir, 'memory'),
      path.join(this.outDir, 'graph'),
    ];
    for (const dir of dirs) {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
    }
  }
}

let _instance: WorkspaceManager | null = null;

export function getWorkspaceManager(): WorkspaceManager {
  if (!_instance) {
    _instance = new WorkspaceManager();
  }
  return _instance;
}
