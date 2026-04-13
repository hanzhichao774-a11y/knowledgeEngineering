import { randomUUID } from 'crypto';
import { readFileSync } from 'node:fs';
import { broadcast } from '../websocket/handler.js';
import { ManagerAgent } from '../agents/ManagerAgent.js';
import { storeGraphData } from './GraphService.js';
import { getFilePath } from '../routes/upload.js';
import { getWorkspaceManager } from './WorkspaceManager.js';
import type { AgentMessage, SkillResult, ExecutionContext, TaskIntent } from '../agents/types.js';
import { GatewayClient, type GatewayClientLike } from '../clients/GatewayClient.js';
import { GraphifyClient, type GraphifyClientLike } from '../clients/GraphifyClient.js';

export interface Step {
  name: string;
  status: 'pending' | 'running' | 'done' | 'error' | 'skipped';
  skill: string;
  skillIcon: string;
  tokenUsed: number;
  tokenLimit: number;
  duration?: number;
}

export interface Task {
  id: string;
  title: string;
  intent?: TaskIntent;
  status: 'queued' | 'running' | 'completed' | 'failed';
  steps: Step[];
  cost: { inputTokens: number; outputTokens: number; estimatedCost: number; elapsed: string };
  createdAt: string;
  fileId?: string;
  fileIds?: string[];
  description?: string;
  result?: TaskResult;
}

export interface TaskResult {
  ontology: {
    classes?: Array<{ name: string; desc: string }>;
    entities?: Array<{ name: string; class: string; desc: string }>;
    relations?: Array<{ name: string; source: string; target: string; desc: string }>;
    attributes?: Array<{ name: string; entity: string; value: string; desc: string }>;
    classCount?: number;
    entityCount?: number;
    relationCount?: number;
    attrCount?: number;
  };
  schema: string;
  summary: string;
  graphNodeCount: number;
  graphEdgeCount: number;
  answer?: string;
  answerMeta?: {
    source?: string;
    snapshotId?: string | null;
    freshness?: unknown;
  };
}

const tasks = new Map<string, Task>();

const INGEST_STEPS: Step[] = [
  { name: '文档规范化', status: 'pending', skill: '文档规范化', skillIcon: '📑', tokenUsed: 0, tokenLimit: 8000 },
  { name: '知识提取', status: 'pending', skill: '知识提取', skillIcon: '🔍', tokenUsed: 0, tokenLimit: 8000 },
  { name: '图谱构建', status: 'pending', skill: '图谱构建', skillIcon: '🕸️', tokenUsed: 0, tokenLimit: 8000 },
  { name: '知识导出', status: 'pending', skill: '知识导出', skillIcon: '📤', tokenUsed: 0, tokenLimit: 8000 },
  { name: '资产构建', status: 'pending', skill: '资产构建', skillIcon: '📊', tokenUsed: 0, tokenLimit: 8000 },
];

const QUERY_STEPS: Step[] = [
  { name: '知识检索', status: 'pending', skill: '知识检索', skillIcon: '🔎', tokenUsed: 0, tokenLimit: 8000 },
  { name: '答案生成', status: 'pending', skill: '答案生成', skillIcon: '💡', tokenUsed: 0, tokenLimit: 8000 },
];

const SKILL_ICONS: Record<string, string> = {
  '文档规范化': '📑',
  '知识提取': '🔍',
  '图谱构建': '🕸️',
  '知识导出': '📤',
  '资产构建': '📊',
  '知识检索': '🔎',
  '答案生成': '💡',
};

export class TaskService {
  private readonly gatewayClient: GatewayClientLike;
  private readonly graphifyClient: GraphifyClientLike;
  private readonly workspaceId: string;
  private readonly manager = new ManagerAgent();

  constructor(options: {
    gatewayClient?: GatewayClientLike;
    graphifyClient?: GraphifyClientLike;
    workspaceId?: string;
  } = {}) {
    this.gatewayClient = options.gatewayClient ?? new GatewayClient();
    this.graphifyClient = options.graphifyClient ?? new GraphifyClient();
    this.workspaceId = options.workspaceId ?? 'default';
  }

  listTasks() {
    return Array.from(tasks.values()).map(({ result, ...rest }) => rest);
  }

  getTask(id: string) {
    return tasks.get(id) ?? null;
  }

  getTaskResult(id: string) {
    return tasks.get(id)?.result ?? null;
  }

  async createTask(title: string, description?: string, fileIds?: string[]): Promise<Task> {
    const hasFile = !!fileIds && fileIds.length > 0;
    const initialSteps = hasFile
      ? INGEST_STEPS.map((step) => ({ ...step }))
      : QUERY_STEPS.map((step) => ({ ...step }));

    const task: Task = {
      id: randomUUID(),
      title,
      status: 'queued',
      steps: initialSteps,
      cost: { inputTokens: 0, outputTokens: 0, estimatedCost: 0, elapsed: '0s' },
      createdAt: new Date().toISOString(),
      fileId: fileIds?.[0],
      fileIds,
      description,
    };
    tasks.set(task.id, task);

    broadcast({ type: 'task.created', task: { ...task, result: undefined } });

    this.executeTask(task.id).catch((error) => {
      console.error(`Task ${task.id} execution failed:`, error);
      task.status = 'failed';
      broadcast({ type: 'task.status', taskId: task.id, status: 'failed' });
    });

    return task;
  }

  private async executeTask(taskId: string) {
    const task = tasks.get(taskId);
    if (!task) return;

    const startTime = Date.now();
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let latestManagerMsgId: string | undefined;

    const allFileIds = task.fileIds;
    const filePaths = allFileIds
      ?.map((fid) => getFilePath(fid))
      .filter((p): p is string => !!p);
    const filePath = filePaths?.[0] ?? (task.fileId ? getFilePath(task.fileId) : undefined);
    const hasFiles = !!filePaths && filePaths.length > 0;

    const ctx: ExecutionContext = {
      taskId,
      intent: hasFiles || task.fileId ? 'ingest' : 'query',
      workspaceId: this.workspaceId,
      query: task.title,
      fileId: task.fileId,
      filePath,
      fileIds: allFileIds,
      filePaths,
      previousResults: [],
      services: {
        gateway: this.gatewayClient,
        graphify: this.graphifyClient,
      },
      onProgress: (msg: AgentMessage) => {
        const stepIndex = msg.metadata?.stepIndex as number | undefined;
        if (stepIndex !== undefined && msg.content.includes('开始执行')) {
          if (task.steps[stepIndex]) {
            task.steps[stepIndex].status = 'running';
            broadcast({ type: 'task.step.start', taskId, stepIndex });
          }
        }

        const skillName = msg.metadata?.skillName as string | undefined;
        const agentStatus = stepIndex !== undefined && skillName
          ? {
            skill: skillName,
            skillIcon: SKILL_ICONS[skillName] || '⚙️',
            tokenUsed: 0,
            tokenLimit: 8000,
            status: (msg.content.includes('完成') || msg.content.includes('失败') ? 'done' : 'running') as 'running' | 'done',
          }
          : undefined;

        const isManager = msg.role === 'manager';
        const msgId = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        if (isManager) {
          latestManagerMsgId = msgId;
        }

        broadcast({
          type: 'agent.message',
          message: {
            id: msgId,
            role: isManager ? 'manager' : 'worker',
            name: isManager ? '管理智能体' : (ctx.intent === 'query' ? '知识检索 #QR-01' : '知识工程 #KE-01'),
            content: `<p>${msg.content}</p>`,
            timestamp: new Date().toTimeString().slice(0, 5),
            agentStatus,
            parentId: isManager ? undefined : latestManagerMsgId,
          },
        });
      },
      onStepComplete: (stepIndex: number, result: SkillResult) => {
        const step = task.steps[stepIndex];
        if (!step) return;

        const errorData = result.data as Record<string, unknown> | undefined;
        const isSkipped = result.status === 'error' && typeof errorData?.error === 'string' && (errorData.error as string).startsWith('跳过');
        step.status = result.status === 'success' ? 'done' : isSkipped ? 'skipped' : 'error';
        step.tokenUsed = result.tokenUsed;
        step.duration = result.duration;

        totalInputTokens += result.tokenUsed;
        totalOutputTokens += Math.floor(result.tokenUsed * 0.4);

        task.cost = {
          inputTokens: totalInputTokens,
          outputTokens: totalOutputTokens,
          estimatedCost: parseFloat(((totalInputTokens + totalOutputTokens) * 0.00003).toFixed(2)),
          elapsed: formatElapsed(Date.now() - startTime),
        };

        broadcast({
          type: 'task.step.complete',
          taskId,
          stepIndex,
          step: { ...step },
          cost: { ...task.cost },
        });
      },
    };

    task.status = 'running';
    latestManagerMsgId = `msg-mgr-${Date.now()}`;
    broadcast({
      type: 'agent.message',
      message: {
        id: latestManagerMsgId,
        role: 'manager',
        name: '管理智能体',
        content: `<p>任务已接收，正在分配数字员工处理...</p>`,
        timestamp: new Date().toTimeString().slice(0, 5),
      },
    });
    broadcast({ type: 'task.status', taskId, status: 'running' });

    await this.manager.analyzeAndDispatch(ctx);

    const actualIntent = ctx.intent;
    task.intent = actualIntent;

    if (actualIntent === 'query' && task.steps.length === 5) {
      task.steps = QUERY_STEPS.map((step) => ({ ...step }));
      broadcast({ type: 'task.steps.reset', taskId, steps: task.steps });
    }

    const hasError = ctx.previousResults.some((result) => result.status === 'error');
    const failedSteps = task.steps
      .filter((step) => step.status === 'error')
      .map((step) => step.name);
    const completedSteps = task.steps.filter((step) => step.status === 'done');

    task.steps.forEach((step) => {
      if (step.status === 'pending') step.status = 'skipped';
    });

    task.status = hasError ? 'failed' : 'completed';

    if (actualIntent === 'query') {
      this.finalizeQueryTask(task, ctx, hasError, failedSteps);
    } else {
      this.finalizeIngestTask(task, ctx, hasError, failedSteps, completedSteps);
    }

    broadcast({ type: 'task.complete', taskId, status: task.status });
  }

  private finalizeQueryTask(
    task: Task,
    ctx: ExecutionContext,
    hasError: boolean,
    failedSteps: string[],
  ) {
    const answerResult = ctx.previousResults.find((result) => result.skillName === '答案生成');
    const retrieveResult = ctx.previousResults.find((result) => result.skillName === '知识检索');
    const answerData = answerResult?.status === 'success' ? answerResult.data as Record<string, unknown> : undefined;
    const retrieveData = retrieveResult?.status === 'success' ? retrieveResult.data as Record<string, unknown> : undefined;

    const answer = (answerData?.answer as string) ?? '';
    const basedOnResults = (answerData?.basedOnResults as number) ?? 0;

    task.result = {
      ontology: { classes: [], entities: [], relations: [], attributes: [], classCount: 0, entityCount: 0, relationCount: 0, attrCount: 0 },
      schema: '',
      summary: '',
      graphNodeCount: 0,
      graphEdgeCount: 0,
      answer,
      answerMeta: {
        source: retrieveData?.source as string | undefined,
        snapshotId: retrieveData?.snapshotId as string | null | undefined,
        freshness: retrieveData?.freshness,
      },
    };

    if (hasError) {
      broadcast({
        type: 'agent.message',
        message: {
          id: `msg-${Date.now()}`,
          role: 'manager',
          name: '管理智能体',
          content: `<p>❌ <strong>知识检索失败</strong></p>
<p>失败步骤：${failedSteps.join('、')}</p>
<p>💰 已消耗：输入 ${task.cost.inputTokens} Token · 输出 ${task.cost.outputTokens} Token</p>`,
          timestamp: new Date().toTimeString().slice(0, 5),
        },
      });
      return;
    }

    broadcast({
      type: 'agent.message',
      message: {
        id: `msg-answer-${Date.now()}`,
        role: 'assistant',
        name: '知识助手',
        content: answer,
        timestamp: new Date().toTimeString().slice(0, 5),
        metadata: {
          isAnswer: true,
          basedOnResults,
          source: (retrieveData?.source as string) ?? 'unknown',
          snapshotId: retrieveData?.snapshotId,
          freshness: retrieveData?.freshness,
        },
      },
    });
  }

  private finalizeIngestTask(
    task: Task,
    ctx: ExecutionContext,
    hasError: boolean,
    failedSteps: string[],
    completedSteps: Step[],
  ) {
    const normalizeResult = ctx.previousResults.find((result) => result.skillName === '文档规范化');
    const exportResult = ctx.previousResults.find((result) => result.skillName === '知识导出');

    const normalizeData = normalizeResult?.status === 'success' ? normalizeResult.data as Record<string, unknown> : undefined;
    const exportData = exportResult?.status === 'success' ? exportResult.data as Record<string, unknown> : undefined;

    const neo4jResult = exportData?.neo4j as Record<string, unknown> | undefined;
    const graphNodeCount = (neo4jResult?.nodes as number) ?? 0;
    const graphEdgeCount = (neo4jResult?.edges as number) ?? 0;

    task.result = {
      ontology: {
        classes: [],
        entities: [],
        relations: [],
        attributes: [],
        classCount: 0,
        entityCount: 0,
        relationCount: 0,
        attrCount: 0,
      },
      schema: '',
      summary: buildKnowledgeSummary(normalizeData, graphNodeCount, graphEdgeCount),
      graphNodeCount,
      graphEdgeCount,
    };

    if (hasError) {
      broadcast({
        type: 'agent.message',
        message: {
          id: `msg-${Date.now()}`,
          role: 'manager',
          name: '管理智能体',
          content: `<p>❌ <strong>知识工程任务失败</strong></p>
<p>失败步骤：${failedSteps.join('、')}</p>
<p>已完成：${completedSteps.length} / ${task.steps.length} 步</p>
<p>💰 已消耗：输入 ${task.cost.inputTokens} Token · 输出 ${task.cost.outputTokens} Token · 预估费用 ¥${task.cost.estimatedCost}</p>`,
          timestamp: new Date().toTimeString().slice(0, 5),
        },
      });
      return;
    }

    const modeLabel = normalizeData?.isIncremental ? '增量更新' : '全量构建';
    broadcast({
      type: 'agent.message',
      message: {
        id: `msg-${Date.now()}`,
        role: 'manager',
        name: '管理智能体',
        content: `<p>✅ <strong>知识工程任务已完成（${modeLabel}）</strong></p>
<p>知识工程数字员工 #KE-01 已完成全部 ${task.steps.length} 个步骤：</p>
<p>• 文档规范化 → 知识提取 → 图谱构建 → 知识导出 → 资产构建</p>
<p>📊 Neo4j：${graphNodeCount} 个节点、${graphEdgeCount} 条关系</p>
<p>💰 总消耗：输入 ${task.cost.inputTokens} Token · 输出 ${task.cost.outputTokens} Token · 预估费用 ¥${task.cost.estimatedCost}</p>`,
        timestamp: new Date().toTimeString().slice(0, 5),
      },
    });
  }

}

function buildSummaryWithValidation(docData: Record<string, unknown> | undefined): string {
  const summary = (docData?.summary as string) ?? '';
  const validation = docData?.validation as Record<string, unknown> | undefined;
  if (!validation || !validation.mode) return summary;

  const confidenceMap: Record<string, string> = {
    high: '高置信（双通道一致）',
    medium: '中置信（单通道或差异<5%）',
    low: '低置信（双通道差异>=5%）',
  };

  const mode = validation.mode as string;
  const confidence = validation.confidence as string;
  const label = confidenceMap[confidence] ?? confidence;

  let validationNote = `\n\n---\n**解析校验**: ${mode === 'dual-channel' ? '双通道交叉校验' : '单通道'} | **置信度**: ${label}`;

  if (validation.totalCells) {
    validationNote += ` | **单元格**: ${validation.matchedCells}/${validation.totalCells} 匹配`;
  }

  const mismatches = validation.mismatchedCells as number | undefined;
  if (mismatches && mismatches > 0) {
    validationNote += ` | **差异**: ${mismatches} 个单元格`;
  }

  return summary + validationNote;
}

function buildKnowledgeSummary(
  normalizeData: Record<string, unknown> | undefined,
  graphNodeCount: number,
  graphEdgeCount: number,
): string {
  try {
    const ws = getWorkspaceManager();
    const report = readFileSync(ws.graphReportPath, 'utf-8');
    if (report.trim().length > 0) return report.slice(0, 800);
  } catch { /* fallback */ }

  if (!normalizeData) return '';
  const fileCount = (normalizeData.newFileCount as number) ?? 0;
  const mode = normalizeData.isIncremental ? '增量' : '全量';
  return `已处理 ${fileCount} 个文件（${mode}模式），构建知识图谱：${graphNodeCount} 个节点、${graphEdgeCount} 条关系`;
}

function formatElapsed(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}
