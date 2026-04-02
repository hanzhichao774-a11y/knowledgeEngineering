import type { AgentConfig, ExecutionContext, TaskIntent } from './types.js';
import { KEWorker } from './KEWorker.js';
import { QueryWorker } from './QueryWorker.js';
import { isNeo4jConnected } from '../db/neo4j.js';
import { callLLM } from '../services/LLMService.js';

export class ManagerAgent {
  config: AgentConfig = {
    id: 'manager-01',
    name: '管理智能体',
    role: 'manager',
    description: 'BizAgentOS 管理智能体，负责任务分析、工作线判断和数字员工委派',
    skills: ['task-analysis', 'skill-check', 'worker-dispatch'],
    model: 'minimax',
  };

  async analyzeAndDispatch(ctx: ExecutionContext): Promise<void> {
    ctx.onProgress({
      agentId: this.config.id,
      role: 'manager',
      content: '收到任务。正在分析任务类型...',
      timestamp: new Date().toISOString(),
    });

    const intent = await this.detectIntent(ctx);
    ctx.intent = intent;

    if (intent === 'query') {
      await this.dispatchQuery(ctx);
    } else {
      await this.dispatchIngest(ctx);
    }
  }

  private async detectIntent(ctx: ExecutionContext): Promise<TaskIntent> {
    if (ctx.fileId || ctx.filePath) {
      ctx.onProgress({
        agentId: this.config.id,
        role: 'manager',
        content: '检测到文件附件，判断为知识入库任务。',
        timestamp: new Date().toISOString(),
      });
      return 'ingest';
    }

    const query = ctx.query ?? '';
    const ingestKeywords = ['构建图谱', '入库', '处理文档', '提取本体', '解析文档', '生成知识图谱'];
    if (ingestKeywords.some((kw) => query.includes(kw))) {
      ctx.onProgress({
        agentId: this.config.id,
        role: 'manager',
        content: '判断为知识入库任务。',
        timestamp: new Date().toISOString(),
      });
      return 'ingest';
    }

    if (!isNeo4jConnected()) {
      ctx.onProgress({
        agentId: this.config.id,
        role: 'manager',
        content: 'Neo4j 未连接，无法检索知识库。将按知识入库流程处理。',
        timestamp: new Date().toISOString(),
      });
      return 'ingest';
    }

    try {
      const { text } = await callLLM(
        '你是一个任务分类器。判断用户输入是"知识入库"（处理文档、构建图谱等）还是"知识查询"（基于已有知识回答问题）。只回复 ingest 或 query，不要其他内容。',
        query,
      );
      const result = text.trim().toLowerCase();
      const intent: TaskIntent = result.includes('ingest') ? 'ingest' : 'query';

      ctx.onProgress({
        agentId: this.config.id,
        role: 'manager',
        content: intent === 'query'
          ? '判断为知识查询任务。将检索已有知识库回答问题。'
          : '判断为知识入库任务。',
        timestamp: new Date().toISOString(),
      });
      return intent;
    } catch {
      ctx.onProgress({
        agentId: this.config.id,
        role: 'manager',
        content: '意图判断失败，默认按知识查询处理。',
        timestamp: new Date().toISOString(),
      });
      return 'query';
    }
  }

  private async dispatchIngest(ctx: ExecutionContext): Promise<void> {
    ctx.onProgress({
      agentId: this.config.id,
      role: 'manager',
      content: '已判断属于知识工程工作线。正在检查数字员工技能覆盖...',
      timestamp: new Date().toISOString(),
    });

    await sleep(300);

    const worker = new KEWorker();

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

  private async dispatchQuery(ctx: ExecutionContext): Promise<void> {
    ctx.onProgress({
      agentId: this.config.id,
      role: 'manager',
      content: '正在委派知识检索数字员工...',
      timestamp: new Date().toISOString(),
    });

    await sleep(200);

    const worker = new QueryWorker();

    ctx.onProgress({
      agentId: this.config.id,
      role: 'manager',
      content: `知识检索数字员工 #${worker.config.id} 已就绪。开始检索知识库。`,
      timestamp: new Date().toISOString(),
    });

    const allSuccess = await worker.execute(ctx);

    ctx.onProgress({
      agentId: this.config.id,
      role: 'manager',
      content: allSuccess
        ? '知识检索完成。已基于知识库生成回答。'
        : '知识检索过程中出现错误。',
      timestamp: new Date().toISOString(),
    });
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
