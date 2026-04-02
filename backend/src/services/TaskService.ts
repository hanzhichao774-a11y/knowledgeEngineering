import { randomUUID } from 'crypto';
import { broadcast } from '../websocket/handler.js';

export interface Step {
  name: string;
  status: 'pending' | 'running' | 'done' | 'error';
  skill: string;
  skillIcon: string;
  tokenUsed: number;
  tokenLimit: number;
  duration?: number;
}

export interface Task {
  id: string;
  title: string;
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
    entities: Array<{ name: string; type: string; desc: string }>;
    entityCount: number;
    relationCount: number;
    ruleCount: number;
    attrCount: number;
  };
  schema: string;
  summary: string;
  graphNodeCount: number;
  graphEdgeCount: number;
}

const tasks = new Map<string, Task>();

const DEFAULT_STEPS: Step[] = [
  { name: '文档解析', status: 'pending', skill: '多模态文档解析', skillIcon: '📑', tokenUsed: 0, tokenLimit: 8000 },
  { name: '本体提取', status: 'pending', skill: '本体提取', skillIcon: '🔍', tokenUsed: 0, tokenLimit: 8000 },
  { name: 'Schema 构建', status: 'pending', skill: 'Schema 构建', skillIcon: '📊', tokenUsed: 0, tokenLimit: 8000 },
  { name: '写入图数据库', status: 'pending', skill: '图数据库写入', skillIcon: '💾', tokenUsed: 0, tokenLimit: 8000 },
  { name: '生成知识图谱', status: 'pending', skill: '知识图谱生成', skillIcon: '🕸️', tokenUsed: 0, tokenLimit: 8000 },
];

export class TaskService {
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
    const task: Task = {
      id: randomUUID(),
      title,
      status: 'queued',
      steps: DEFAULT_STEPS.map((s) => ({ ...s })),
      cost: { inputTokens: 0, outputTokens: 0, estimatedCost: 0, elapsed: '0s' },
      createdAt: new Date().toISOString(),
      fileId,
      description,
    };
    tasks.set(task.id, task);

    broadcast({ type: 'task.created', task: { ...task, result: undefined } });

    setTimeout(() => this.runMockExecution(task.id), 500);

    return task;
  }

  private async runMockExecution(taskId: string) {
    const task = tasks.get(taskId);
    if (!task) return;

    task.status = 'running';
    broadcast({ type: 'task.status', taskId, status: 'running' });

    const stepConfigs = [
      { tokenUsed: 1247, duration: 3.2, inputTokens: 1247, outputTokens: 420, cost: 0.08, elapsed: '6s' },
      { tokenUsed: 3891, duration: 8.5, inputTokens: 3891, outputTokens: 1600, cost: 0.28, elapsed: '28s' },
      { tokenUsed: 5138, duration: 6.3, inputTokens: 5138, outputTokens: 2764, cost: 0.42, elapsed: '55s' },
      { tokenUsed: 5800, duration: 2.1, inputTokens: 5800, outputTokens: 3100, cost: 0.48, elapsed: '1m 15s' },
      { tokenUsed: 6580, duration: 3.5, inputTokens: 6580, outputTokens: 3580, cost: 0.55, elapsed: '1m 28s' },
    ];

    for (let i = 0; i < task.steps.length; i++) {
      task.steps[i].status = 'running';
      broadcast({ type: 'task.step.start', taskId, stepIndex: i });
      broadcast({
        type: 'agent.message',
        message: {
          id: `msg-${Date.now()}`,
          role: 'worker',
          name: '知识工程 #KE-01',
          content: `<p><strong>Step ${i + 1}/5 · ${task.steps[i].name}</strong></p><p>正在执行${task.steps[i].skill}...</p>`,
          timestamp: new Date().toTimeString().slice(0, 5),
          agentStatus: {
            skill: task.steps[i].skill,
            skillIcon: task.steps[i].skillIcon,
            tokenUsed: Math.floor(stepConfigs[i].tokenUsed * 0.5),
            tokenLimit: 8000,
            status: 'running',
          },
        },
      });

      await sleep(stepConfigs[i].duration * 500);

      const cfg = stepConfigs[i];
      task.steps[i].status = 'done';
      task.steps[i].tokenUsed = cfg.tokenUsed;
      task.steps[i].duration = cfg.duration;
      task.cost = {
        inputTokens: cfg.inputTokens,
        outputTokens: cfg.outputTokens,
        estimatedCost: cfg.cost,
        elapsed: cfg.elapsed,
      };

      broadcast({
        type: 'task.step.complete',
        taskId,
        stepIndex: i,
        step: task.steps[i],
        cost: task.cost,
      });

      await sleep(300);
    }

    task.status = 'completed';
    task.result = {
      ontology: {
        entities: [
          { name: '信息安全策略', type: 'entity', desc: '组织信息安全总体方针' },
          { name: '数据分类', type: 'entity', desc: '按敏感程度划分数据类别' },
          { name: '访问控制', type: 'entity', desc: '用户权限管理机制' },
          { name: '管辖', type: 'relation', desc: '安全策略 → 数据分类' },
          { name: '约束', type: 'relation', desc: '访问控制 → 安全等级' },
          { name: '安全等级', type: 'attr', desc: '机密/秘密/内部/公开' },
        ],
        entityCount: 18,
        relationCount: 12,
        ruleCount: 9,
        attrCount: 25,
      },
      schema: 'RDF Schema generated',
      summary: '本文档为企业信息安全管理制度，共 7 章 38 页。',
      graphNodeCount: 10,
      graphEdgeCount: 10,
    };

    broadcast({ type: 'task.complete', taskId });
    broadcast({
      type: 'agent.message',
      message: {
        id: `msg-${Date.now()}`,
        role: 'manager',
        name: '管理智能体',
        content: '<p>✅ <strong>知识工程任务已完成</strong></p>',
        timestamp: new Date().toTimeString().slice(0, 5),
      },
    });
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
