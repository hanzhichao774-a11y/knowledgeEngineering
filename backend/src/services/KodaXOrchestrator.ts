import { runKodaX } from 'kodax';
import type { KodaXOptions, KodaXResult, KodaXEvents } from 'kodax';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import type { AgentMessage, SkillResult } from '../agents/types.js';

const SKILL_PATH = path.resolve(process.cwd(), '..', '.kodax', 'skills', 'graphify', 'SKILL.md');

const EXPORT_SKILL_PATHS: Record<string, string> = {
  docx: path.resolve(process.cwd(), '..', '.kodax', 'skills', 'docx', 'SKILL.md'),
  xlsx: path.resolve(process.cwd(), '..', '.kodax', 'skills', 'xlsx', 'SKILL.md'),
  pdf: path.resolve(process.cwd(), '..', '.kodax', 'skills', 'pdf', 'SKILL.md'),
};

export interface ExportReportData {
  title: string;
  period: string;
  summary: string[];
  metrics: Array<{ label: string; value: string; unit?: string; trend?: 'up' | 'down' | 'stable' }>;
  source: string;
}

interface ProgressCallbacks {
  onProgress: (msg: AgentMessage) => void;
  onStepComplete: (stepIndex: number, result: SkillResult) => void;
}

interface StepDetection {
  currentStep: number;
  stepNames: string[];
}

const INGEST_STEP_PATTERNS: Array<{ pattern: RegExp; stepIndex: number; name: string }> = [
  { pattern: /Step 1|Ensure graphify|graphify.*install|import graphify/i, stepIndex: 0, name: '文档规范化' },
  { pattern: /Step 2|Detect files|\.graphify_detect/i, stepIndex: 0, name: '文档规范化' },
  { pattern: /Step 3|Extract|AST|semantic|\.graphify_extract/i, stepIndex: 1, name: '知识提取' },
  { pattern: /Step 4|Build graph|cluster|build_from_json|\.graphify_analysis/i, stepIndex: 2, name: '图谱构建' },
  { pattern: /Step 5|Label communities|LABELS_DICT/i, stepIndex: 2, name: '图谱构建' },
  { pattern: /Step 6|HTML|Obsidian|to_html/i, stepIndex: 3, name: '知识导出' },
  { pattern: /Step 7|Neo4j|cypher|push_to_neo4j|SVG|GraphML/i, stepIndex: 3, name: '知识导出' },
  { pattern: /Step 8|benchmark/i, stepIndex: 4, name: '资产构建' },
  { pattern: /Step 9|manifest|build_knowledge_assets|cost\.json/i, stepIndex: 4, name: '资产构建' },
];

const QUERY_STEP_PATTERNS: Array<{ pattern: RegExp; stepIndex: number; name: string }> = [
  { pattern: /graph\.json|traversal|BFS|DFS|start_nodes|subgraph/i, stepIndex: 0, name: '知识检索' },
  { pattern: /answer|回答|结论|总结/i, stepIndex: 1, name: '答案生成' },
];

function detectStep(text: string, mode: 'ingest' | 'query'): { stepIndex: number; name: string } | null {
  const patterns = mode === 'ingest' ? INGEST_STEP_PATTERNS : QUERY_STEP_PATTERNS;
  for (const { pattern, stepIndex, name } of patterns) {
    if (pattern.test(text)) {
      return { stepIndex, name };
    }
  }
  return null;
}

const BASH_FRIENDLY_RULES: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /npm install/i, label: '安装 Node.js 依赖包' },
  { pattern: /pip3? install/i, label: '安装 Python 依赖包' },
  { pattern: /generate_report|report\.\w{2,4}/i, label: '生成报告文件' },
  { pattern: /graphify\.detect|\.graphify_detect/i, label: '检测文档类型与编码' },
  { pattern: /semantic_extract_helper/i, label: '语义知识提取（并行）' },
  { pattern: /ast_extract|graphify\.extract/i, label: '提取文档结构信息' },
  { pattern: /build_from_json|graphify\.build/i, label: '构建知识图谱' },
  { pattern: /community|LABELS_DICT/i, label: '社区发现与标注' },
  { pattern: /to_html|export/i, label: '导出知识资产' },
  { pattern: /neo4j|push_to_neo4j|cypher/i, label: '同步至图数据库' },
  { pattern: /save_query_result/i, label: '保存查询记录' },
  { pattern: /graph\.json/i, label: '加载知识图谱数据' },
  { pattern: /converted\/.*\.md|cat\s+.*\.md/i, label: '读取文档内容' },
  { pattern: /python3?\s+\S+\.py/i, label: '执行处理脚本' },
  { pattern: /node\s+\S+\.m?js/i, label: '执行处理脚本' },
];

const BASH_SUPPRESS_PATTERNS = [
  /^cd\s+/,
  /^echo\s+.*>\s*/,
  /GRAPHIFY_PYTHON=/,
  /\.graphify_python/,
  /^mkdir\s/,
  /^ls\s/,
  /^cat\s+\.\w/,
  /^pwd$/,
  /^which\s/,
  /^rm\s/,
  /^cp\s/,
  /^mv\s/,
];

function humanizeTool(toolName: string, input?: Record<string, unknown>): string | null {
  if (toolName === 'bash') {
    const cmd = String(input?.command ?? '');
    const corePart = cmd.replace(/^cd\s+[^\s;&&]+\s*[;&|]+\s*/g, '').trim();

    for (const { pattern, label } of BASH_FRIENDLY_RULES) {
      if (pattern.test(cmd)) return label;
    }

    for (const suppress of BASH_SUPPRESS_PATTERNS) {
      if (suppress.test(corePart)) return null;
    }

    return '执行系统操作';
  }

  if (toolName === 'read' || toolName === 'Read') return '读取文件';
  if (toolName === 'write' || toolName === 'Write') return '写入文件';
  if (toolName === 'edit' || toolName === 'str_replace' || toolName === 'Edit') return '编辑文件';
  if (toolName === 'glob' || toolName === 'Glob') return '搜索文件';

  return `执行 ${toolName}`;
}

function loadSkillContent(): string {
  if (existsSync(SKILL_PATH)) {
    return readFileSync(SKILL_PATH, 'utf-8');
  }
  return '';
}

function buildSkillSummary(): string {
  return `Available skill: /graphify - Turn any folder of files into a persistent knowledge base with knowledge graph, record store, health checks, and service-agent assets. Supports full pipeline, incremental updates, and query mode.`;
}

function buildIngestPrompt(workspacePath: string, filePaths: string[]): string {
  const fileList = filePaths.map((p) => `- ${path.basename(p)}`).join('\n');
  const skillContent = loadSkillContent();

  return `You are executing a knowledge engineering pipeline. Follow the graphify SKILL.md instructions precisely.

## Context
- Working directory: ${workspacePath}
- Files have been placed in the raw/ subdirectory
- Files to process:
${fileList}

## SKILL.md Instructions
${skillContent}

## Task
Execute /graphify ${workspacePath} to build a knowledge graph from the files above.

Important:
- The Python interpreter path is available in GRAPHIFY_PYTHON env var: ${process.env.GRAPHIFY_PYTHON ?? 'python3'}
- For Step 3B semantic extraction, use: $(cat .graphify_python) semantic_extract_helper.py
- Skip --obsidian, --svg, --graphml, --mcp, --watch flags
- Do include --neo4j-push if NEO4J_URI env is set
- Work through all steps sequentially, do not skip any
- Print progress as you go`;
}

function buildQueryPrompt(question: string, workspacePath: string): string {
  const skillContent = loadSkillContent();

  const hasGraph = existsSync(path.join(workspacePath, 'graphify-out', 'graph.json'));
  if (!hasGraph) {
    return `The user asked: "${question}"

No knowledge graph exists yet at ${workspacePath}/graphify-out/graph.json.
Please respond that the knowledge base has not been built yet and the user should upload documents first.`;
  }

  return `You are a knowledge retrieval agent. Use the graphify query workflow to answer a user question from the knowledge graph.

## Context
- Working directory: ${workspacePath}
- Graph exists at: graphify-out/graph.json (already built from ingested documents)
- Converted markdown files are in: graphify-out/converted/ (original document content)

## SKILL.md Query Instructions (relevant section)
${extractQuerySection(skillContent)}

## User Question
${question}

## Task
Execute /graphify query "${question}" following the SKILL.md instructions:

1. Load graphify-out/graph.json using Python + NetworkX
2. Find the 1-3 nodes whose labels best match key terms in the question
3. Run BFS traversal (depth 3) from each starting node
4. Read the subgraph - node labels, edge relations, confidence tags, source locations
5. **IMPORTANT**: Also read the relevant graphify-out/converted/*.md files to get direct evidence from the original documents. Use the read tool or bash cat to examine files that match the query terms.
6. Combine graph structure evidence with document content to form a complete answer
7. Answer using ONLY what the graph and documents contain - do not hallucinate
8. Save the query result to graphify-out/memory/ using save_query_result

Structure your final answer in Markdown. Start the answer section with "## 回答" so it can be extracted.

The Python interpreter is: ${process.env.GRAPHIFY_PYTHON ?? 'python3'}`;
}

function extractQuerySection(skillContent: string): string {
  const queryStart = skillContent.indexOf('## For /graphify query');
  if (queryStart === -1) return '';
  const nextSection = skillContent.indexOf('\n## For /graphify path', queryStart + 1);
  if (nextSection === -1) return skillContent.slice(queryStart);
  return skillContent.slice(queryStart, nextSection);
}

function extractAnswer(text: string): string {
  const answerMarker = text.indexOf('## 回答');
  if (answerMarker !== -1) {
    return text.slice(answerMarker).trim();
  }

  const lines = text.split('\n');
  const lastSubstantialLines: string[] = [];
  for (let i = lines.length - 1; i >= 0 && lastSubstantialLines.length < 50; i--) {
    const line = lines[i].trim();
    if (line && !line.startsWith('```') && !line.startsWith('$') && !line.startsWith('python')) {
      lastSubstantialLines.unshift(lines[i]);
    }
  }
  return lastSubstantialLines.join('\n').trim() || text.slice(-2000);
}

function loadExportSkill(format: string): string {
  const skillPath = EXPORT_SKILL_PATHS[format];
  if (skillPath && existsSync(skillPath)) {
    return readFileSync(skillPath, 'utf-8');
  }
  return '';
}

function buildExportPrompt(format: string, reportData: ExportReportData, outputPath: string): string {
  const skillContent = loadExportSkill(format);
  const reportJson = JSON.stringify(reportData, null, 2);

  const metricsTable = reportData.metrics
    .map((m) => `| ${m.label} | ${m.value} | ${m.unit ?? ''} | ${m.trend === 'up' ? '↑' : m.trend === 'down' ? '↓' : '→'} |`)
    .join('\n');

  if (format === 'docx') {
    return `You are a document generation agent. Create a Word document (.docx).

## SKILL.md Reference
${skillContent}

## Report Data
\`\`\`json
${reportJson}
\`\`\`

## Task
1. Run: npm install docx (in CWD)
2. Write a Node.js script (generate_report.mjs) using the docx-js library
3. Run the script and save output to: ${outputPath}

Document structure:
- Heading1: "${reportData.title}"
- Subtitle paragraph: "报告周期：${reportData.period}"
- A table with header row (指标 | 数值 | 单位 | 趋势) and data rows for all metrics
- Heading2: "核心发现"
- Numbered list with each summary item
- A final paragraph: "数据来源：${reportData.source}"
- Use A4 page size, Arial font, professional styling

Run the script and confirm the file exists at ${outputPath}.`;
  }

  if (format === 'xlsx') {
    return `You are a document generation agent. Create an Excel spreadsheet (.xlsx).

## SKILL.md Reference
${skillContent}

## Report Data
\`\`\`json
${reportJson}
\`\`\`

## Task
1. Ensure openpyxl is installed: pip3 install openpyxl
2. Write a Python script (generate_report.py)
3. Run it and save output to: ${outputPath}

Spreadsheet structure:
- Sheet "概览":
  - Row 1: Title "${reportData.title}" in A1 (bold, size 16, merge A1:D1)
  - Row 2: "报告周期：${reportData.period}"
  - Row 4 header row: 指标 | 数值 | 单位 | 趋势 (bold, blue fill #2E75B6, white font)
  - Rows 5+: metric data from the JSON
  - After metrics: blank row, then "数据来源：${reportData.source}"
  - Set column widths: A=20, B=15, C=10, D=10
  - Add thin borders to the table
- Sheet "核心发现":
  - Row 1: "核心发现" (bold, size 14)
  - Rows 2+: numbered findings from summary array
  - Set column A width to 80

Run the script and confirm the file exists at ${outputPath}.`;
  }

  return `You are a document generation agent. Create a PDF document.

## SKILL.md Reference
${skillContent}

## Report Data
\`\`\`json
${reportJson}
\`\`\`

## Task
1. Ensure reportlab is installed: pip3 install reportlab
2. Write a Python script (generate_report.py)
3. Run it and save output to: ${outputPath}

PDF structure (use reportlab.platypus for layout):
- Title: "${reportData.title}" centered, large font
- Subtitle: "报告周期：${reportData.period}"
- A table with header (指标 | 数值 | 单位 | 趋势) and data rows
  - Use TableStyle with header background color, grid lines
- Section heading: "核心发现"
- Numbered list of findings
- Footer: "数据来源：${reportData.source}"

CRITICAL for Chinese text:
- Register a CJK font. On macOS try:
  from reportlab.pdfbase import pdfmetrics
  from reportlab.pdfbase.ttfonts import TTFont
  # Try common macOS CJK fonts
  for font_path in ['/System/Library/Fonts/STHeiti Medium.ttc',
                     '/System/Library/Fonts/PingFang.ttc',
                     '/System/Library/Fonts/Supplemental/Songti.ttc']:
      if os.path.exists(font_path):
          pdfmetrics.registerFont(TTFont('CJK', font_path, subfontIndex=0))
          break
- Use the registered 'CJK' font for all text elements
- If no system font found, try: from reportlab.pdfbase.cidfonts import UnicodeCIDFont; pdfmetrics.registerFont(UnicodeCIDFont('STSong-Light'))

Run the script and confirm the file exists at ${outputPath}.`;
}

export class KodaXOrchestrator {
  private buildKodaXEvents(
    mode: 'ingest' | 'query',
    callbacks: ProgressCallbacks,
    tracking: { startTime: number; lastStepIndex: number; totalTokens: number },
  ): KodaXEvents {
    let accumulatedText = '';
    let lastSentContent = '';
    let pendingFriendly: string | null = null;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const sendProgress = (content: string, metadata?: Record<string, unknown>) => {
      if (content === lastSentContent) return;
      lastSentContent = content;
      callbacks.onProgress({
        agentId: 'kodax-orchestrator',
        role: 'worker',
        content,
        timestamp: new Date().toISOString(),
        metadata,
      });
    };

    const flushPending = () => {
      if (pendingFriendly) {
        sendProgress(`正在${pendingFriendly}...`);
        pendingFriendly = null;
      }
    };

    return {
      onTextDelta: (text: string) => {
        accumulatedText += text;

        if (accumulatedText.includes('\n')) {
          const lines = accumulatedText.split('\n');
          accumulatedText = lines.pop() ?? '';

          for (const line of lines) {
            if (!line.trim()) continue;

            const step = detectStep(line, mode);
            if (step && step.stepIndex > tracking.lastStepIndex) {
              if (tracking.lastStepIndex >= 0) {
                callbacks.onStepComplete(tracking.lastStepIndex, {
                  skillName: mode === 'ingest'
                    ? INGEST_STEP_PATTERNS.find((p) => p.stepIndex === tracking.lastStepIndex)?.name ?? '未知'
                    : QUERY_STEP_PATTERNS.find((p) => p.stepIndex === tracking.lastStepIndex)?.name ?? '未知',
                  status: 'success',
                  data: {},
                  tokenUsed: 0,
                  duration: (Date.now() - tracking.startTime) / 1000,
                });
              }
              tracking.lastStepIndex = step.stepIndex;
            }
          }
        }
      },

      onToolUseStart: (tool: { name: string; id: string; input?: Record<string, unknown> }) => {
        const friendly = humanizeTool(tool.name, tool.input);

        if (friendly) {
          if (debounceTimer) clearTimeout(debounceTimer);
          pendingFriendly = friendly;
          debounceTimer = setTimeout(flushPending, 400);
        }

        const cmd = tool.name === 'bash' ? String(tool.input?.command ?? '') : '';
        if (cmd) {
          const step = detectStep(cmd, mode);
          if (step && step.stepIndex !== tracking.lastStepIndex) {
            if (debounceTimer) { clearTimeout(debounceTimer); pendingFriendly = null; }
            sendProgress(`${step.name} — 开始执行`, { stepIndex: step.stepIndex, skillName: step.name });
          }
        }
      },

      onToolResult: (result: { id: string; name: string; content: string }) => {
        const content = result.content;

        if (content.includes('ERROR') || content.includes('Traceback')) {
          console.error('[KodaX] Tool error (suppressed from UI):', content.slice(0, 300));
        }

        const graphMatch = content.match(/Graph:\s*(\d+)\s*nodes?,\s*(\d+)\s*edges?/i);
        if (graphMatch) {
          flushPending();
          sendProgress(`图谱构建完成：${graphMatch[1]} 个节点, ${graphMatch[2]} 条边`);
        }

        const extractMatch = content.match(/Merged:\s*(\d+)\s*nodes?,\s*(\d+)\s*edges?/i);
        if (extractMatch) {
          flushPending();
          sendProgress(`知识提取完成：${extractMatch[1]} 个节点, ${extractMatch[2]} 条边`);
        }

        const fileMatch = content.match(/(?:saved?|wrote?|created?|generated?).*?([^\s/]+\.(?:pdf|docx|xlsx|json|html))/i);
        if (fileMatch) {
          flushPending();
          sendProgress(`文件已生成：${fileMatch[1]}`);
        }
      },

      onIterationEnd: (info) => {
        tracking.totalTokens = info.tokenCount;
      },

      onError: (error: Error) => {
        console.error('[KodaX] Error:', error.message);
      },
    };
  }

  private buildOptions(workspacePath: string, events: KodaXEvents): KodaXOptions {
    return {
      provider: 'minimax-coding',
      maxIter: 150,
      parallel: true,
      context: {
        executionCwd: workspacePath,
        skillsPrompt: buildSkillSummary(),
      },
      events,
    };
  }

  async runIngest(
    workspacePath: string,
    filePaths: string[],
    callbacks: ProgressCallbacks,
  ): Promise<{ success: boolean; lastText: string; totalTokens: number }> {
    const tracking = { startTime: Date.now(), lastStepIndex: -1, totalTokens: 0 };
    const events = this.buildKodaXEvents('ingest', callbacks, tracking);
    const options = this.buildOptions(workspacePath, events);
    options.maxIter = 150;

    const prompt = buildIngestPrompt(workspacePath, filePaths);

    callbacks.onProgress({
      agentId: 'kodax-orchestrator',
      role: 'worker',
      content: '知识工程 pipeline 启动，开始处理文档...',
      timestamp: new Date().toISOString(),
    });

    try {
      const result: KodaXResult = await runKodaX(options, prompt);

      if (tracking.lastStepIndex >= 0) {
        const totalSteps = 5;
        for (let i = tracking.lastStepIndex; i < totalSteps; i++) {
          callbacks.onStepComplete(i, {
            skillName: INGEST_STEP_PATTERNS.find((p) => p.stepIndex === i)?.name ?? '完成',
            status: 'success',
            data: {},
            tokenUsed: Math.floor(tracking.totalTokens / totalSteps),
            duration: (Date.now() - tracking.startTime) / 1000,
          });
        }
      }

      return {
        success: result.success,
        lastText: result.lastText,
        totalTokens: tracking.totalTokens,
      };
    } catch (error) {
      callbacks.onProgress({
        agentId: 'kodax-orchestrator',
        role: 'worker',
        content: `处理失败：${(error as Error).message}`,
        timestamp: new Date().toISOString(),
      });
      return { success: false, lastText: (error as Error).message, totalTokens: tracking.totalTokens };
    }
  }

  async runQuery(
    question: string,
    workspacePath: string,
    callbacks: ProgressCallbacks,
  ): Promise<{ success: boolean; answer: string; totalTokens: number }> {
    const tracking = { startTime: Date.now(), lastStepIndex: -1, totalTokens: 0 };
    const events = this.buildKodaXEvents('query', callbacks, tracking);
    const options = this.buildOptions(workspacePath, events);
    options.maxIter = 40;

    const prompt = buildQueryPrompt(question, workspacePath);

    callbacks.onProgress({
      agentId: 'kodax-orchestrator',
      role: 'worker',
      content: '开始检索知识库，查找相关内容...',
      timestamp: new Date().toISOString(),
    });

    try {
      const result: KodaXResult = await runKodaX(options, prompt);

      callbacks.onStepComplete(0, {
        skillName: '知识检索',
        status: 'success',
        data: {},
        tokenUsed: Math.floor(tracking.totalTokens * 0.6),
        duration: (Date.now() - tracking.startTime) / 1000,
      });

      const answer = extractAnswer(result.lastText);

      callbacks.onStepComplete(1, {
        skillName: '答案生成',
        status: 'success',
        data: { answer },
        tokenUsed: Math.floor(tracking.totalTokens * 0.4),
        duration: (Date.now() - tracking.startTime) / 1000,
      });

      return {
        success: result.success,
        answer,
        totalTokens: tracking.totalTokens,
      };
    } catch (error) {
      callbacks.onProgress({
        agentId: 'kodax-orchestrator',
        role: 'worker',
        content: `查询失败：${(error as Error).message}`,
        timestamp: new Date().toISOString(),
      });
      return { success: false, answer: `查询执行失败: ${(error as Error).message}`, totalTokens: tracking.totalTokens };
    }
  }

  async runExport(
    format: 'docx' | 'xlsx' | 'pdf',
    reportData: ExportReportData,
    outputPath: string,
  ): Promise<{ success: boolean; filePath: string }> {
    const workDir = path.dirname(outputPath);

    const tracking = { startTime: Date.now(), lastStepIndex: -1, totalTokens: 0 };
    const noopCallbacks: ProgressCallbacks = {
      onProgress: () => {},
      onStepComplete: () => {},
    };
    const events = this.buildKodaXEvents('ingest', noopCallbacks, tracking);

    const options: KodaXOptions = {
      provider: 'minimax-coding',
      maxIter: 30,
      parallel: true,
      context: {
        executionCwd: workDir,
        skillsPrompt: `Available skill: ${format} document generation.`,
      },
      events,
    };

    const prompt = buildExportPrompt(format, reportData, outputPath);

    try {
      const result: KodaXResult = await runKodaX(options, prompt);

      if (existsSync(outputPath)) {
        return { success: true, filePath: outputPath };
      }

      const candidates = [
        path.join(workDir, `report.${format}`),
        path.join(workDir, `output.${format}`),
      ];
      for (const candidate of candidates) {
        if (existsSync(candidate)) {
          return { success: true, filePath: candidate };
        }
      }

      return { success: false, filePath: '' };
    } catch (error) {
      console.error(`[KodaX] Export ${format} failed:`, error);
      return { success: false, filePath: '' };
    }
  }
}

let _instance: KodaXOrchestrator | null = null;

export function getKodaXOrchestrator(): KodaXOrchestrator {
  if (!_instance) {
    _instance = new KodaXOrchestrator();
  }
  return _instance;
}
