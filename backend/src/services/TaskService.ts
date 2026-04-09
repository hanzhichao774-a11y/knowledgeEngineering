import { randomUUID } from 'crypto';
import { broadcast } from '../websocket/handler.js';
import { ManagerAgent } from '../agents/ManagerAgent.js';
import { storeGraphData } from './GraphService.js';
import { getFilePath } from '../routes/upload.js';
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
  { name: '文档解析', status: 'pending', skill: '多模态文档解析', skillIcon: '📑', tokenUsed: 0, tokenLimit: 8000 },
  { name: '本体提取', status: 'pending', skill: '本体提取', skillIcon: '🔍', tokenUsed: 0, tokenLimit: 8000 },
  { name: 'Schema 构建', status: 'pending', skill: 'Schema 构建', skillIcon: '📊', tokenUsed: 0, tokenLimit: 8000 },
  { name: '写入图数据库', status: 'pending', skill: '图数据库写入', skillIcon: '💾', tokenUsed: 0, tokenLimit: 8000 },
  { name: '生成知识图谱', status: 'pending', skill: '知识图谱生成', skillIcon: '🕸️', tokenUsed: 0, tokenLimit: 8000 },
];

const QUERY_STEPS: Step[] = [
  { name: '知识检索', status: 'pending', skill: '知识检索', skillIcon: '🔎', tokenUsed: 0, tokenLimit: 8000 },
  { name: '答案生成', status: 'pending', skill: '答案生成', skillIcon: '💡', tokenUsed: 0, tokenLimit: 8000 },
];

const SKILL_ICONS: Record<string, string> = {
  '多模态文档解析': '📑',
  '本体提取': '🔍',
  'Schema 构建': '📊',
  '图数据库写入': '💾',
  '知识图谱生成': '🕸️',
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

  async createTask(title: string, description?: string, fileId?: string): Promise<Task> {
    const hasFile = !!fileId;
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
      fileId,
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

    const filePath = task.fileId ? getFilePath(task.fileId) : undefined;

    const ctx: ExecutionContext = {
      taskId,
      intent: task.fileId ? 'ingest' : 'query',
      workspaceId: this.workspaceId,
      query: task.title,
      fileId: task.fileId,
      filePath,
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

        broadcast({
          type: 'agent.message',
          message: {
            id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            role: msg.role === 'manager' ? 'manager' : 'worker',
            name: msg.role === 'manager' ? '管理智能体' : (ctx.intent === 'query' ? '知识检索 #QR-01' : '知识工程 #KE-01'),
            content: `<p>${msg.content}</p>`,
            timestamp: new Date().toTimeString().slice(0, 5),
            agentStatus,
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
    const docResult = ctx.previousResults.find((result) => result.skillName === '多模态文档解析');
    const ontologyResult = ctx.previousResults.find((result) => result.skillName === '本体提取');
    const schemaResult = ctx.previousResults.find((result) => result.skillName === 'Schema 构建');
    const graphResult = ctx.previousResults.find((result) => result.skillName === '知识图谱生成');

    const ontologyData = ontologyResult?.status === 'success' ? ontologyResult.data as Record<string, unknown> : undefined;
    const schemaData = schemaResult?.status === 'success' ? schemaResult.data as Record<string, unknown> : undefined;
    const docData = docResult?.status === 'success' ? docResult.data as Record<string, unknown> : undefined;
    const graphData = graphResult?.status === 'success' ? graphResult.data as Record<string, unknown> : undefined;

    if (graphData?.nodes && graphData?.edges) {
      storeGraphData(task.id, {
        nodes: graphData.nodes as Array<{ id: string; label: string; type: string }>,
        edges: graphData.edges as Array<{ source: string; target: string; label: string }>,
      });
    }

    task.result = {
      ontology: {
        classes: (ontologyData?.classes as Array<{ name: string; desc: string }>) ?? [],
        entities: (ontologyData?.entities as Array<{ name: string; class: string; desc: string }>) ?? [],
        relations: (ontologyData?.relations as Array<{ name: string; source: string; target: string; desc: string }>) ?? [],
        attributes: (ontologyData?.attributes as Array<{ name: string; entity: string; value: string; desc: string }>) ?? [],
        classCount: (ontologyData?.classCount as number) ?? 0,
        entityCount: (ontologyData?.entityCount as number) ?? 0,
        relationCount: (ontologyData?.relationCount as number) ?? 0,
        attrCount: (ontologyData?.attrCount as number) ?? 0,
      },
      schema: (schemaData?.schema as string) ?? '',
      summary: buildSummaryWithValidation(docData),
      graphNodeCount: (graphData?.nodeCount as number) ?? 0,
      graphEdgeCount: (graphData?.edgeCount as number) ?? 0,
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

    this.refreshKnowledgeBase(ctx).catch((error) => {
      console.warn('[TaskService] Graphify refresh failed:', error instanceof Error ? error.message : String(error));
    });

    broadcast({
      type: 'agent.message',
      message: {
        id: `msg-${Date.now()}`,
        role: 'manager',
        name: '管理智能体',
        content: `<p>✅ <strong>知识工程任务已完成</strong></p>
<p>知识工程数字员工 #KE-01 已完成全部 ${task.steps.length} 个步骤：</p>
<p>• 文档解析 → 本体提取 → Schema 构建 → 图数据库写入 → 知识图谱生成</p>
<p>📊 产出：${task.result.ontology.classCount ?? 0} 个本体类、${task.result.ontology.entityCount ?? 0} 个实体、${task.result.ontology.relationCount ?? 0} 条关系</p>
<p>💰 总消耗：输入 ${task.cost.inputTokens} Token · 输出 ${task.cost.outputTokens} Token · 预估费用 ¥${task.cost.estimatedCost}</p>`,
        timestamp: new Date().toTimeString().slice(0, 5),
      },
    });
  }

  private async refreshKnowledgeBase(ctx: ExecutionContext): Promise<void> {
    await this.graphifyClient.rebuild({
      mode: 'full',
      changedFiles: ctx.filePath ? [ctx.filePath] : [],
      reason: 'post_ingest_refresh',
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

function formatElapsed(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}
