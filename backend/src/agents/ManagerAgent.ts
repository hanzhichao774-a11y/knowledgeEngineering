import type { AgentConfig, AgentMessage, ExecutionContext } from './types.js';
import { KEWorker } from './KEWorker.js';

export class ManagerAgent {
  config: AgentConfig = {
    id: 'manager-01',
    name: '管理智能体',
    role: 'manager',
    description: 'BizAgentOS 管理智能体，负责任务分析、工作线判断和数字员工委派',
    skills: ['task-analysis', 'skill-check', 'worker-dispatch'],
    model: 'minimax',
  };

  private workers = new Map<string, KEWorker>();

  async analyzeAndDispatch(ctx: ExecutionContext): Promise<void> {
    ctx.onProgress({
      agentId: this.config.id,
      role: 'manager',
      content: '收到任务。正在分析文档类型和工作线归属...',
      timestamp: new Date().toISOString(),
    });

    await sleep(300);

    ctx.onProgress({
      agentId: this.config.id,
      role: 'manager',
      content: '已判断属于知识工程工作线。正在检查数字员工技能覆盖...',
      timestamp: new Date().toISOString(),
    });

    await sleep(300);

    const worker = new KEWorker();
    this.workers.set(ctx.taskId, worker);

    ctx.onProgress({
      agentId: this.config.id,
      role: 'manager',
      content: `知识工程数字员工 #${worker.config.id} 具备所需能力。任务已委派。`,
      timestamp: new Date().toISOString(),
    });

    const allSuccess = await worker.execute(ctx);

    ctx.onProgress({
      agentId: this.config.id,
      role: 'manager',
      content: allSuccess
        ? '知识工程任务已完成。所有步骤执行成功。'
        : '知识工程任务执行中断。部分步骤失败，后续步骤已跳过。',
      timestamp: new Date().toISOString(),
    });
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
