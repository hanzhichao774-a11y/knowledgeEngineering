import { randomUUID } from 'node:crypto';

export interface GatewayUsage {
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  latencyMs: number;
}

export interface GatewayMeta {
  retryCount: number;
  fallbackUsed: boolean;
}

export interface GatewayClientLike {
  classifyIntent(input: {
    taskId: string;
    workspaceId: string;
    query: string;
    hasFile?: boolean;
    context?: Record<string, unknown>;
  }): Promise<{ intent: 'ingest' | 'query'; reason: string; usage: GatewayUsage; meta: GatewayMeta }>;
  runSkill(input: {
    taskId: string;
    workspaceId: string;
    skillName: string;
    input: Record<string, unknown>;
    context?: Record<string, unknown>;
  }): Promise<{ skillName: string; result: Record<string, unknown>; usage: GatewayUsage; meta: GatewayMeta }>;
  generateAnswer(input: {
    taskId: string;
    workspaceId: string;
    question: string;
    retrievalContext: Record<string, unknown>;
    context?: Record<string, unknown>;
  }): Promise<{ answer: string; citations: string[]; usage: GatewayUsage; meta: GatewayMeta }>;
  healthCheck(): Promise<{ ok: boolean; providerStatus: string; provider: string; model: string; skillCount: number }>;
}

interface GatewayEnvelope<T> {
  ok: boolean;
  traceId: string;
  taskId: string;
  data?: T;
  usage?: GatewayUsage;
  meta?: GatewayMeta;
  error?: {
    code: string;
    message: string;
    retryable: boolean;
    details?: Record<string, unknown>;
  };
}

export class GatewayClient implements GatewayClientLike {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(options: { baseUrl?: string; timeoutMs?: number } = {}) {
    const port = Number(process.env.GATEWAY_PORT ?? 3011);
    this.baseUrl = options.baseUrl ?? process.env.GATEWAY_BASE_URL ?? `http://127.0.0.1:${port}`;
    this.timeoutMs = options.timeoutMs ?? Number(process.env.GATEWAY_TIMEOUT_MS ?? 180_000);
  }

  async classifyIntent(input: {
    taskId: string;
    workspaceId: string;
    query: string;
    hasFile?: boolean;
    context?: Record<string, unknown>;
  }): Promise<{ intent: 'ingest' | 'query'; reason: string; usage: GatewayUsage; meta: GatewayMeta }> {
    const response = await this.post<{ intent: 'ingest' | 'query'; reason: string }>('/api/gateway/v1/intent/classify', input);
    return {
      intent: response.data.intent,
      reason: response.data.reason,
      usage: response.usage,
      meta: response.meta,
    };
  }

  async runSkill(input: {
    taskId: string;
    workspaceId: string;
    skillName: string;
    input: Record<string, unknown>;
    context?: Record<string, unknown>;
  }): Promise<{ skillName: string; result: Record<string, unknown>; usage: GatewayUsage; meta: GatewayMeta }> {
    const response = await this.post<{ skillName: string; status: 'success'; result: Record<string, unknown> }>(
      '/api/gateway/v1/skills/run',
      input,
    );
    return {
      skillName: response.data.skillName,
      result: response.data.result,
      usage: response.usage,
      meta: response.meta,
    };
  }

  async generateAnswer(input: {
    taskId: string;
    workspaceId: string;
    question: string;
    retrievalContext: Record<string, unknown>;
    context?: Record<string, unknown>;
  }): Promise<{ answer: string; citations: string[]; usage: GatewayUsage; meta: GatewayMeta }> {
    const response = await this.post<{ answer: string; citations: string[] }>('/api/gateway/v1/answer/generate', input);
    return {
      answer: response.data.answer,
      citations: response.data.citations,
      usage: response.usage,
      meta: response.meta,
    };
  }

  async healthCheck(): Promise<{ ok: boolean; providerStatus: string; provider: string; model: string; skillCount: number }> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(`${this.baseUrl}/api/gateway/v1/health`, {
        method: 'GET',
        signal: controller.signal,
      });
      const payload = await response.json() as GatewayEnvelope<{ ok: boolean; providerStatus: string; provider: string; model: string; skillCount: number }>;
      if (!response.ok || !payload.ok || !payload.data) {
        throw new Error(payload.error?.message ?? 'Gateway health check failed');
      }
      return payload.data;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async post<T>(path: string, body: Record<string, unknown>): Promise<{
    data: T;
    usage: GatewayUsage;
    meta: GatewayMeta;
  }> {
    const traceId = randomUUID();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-trace-id': traceId,
          'x-task-id': String(body.taskId ?? 'unknown-task'),
          'x-workspace-id': String(body.workspaceId ?? 'default'),
          'x-user-id': 'local-admin',
        },
        body: JSON.stringify({
          traceId,
          requestedBy: 'backend',
          ...body,
        }),
        signal: controller.signal,
      });

      const payload = await response.json() as GatewayEnvelope<T>;
      if (!response.ok || !payload.ok || !payload.data || !payload.usage || !payload.meta) {
        throw new Error(payload.error?.message ?? `Gateway request failed for ${path}`);
      }

      return {
        data: payload.data,
        usage: payload.usage,
        meta: payload.meta,
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}
