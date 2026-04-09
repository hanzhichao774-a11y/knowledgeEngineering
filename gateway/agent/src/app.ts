import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import Fastify, { type FastifyInstance } from 'fastify';
import type {
  AnswerGenerateRequest,
  GatewayFailure,
  GatewayResponse,
  GatewaySuccess,
  IntentClassifyRequest,
  SkillRunRequest,
} from './contracts.js';
import { OpenAgentGatewayRuntime, type GatewayRuntime } from './runtime.js';

export interface GatewayAppOptions {
  runtime?: GatewayRuntime;
}

let envLoaded = false;

export function loadGatewayEnv(): void {
  if (envLoaded) return;

  for (const envPath of [
    resolve(import.meta.dirname, '../.env'),
    resolve(import.meta.dirname, '../../../backend/.env'),
  ]) {
    try {
      const envContent = readFileSync(envPath, 'utf-8');
      for (const line of envContent.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx === -1) continue;
        const key = trimmed.slice(0, eqIdx).trim();
        let value = trimmed.slice(eqIdx + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    } catch {
      // Ignore missing env files.
    }
  }

  envLoaded = true;
}

export async function buildGatewayApp(options: GatewayAppOptions = {}): Promise<FastifyInstance> {
  loadGatewayEnv();

  const app = Fastify({ logger: true });
  const runtime = options.runtime ?? new OpenAgentGatewayRuntime();

  app.get('/api/gateway/v1/health', async (_request, reply) => {
    try {
      const data = await runtime.health();
      const response: GatewaySuccess<typeof data> = {
        ok: true,
        traceId: 'health',
        taskId: 'health',
        data,
        usage: {
          provider: data.provider,
          model: data.model,
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          latencyMs: 0,
        },
        meta: {
          retryCount: 0,
          fallbackUsed: false,
        },
      };
      return reply.send(response);
    } catch (error) {
      const failure = toFailure('health', 'health', error);
      return reply.code(getStatusCode(error)).send(failure);
    }
  });

  app.post<{ Body: IntentClassifyRequest }>('/api/gateway/v1/intent/classify', async (request, reply) => {
    const traceId = request.body.traceId ?? request.headers['x-trace-id']?.toString() ?? randomUUID();
    const taskId = request.body.taskId ?? request.headers['x-task-id']?.toString() ?? 'unknown-task';
    try {
      const result = await runtime.classifyIntent(request.body);
      const response: GatewaySuccess<typeof result.data> = {
        ok: true,
        traceId,
        taskId,
        data: result.data,
        usage: result.usage,
        meta: result.meta,
      };
      return reply.send(response);
    } catch (error) {
      return reply.code(getStatusCode(error)).send(toFailure(traceId, taskId, error));
    }
  });

  app.post<{ Body: SkillRunRequest }>('/api/gateway/v1/skills/run', async (request, reply) => {
    const traceId = request.body.traceId ?? request.headers['x-trace-id']?.toString() ?? randomUUID();
    const taskId = request.body.taskId ?? request.headers['x-task-id']?.toString() ?? 'unknown-task';
    try {
      const result = await runtime.runSkill(request.body);
      const response: GatewaySuccess<typeof result.data> = {
        ok: true,
        traceId,
        taskId,
        data: result.data,
        usage: result.usage,
        meta: result.meta,
      };
      return reply.send(response);
    } catch (error) {
      return reply.code(getStatusCode(error)).send(toFailure(traceId, taskId, error));
    }
  });

  app.post<{ Body: AnswerGenerateRequest }>('/api/gateway/v1/answer/generate', async (request, reply) => {
    const traceId = request.body.traceId ?? request.headers['x-trace-id']?.toString() ?? randomUUID();
    const taskId = request.body.taskId ?? request.headers['x-task-id']?.toString() ?? 'unknown-task';
    try {
      const result = await runtime.generateAnswer(request.body);
      const response: GatewaySuccess<typeof result.data> = {
        ok: true,
        traceId,
        taskId,
        data: result.data,
        usage: result.usage,
        meta: result.meta,
      };
      return reply.send(response);
    } catch (error) {
      return reply.code(getStatusCode(error)).send(toFailure(traceId, taskId, error));
    }
  });

  return app;
}

function toFailure(traceId: string, taskId: string, error: unknown): GatewayFailure {
  const fallbackMessage = error instanceof Error ? error.message : 'Unknown gateway error';
  const runtimeError = normalizeFailureError(error);
  return {
    ok: false,
    traceId,
    taskId,
    error: {
      code: runtimeError.code,
      message: runtimeError.message || fallbackMessage,
      retryable: runtimeError.retryable,
      details: runtimeError.details,
    },
  };
}

function getStatusCode(error: unknown): number {
  if (error && typeof error === 'object' && 'statusCode' in error && typeof error.statusCode === 'number') {
    return error.statusCode;
  }
  return 500;
}

function normalizeFailureError(error: unknown): {
  code: string;
  message: string;
  retryable: boolean;
  details: Record<string, unknown>;
} {
  if (
    error &&
    typeof error === 'object' &&
    'code' in error &&
    'message' in error &&
    typeof error.code === 'string' &&
    typeof error.message === 'string'
  ) {
    return {
      code: error.code,
      message: error.message,
      retryable: 'retryable' in error && typeof error.retryable === 'boolean' ? error.retryable : false,
      details: 'details' in error && error.details && typeof error.details === 'object'
        ? error.details as Record<string, unknown>
        : {},
    };
  }

  return {
    code: 'INTERNAL_ERROR',
    message: error instanceof Error ? error.message : 'Unknown gateway error',
    retryable: false,
    details: {},
  };
}

export type { GatewayResponse };
