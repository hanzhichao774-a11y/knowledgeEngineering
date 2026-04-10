import { execFile } from 'node:child_process';
import { readFileSync, existsSync, copyFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

function getPython(): string {
  return process.env.GRAPHIFY_PYTHON ?? path.join(path.resolve(process.cwd(), '..'), '.venv/bin/python');
}

export interface DetectResult {
  total_files: number;
  total_words: number;
  needs_graph: boolean;
  warning: string | null;
  skipped_sensitive: string[];
  files: Record<string, string[]>;
}

export interface IncrementalResult extends DetectResult {
  new_total: number;
  new_files: Record<string, string[]>;
}

export interface ExtractionJSON {
  nodes: Record<string, unknown>[];
  edges: Record<string, unknown>[];
  hyperedges?: Record<string, unknown>[];
  input_tokens: number;
  output_tokens: number;
}

export interface CacheCheckResult {
  cached: ExtractionJSON;
  uncached: string[];
}

export interface ClusterResult {
  communities: Record<string, string[]>;
  cohesion: Record<string, number>;
}

export interface AnalysisResult {
  communities: Record<string, string[]>;
  cohesion: Record<string, number>;
  gods: Array<{ id: string; label: string; degree: number }>;
  surprises: Array<Record<string, unknown>>;
  questions: string[];
}

export interface MergeResult {
  totalNodes: number;
  totalEdges: number;
  newNodes: number;
  newEdges: number;
}

export interface GraphDiff {
  summary: string;
  newNodes: number;
  newEdges: number;
  removedNodes: number;
  removedEdges: number;
}

export interface PushResult {
  nodes: number;
  edges: number;
}

export interface NormalizeResult {
  normalizedFiles: string[];
  skipped: string[];
}

function runPython(script: string, cwd: string, timeoutMs = 300_000): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = execFile(
      getPython(),
      ['-c', script],
      {
        cwd,
        maxBuffer: 50 * 1024 * 1024,
        timeout: timeoutMs,
        env: { ...process.env, HF_ENDPOINT: process.env.HF_ENDPOINT ?? 'https://hf-mirror.com' },
      },
      (error, stdout, stderr) => {
        if (error) {
          const stderrText = stderr?.trim() || '';
          const msg = stderrText || error.message;
          console.error(`[GraphifyBridge] Python error (timeout=${timeoutMs}ms, cwd=${cwd}): ${msg.slice(0, 500)}`);
          reject(new Error(`GraphifyBridge Python error: ${msg}`));
          return;
        }
        if (stderr?.trim()) {
          console.warn(`[GraphifyBridge] Python stderr: ${stderr.trim().slice(0, 300)}`);
        }
        resolve(stdout.trim());
      },
    );
    proc.stdin?.end();
  });
}

export interface DocSnippet {
  file: string;
  snippet: string;
  score: number;
}

function tokenizeForSearch(text: string): string[] {
  const terms: string[] = [];
  const alphaNum = text.toLowerCase().match(/[a-z0-9_]+/g) ?? [];
  for (const t of alphaNum) {
    if (t.length > 1) terms.push(t);
  }
  const cjk = text.match(/[\u3400-\u9fff]+/g) ?? [];
  for (const chunk of cjk) {
    if (chunk.length <= 4) {
      terms.push(chunk);
    } else {
      terms.push(chunk);
      for (let i = 0; i < chunk.length - 1; i++) terms.push(chunk.slice(i, i + 2));
      for (let i = 0; i < chunk.length - 2; i++) terms.push(chunk.slice(i, i + 3));
    }
  }

  const mixed = text.match(/[\d]+[\u3400-\u9fff]+[\d]*[\u3400-\u9fff]*/g) ?? [];
  for (const m of mixed) {
    if (m.length >= 2) terms.push(m);
  }

  return [...new Set(terms)];
}

function collectMdFiles(dir: string, root: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    try {
      if (statSync(full).isDirectory()) {
        results.push(...collectMdFiles(full, root));
      } else if (entry.endsWith('.md')) {
        results.push(path.relative(root, full));
      }
    } catch { /* skip inaccessible entries */ }
  }
  return results;
}

function normalizeForMatch(text: string): string {
  return text
    .replace(/(?<=[\u3400-\u9fff])\s+(?=[\u3400-\u9fff])/g, '')
    .replace(/(?<=\d)\s+(?=[\u3400-\u9fff])/g, '')
    .replace(/(?<=[\u3400-\u9fff])\s+(?=\d)/g, '');
}

function scoreSnippet(snippet: string, terms: string[]): number {
  const normalized = normalizeForMatch(snippet).toLowerCase();
  let score = 0;
  for (const term of terms) {
    if (normalized.includes(term)) score += 1;
  }
  return score;
}

function parseJSON<T>(raw: string): T {
  const jsonMatch = raw.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error(`No JSON found in Python output: ${raw.slice(0, 200)}`);
  return JSON.parse(jsonMatch[0]) as T;
}

export class GraphifyBridge {
  async detect(workspacePath: string): Promise<DetectResult> {
    const script = `
import json
from graphify.detect import detect
from pathlib import Path
result = detect(Path('${workspacePath}'))
print(json.dumps(result))
`;
    const raw = await runPython(script, workspacePath);
    return parseJSON<DetectResult>(raw);
  }

  async detectIncremental(workspacePath: string): Promise<IncrementalResult> {
    const script = `
import json
from graphify.detect import detect_incremental
from pathlib import Path
result = detect_incremental(Path('.'))
print(json.dumps(result))
`;
    const raw = await runPython(script, workspacePath);
    return parseJSON<IncrementalResult>(raw);
  }

  async normalize(filePaths: string[], workspacePath: string): Promise<NormalizeResult> {
    const filesJson = JSON.stringify(filePaths);
    const script = `
import json, sys
from graphify.normalize import convert_pdf_file, convert_delimited_file, convert_structured_text_file
from graphify.detect import convert_office_file
from pathlib import Path

files = json.loads('${filesJson.replace(/'/g, "\\'")}')
out_dir = Path('graphify-out/converted')
out_dir.mkdir(parents=True, exist_ok=True)
normalized = []
skipped = []
for f in files:
    p = Path(f)
    ext = p.suffix.lower()
    try:
        if ext == '.pdf':
            md, _ = convert_pdf_file(p, out_dir)
            if md: normalized.append(str(md))
        elif ext in ('.csv', '.tsv'):
            md = convert_delimited_file(p, out_dir, delimiter=',' if ext == '.csv' else '\\t')
            if md: normalized.append(str(md))
        elif ext in ('.docx', '.xlsx'):
            md = convert_office_file(p, out_dir)
            if md: normalized.append(str(md))
        elif ext == '.txt':
            md = convert_structured_text_file(p, out_dir)
            if md: normalized.append(str(md))
        elif ext == '.md':
            normalized.append(str(p))
        else:
            skipped.append(str(p))
    except Exception as e:
        print(f'WARN: {p}: {e}', file=sys.stderr)
        skipped.append(str(p))
print(json.dumps({'normalizedFiles': normalized, 'skipped': skipped}))
`;
    const raw = await runPython(script, workspacePath, 1_200_000);
    return parseJSON<NormalizeResult>(raw);
  }

  async extractAST(codeFiles: string[], workspacePath: string): Promise<ExtractionJSON> {
    const filesJson = JSON.stringify(codeFiles);
    const script = `
import json
from graphify.extract import extract
from pathlib import Path
code_files = [Path(f) for f in json.loads('${filesJson.replace(/'/g, "\\'")}')]
if code_files:
    result = extract(code_files)
else:
    result = {'nodes':[],'edges':[],'input_tokens':0,'output_tokens':0}
print(json.dumps(result))
`;
    const raw = await runPython(script, workspacePath, 120_000);
    return parseJSON<ExtractionJSON>(raw);
  }

  async checkSemanticCache(
    allFiles: string[],
    workspacePath: string,
  ): Promise<CacheCheckResult> {
    const filesJson = JSON.stringify(allFiles);
    const script = `
import json
from graphify.cache import check_semantic_cache
files = json.loads('${filesJson.replace(/'/g, "\\'")}')
cached_nodes, cached_edges, cached_hyperedges, uncached = check_semantic_cache(files)
print(json.dumps({
  'cached': {
    'nodes': cached_nodes,
    'edges': cached_edges,
    'hyperedges': cached_hyperedges,
    'input_tokens': 0,
    'output_tokens': 0
  },
  'uncached': uncached
}))
`;
    const raw = await runPython(script, workspacePath);
    return parseJSON<CacheCheckResult>(raw);
  }

  async saveSemanticCache(
    extraction: ExtractionJSON,
    workspacePath: string,
  ): Promise<number> {
    const extractionPath = path.join(workspacePath, '.graphify_semantic_new.json');
    const { writeFileSync } = await import('node:fs');
    writeFileSync(extractionPath, JSON.stringify(extraction));
    const script = `
import json
from graphify.cache import save_semantic_cache
from pathlib import Path
data = json.loads(Path('.graphify_semantic_new.json').read_text())
saved = save_semantic_cache(data.get('nodes',[]), data.get('edges',[]), data.get('hyperedges',[]))
print(json.dumps({'saved': saved}))
`;
    const raw = await runPython(script, workspacePath);
    return parseJSON<{ saved: number }>(raw).saved;
  }

  async build(extractionJsonPath: string, workspacePath: string): Promise<string> {
    const script = `
import json
from graphify.build import build_from_json
from graphify.export import to_json
from pathlib import Path
extraction = json.loads(Path('${extractionJsonPath}').read_text())
G = build_from_json(extraction)
out = 'graphify-out/graph.json'
from graphify.cluster import cluster
communities = cluster(G)
to_json(G, communities, out)
print(json.dumps({'graphPath': out, 'nodes': G.number_of_nodes(), 'edges': G.number_of_edges()}))
`;
    const raw = await runPython(script, workspacePath, 120_000);
    const result = parseJSON<{ graphPath: string }>(raw);
    return path.join(workspacePath, result.graphPath);
  }

  async cluster(workspacePath: string): Promise<ClusterResult> {
    const script = `
import json
from graphify.build import build_from_json
from graphify.cluster import cluster, score_all
from networkx.readwrite import json_graph
from pathlib import Path
data = json.loads(Path('graphify-out/graph.json').read_text())
G = json_graph.node_link_graph(data, edges='links')
communities = cluster(G)
cohesion = score_all(G, communities)
print(json.dumps({
  'communities': {str(k): v for k, v in communities.items()},
  'cohesion': {str(k): round(v,4) for k, v in cohesion.items()}
}))
`;
    const raw = await runPython(script, workspacePath);
    return parseJSON<ClusterResult>(raw);
  }

  async analyze(workspacePath: string): Promise<AnalysisResult> {
    const script = `
import json
from graphify.analyze import god_nodes, surprising_connections, suggest_questions
from graphify.cluster import cluster, score_all
from networkx.readwrite import json_graph
from pathlib import Path
data = json.loads(Path('graphify-out/graph.json').read_text())
G = json_graph.node_link_graph(data, edges='links')
communities = cluster(G)
cohesion = score_all(G, communities)
gods = god_nodes(G)
surprises = surprising_connections(G, communities)
labels = {cid: 'Community ' + str(cid) for cid in communities}
questions = suggest_questions(G, communities, labels)
print(json.dumps({
  'communities': {str(k): v for k, v in communities.items()},
  'cohesion': {str(k): round(v,4) for k, v in cohesion.items()},
  'gods': gods,
  'surprises': surprises,
  'questions': questions
}))
`;
    const raw = await runPython(script, workspacePath, 120_000);
    return parseJSON<AnalysisResult>(raw);
  }

  async generateReport(
    workspacePath: string,
    labels: Record<string, string>,
    inputPath: string,
  ): Promise<string> {
    const labelsJson = JSON.stringify(labels);
    const script = `
import json
from graphify.build import build_from_json
from graphify.cluster import cluster, score_all
from graphify.analyze import god_nodes, surprising_connections, suggest_questions
from graphify.report import generate
from networkx.readwrite import json_graph
from pathlib import Path

data = json.loads(Path('graphify-out/graph.json').read_text())
G = json_graph.node_link_graph(data, edges='links')
communities = cluster(G)
cohesion = score_all(G, communities)

labels = json.loads('${labelsJson.replace(/'/g, "\\'")}')
labels = {int(k): v for k, v in labels.items()}

gods = god_nodes(G)
surprises = surprising_connections(G, communities)
questions = suggest_questions(G, communities, labels)

detection = json.loads(Path('.graphify_detect.json').read_text()) if Path('.graphify_detect.json').exists() else {'total_files':0,'total_words':0}
tokens = {'input':0, 'output':0}

report = generate(G, communities, cohesion, labels, gods, surprises, detection, tokens, '${inputPath}', suggested_questions=questions)
Path('graphify-out/GRAPH_REPORT.md').write_text(report)
print('OK')
`;
    await runPython(script, workspacePath, 60_000);
    return path.join(workspacePath, 'graphify-out/GRAPH_REPORT.md');
  }

  async exportHTML(workspacePath: string, labels?: Record<string, string>): Promise<string> {
    const labelsJson = labels ? JSON.stringify(labels) : '{}';
    const script = `
import json
from graphify.build import build_from_json
from graphify.cluster import cluster
from graphify.export import to_html, to_json
from networkx.readwrite import json_graph
from pathlib import Path

data = json.loads(Path('graphify-out/graph.json').read_text())
G = json_graph.node_link_graph(data, edges='links')
communities = cluster(G)
labels_raw = json.loads('${labelsJson.replace(/'/g, "\\'")}')
labels = {int(k): v for k, v in labels_raw.items()} if labels_raw else None

if G.number_of_nodes() <= 5000:
    to_html(G, communities, 'graphify-out/graph.html', community_labels=labels)
    print('OK')
else:
    print('SKIP: too many nodes for HTML')
`;
    await runPython(script, workspacePath, 60_000);
    return path.join(workspacePath, 'graphify-out/graph.html');
  }

  async pushToNeo4j(workspacePath: string): Promise<PushResult> {
    const uri = process.env.NEO4J_URI || 'bolt://localhost:7687';
    const user = process.env.NEO4J_USERNAME || 'neo4j';
    const password = process.env.NEO4J_PASSWORD || '';
    if (!password) return { nodes: 0, edges: 0 };

    const script = `
import json
from graphify.build import build_from_json
from graphify.cluster import cluster
from graphify.export import push_to_neo4j
from networkx.readwrite import json_graph
from pathlib import Path

data = json.loads(Path('graphify-out/graph.json').read_text())
G = json_graph.node_link_graph(data, edges='links')
communities = cluster(G)
result = push_to_neo4j(G, uri='${uri}', user='${user}', password='${password}', communities=communities)
print(json.dumps(result))
`;
    const raw = await runPython(script, workspacePath, 120_000);
    return parseJSON<PushResult>(raw);
  }

  async buildAssets(workspacePath: string): Promise<Record<string, unknown>> {
    const script = `
import json
from graphify.assets import build_knowledge_assets
from graphify.detect import save_manifest
from pathlib import Path

detect_path = Path('.graphify_detect.json')
detect = json.loads(detect_path.read_text()) if detect_path.exists() else None
if detect:
    save_manifest(detect.get('files', {}))

result = build_knowledge_assets(Path('.'), detection_result=detect)
print(json.dumps(result, default=str))
`;
    const raw = await runPython(script, workspacePath, 120_000);
    return parseJSON<Record<string, unknown>>(raw);
  }

  async backupGraph(workspacePath: string): Promise<void> {
    const src = path.join(workspacePath, 'graphify-out/graph.json');
    const dst = path.join(workspacePath, '.graphify_old.json');
    if (existsSync(src)) {
      copyFileSync(src, dst);
    }
  }

  async mergeIntoExistingGraph(
    newExtractionPath: string,
    workspacePath: string,
  ): Promise<MergeResult> {
    const script = `
import json
from graphify.build import build_from_json
from graphify.export import to_json
from graphify.cluster import cluster
from networkx.readwrite import json_graph
from pathlib import Path

existing_data = json.loads(Path('graphify-out/graph.json').read_text())
G_existing = json_graph.node_link_graph(existing_data, edges='links')
old_n, old_e = G_existing.number_of_nodes(), G_existing.number_of_edges()

new_extraction = json.loads(Path('${newExtractionPath}').read_text())
G_new = build_from_json(new_extraction)
G_existing.update(G_new)

communities = cluster(G_existing)
to_json(G_existing, communities, 'graphify-out/graph.json')

new_n, new_e = G_existing.number_of_nodes(), G_existing.number_of_edges()
print(json.dumps({
  'totalNodes': new_n, 'totalEdges': new_e,
  'newNodes': new_n - old_n, 'newEdges': new_e - old_e
}))
`;
    const raw = await runPython(script, workspacePath, 120_000);
    return parseJSON<MergeResult>(raw);
  }

  async graphDiff(workspacePath: string): Promise<GraphDiff> {
    const oldPath = path.join(workspacePath, '.graphify_old.json');
    if (!existsSync(oldPath)) {
      return { summary: 'No previous graph to diff', newNodes: 0, newEdges: 0, removedNodes: 0, removedEdges: 0 };
    }
    const script = `
import json
from graphify.analyze import graph_diff
from graphify.build import build_from_json
from networkx.readwrite import json_graph
from pathlib import Path

old_data = json.loads(Path('.graphify_old.json').read_text())
G_old = json_graph.node_link_graph(old_data, edges='links')
new_data = json.loads(Path('graphify-out/graph.json').read_text())
G_new = json_graph.node_link_graph(new_data, edges='links')
diff = graph_diff(G_old, G_new)
print(json.dumps({
  'summary': diff.get('summary',''),
  'newNodes': len(diff.get('new_nodes',[])),
  'newEdges': len(diff.get('new_edges',[])),
  'removedNodes': len(diff.get('removed_nodes',[])),
  'removedEdges': len(diff.get('removed_edges',[]))
}))
`;
    const raw = await runPython(script, workspacePath);
    return parseJSON<GraphDiff>(raw);
  }

  async saveManifest(workspacePath: string): Promise<void> {
    const script = `
from graphify.detect import save_manifest, detect
from pathlib import Path
import json
result = detect(Path('.'))
save_manifest(result.get('files', {}))
print('OK')
`;
    await runPython(script, workspacePath);
  }

  async ask(question: string, workspacePath: string, topN = 5): Promise<string> {
    const escaped = question.replace(/'/g, "\\'").replace(/\n/g, '\\n');
    const script = `
from graphify.agent import answer
from pathlib import Path
result = answer('${escaped}', Path('.'), output_format='structured', top_n=${topN})
print(result)
`;
    return runPython(script, workspacePath, 60_000);
  }

  async searchRecords(
    question: string,
    workspacePath: string,
    topN = 10,
  ): Promise<Record<string, unknown>[]> {
    const escaped = question.replace(/'/g, "\\'").replace(/\n/g, '\\n');
    const script = `
import json
from graphify.agent import search_records
from pathlib import Path
results = search_records('${escaped}', Path('.'), top_n=${topN})
print(json.dumps(results))
`;
    const raw = await runPython(script, workspacePath, 60_000);
    return parseJSON<Record<string, unknown>[]>(raw);
  }

  searchConvertedDocs(
    question: string,
    workspacePath: string,
    topN = 5,
  ): DocSnippet[] {
    const convertedDir = path.join(workspacePath, 'graphify-out', 'converted');
    if (!existsSync(convertedDir)) return [];

    const terms = tokenizeForSearch(question);
    if (terms.length === 0) return [];

    const WINDOW_LINES = 15;
    const STEP_LINES = 8;
    const scored: DocSnippet[] = [];

    let mdFiles: string[];
    try {
      mdFiles = collectMdFiles(convertedDir, convertedDir);
    } catch {
      return [];
    }

    for (const relPath of mdFiles) {
      try {
        const content = readFileSync(path.join(convertedDir, relPath), 'utf-8');
        const lines = content.split('\n');

        for (let i = 0; i < lines.length; i += STEP_LINES) {
          const windowLines = lines.slice(i, i + WINDOW_LINES);
          const snippet = windowLines.join('\n').trim();
          if (!snippet || snippet.length < 10) continue;

          const score = scoreSnippet(snippet, terms);
          if (score > 0) {
            const cleanSnippet = normalizeForMatch(snippet).slice(0, 1500);
            scored.push({ file: relPath, snippet: cleanSnippet, score });
          }
        }
      } catch {
        continue;
      }
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topN);
  }

  async saveQueryResult(
    question: string,
    answer: string,
    sourceNodes: string[],
    workspacePath: string,
  ): Promise<void> {
    const qEsc = question.replace(/'/g, "\\'").replace(/\n/g, '\\n');
    const aEsc = answer.replace(/'/g, "\\'").replace(/\n/g, '\\n');
    const nodesJson = JSON.stringify(sourceNodes);
    const script = `
from graphify.ingest import save_query_result
from pathlib import Path
import json
save_query_result(
  question='${qEsc}',
  answer='${aEsc}',
  memory_dir=Path('graphify-out/memory'),
  query_type='query',
  source_nodes=json.loads('${nodesJson}'),
)
print('OK')
`;
    await runPython(script, workspacePath);
  }

  async healthCheck(workspacePath: string): Promise<Record<string, unknown>> {
    const script = `
import json
from pathlib import Path
health_path = Path('graphify-out/health/health.json')
if health_path.exists():
    print(health_path.read_text())
else:
    print(json.dumps({'status': 'no_health_report'}))
`;
    const raw = await runPython(script, workspacePath);
    return parseJSON<Record<string, unknown>>(raw);
  }
}

let _bridge: GraphifyBridge | null = null;

export function getGraphifyBridge(): GraphifyBridge {
  if (!_bridge) {
    _bridge = new GraphifyBridge();
  }
  return _bridge;
}
