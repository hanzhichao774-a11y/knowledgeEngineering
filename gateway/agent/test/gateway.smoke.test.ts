import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGatewayApp } from '../src/app.js';
import type { GatewayRuntime } from '../src/runtime.js';

const baseUsage = {
  provider: 'stub',
  model: 'stub-model',
  inputTokens: 12,
  outputTokens: 4,
  totalTokens: 16,
  latencyMs: 1,
};

const baseMeta = {
  retryCount: 0,
  fallbackUsed: false,
};

function createRuntime(overrides: Partial<GatewayRuntime> = {}): GatewayRuntime {
  return {
    async classifyIntent() {
      throw new Error('not used');
    },
    async runSkill() {
      throw new Error('not used');
    },
    async generateAnswer() {
      throw new Error('not used');
    },
    async health() {
      return {
        ok: true,
        status: 'ok',
        providerStatus: 'configured',
        provider: 'stub',
        model: 'stub-model',
        skillCount: 4,
        providers: [{ name: 'stub', configured: true }],
        skills: ['document-parse-summary', 'ontology-extract', 'schema-build', 'answer-generate'],
      };
    },
    ...overrides,
  };
}

test('gateway health endpoint returns contract envelope', async () => {
  const runtime = createRuntime();

  const app = await buildGatewayApp({ runtime });
  const response = await app.inject({
    method: 'GET',
    url: '/api/gateway/v1/health',
  });

  assert.equal(response.statusCode, 200);
  const payload = response.json();
  assert.equal(payload.ok, true);
  assert.equal(payload.data.provider, 'stub');
  assert.equal(payload.data.skillCount, 4);
  assert.equal(payload.data.status, 'ok');
  assert.equal(payload.data.providers[0].name, 'stub');
  await app.close();
});

test('gateway intent endpoint returns wrapped success payload', async () => {
  const runtime = createRuntime({
    async classifyIntent(input) {
      assert.equal(input.query, '帮我总结文档');
      return {
        data: {
          intent: 'ingest',
          reason: 'stub-intent',
        },
        usage: baseUsage,
        meta: baseMeta,
      };
    },
  });

  const app = await buildGatewayApp({ runtime });
  const response = await app.inject({
    method: 'POST',
    url: '/api/gateway/v1/intent/classify',
    payload: {
      traceId: 'trace-intent',
      taskId: 'task-intent',
      query: '帮我总结文档',
    },
  });

  assert.equal(response.statusCode, 200);
  const payload = response.json();
  assert.equal(payload.ok, true);
  assert.equal(payload.traceId, 'trace-intent');
  assert.equal(payload.taskId, 'task-intent');
  assert.equal(payload.data.intent, 'ingest');
  assert.equal(payload.data.reason, 'stub-intent');
  assert.equal(payload.usage.totalTokens, 16);
  await app.close();
});

test('gateway skills endpoint returns wrapped success payload', async () => {
  const runtime = createRuntime({
    async runSkill(input) {
      assert.equal(input.skillName, 'ontology-extract');
      return {
        data: {
          skillName: input.skillName,
          status: 'success',
          result: {
            entities: [],
          },
        },
        usage: baseUsage,
        meta: baseMeta,
      };
    },
  });

  const app = await buildGatewayApp({ runtime });
  const response = await app.inject({
    method: 'POST',
    url: '/api/gateway/v1/skills/run',
    payload: {
      traceId: 'trace-test',
      taskId: 'task-test',
      workspaceId: 'default',
      skillName: 'ontology-extract',
      input: {
        documentText: 'hello',
      },
    },
  });

  assert.equal(response.statusCode, 200);
  const payload = response.json();
  assert.equal(payload.ok, true);
  assert.equal(payload.traceId, 'trace-test');
  assert.equal(payload.taskId, 'task-test');
  assert.equal(payload.data.skillName, 'ontology-extract');
  assert.equal(payload.usage.totalTokens, 16);
  await app.close();
});

test('gateway answer endpoint returns wrapped success payload', async () => {
  const runtime = createRuntime({
    async generateAnswer(input) {
      assert.equal(input.question, 'A站温度是多少？');
      return {
        data: {
          answer: '# A站温度\n\n42C',
          citations: ['weekly-report.md'],
        },
        usage: baseUsage,
        meta: baseMeta,
      };
    },
  });

  const app = await buildGatewayApp({ runtime });
  const response = await app.inject({
    method: 'POST',
    url: '/api/gateway/v1/answer/generate',
    payload: {
      traceId: 'trace-answer',
      taskId: 'task-answer',
      question: 'A站温度是多少？',
      retrievalContext: {
        graphifySources: ['weekly-report.md'],
      },
    },
  });

  assert.equal(response.statusCode, 200);
  const payload = response.json();
  assert.equal(payload.ok, true);
  assert.equal(payload.traceId, 'trace-answer');
  assert.equal(payload.taskId, 'task-answer');
  assert.equal(payload.data.citations[0], 'weekly-report.md');
  assert.equal(payload.usage.totalTokens, 16);
  await app.close();
});

test('gateway answer endpoint preserves structured answer payload fields', async () => {
  const runtime = createRuntime({
    async generateAnswer() {
      return {
        data: {
          answer: '# 结论\n\nA站温度为 42C',
          citations: ['weekly-report.md'],
          citationDetails: [{ source: 'weekly-report.md', location: '2.1' }],
          sections: [
            { type: 'summary', title: '结论', content: 'A站温度为 42C' },
          ],
        },
        usage: baseUsage,
        meta: baseMeta,
      };
    },
  });

  const app = await buildGatewayApp({ runtime });
  const response = await app.inject({
    method: 'POST',
    url: '/api/gateway/v1/answer/generate',
    payload: {
      traceId: 'trace-structured-answer',
      taskId: 'task-structured-answer',
      question: 'A站温度是多少？',
      outputMode: 'structured',
      retrievalContext: {},
    },
  });

  assert.equal(response.statusCode, 200);
  const payload = response.json();
  assert.equal(payload.ok, true);
  assert.equal(payload.data.sections[0].title, '结论');
  assert.equal(payload.data.citationDetails[0].location, '2.1');
  await app.close();
});

test('gateway intent endpoint returns wrapped failure payload', async () => {
  const runtime = createRuntime({
    async classifyIntent() {
      throw new Error('intent boom');
    },
  });

  const app = await buildGatewayApp({ runtime });
  const response = await app.inject({
    method: 'POST',
    url: '/api/gateway/v1/intent/classify',
    payload: {
      traceId: 'trace-intent-fail',
      taskId: 'task-intent-fail',
      query: 'query',
    },
  });

  assert.equal(response.statusCode, 500);
  const payload = response.json();
  assert.equal(payload.ok, false);
  assert.equal(payload.traceId, 'trace-intent-fail');
  assert.equal(payload.taskId, 'task-intent-fail');
  assert.equal(payload.error.code, 'INTERNAL_ERROR');
  assert.equal(payload.error.message, 'intent boom');
  await app.close();
});

test('gateway skills endpoint returns wrapped failure payload', async () => {
  const runtime = createRuntime({
    async runSkill() {
      throw new Error('skill boom');
    },
  });

  const app = await buildGatewayApp({ runtime });
  const response = await app.inject({
    method: 'POST',
    url: '/api/gateway/v1/skills/run',
    payload: {
      traceId: 'trace-skill-fail',
      taskId: 'task-skill-fail',
      skillName: 'ontology-extract',
      input: {},
    },
  });

  assert.equal(response.statusCode, 500);
  const payload = response.json();
  assert.equal(payload.ok, false);
  assert.equal(payload.traceId, 'trace-skill-fail');
  assert.equal(payload.taskId, 'task-skill-fail');
  assert.equal(payload.error.code, 'INTERNAL_ERROR');
  assert.equal(payload.error.message, 'skill boom');
  await app.close();
});

test('gateway answer endpoint returns wrapped failure payload', async () => {
  const runtime = createRuntime({
    async generateAnswer() {
      throw new Error('answer boom');
    },
  });

  const app = await buildGatewayApp({ runtime });
  const response = await app.inject({
    method: 'POST',
    url: '/api/gateway/v1/answer/generate',
    payload: {
      traceId: 'trace-answer-fail',
      taskId: 'task-answer-fail',
      question: 'question',
      retrievalContext: {},
    },
  });

  assert.equal(response.statusCode, 500);
  const payload = response.json();
  assert.equal(payload.ok, false);
  assert.equal(payload.traceId, 'trace-answer-fail');
  assert.equal(payload.taskId, 'task-answer-fail');
  assert.equal(payload.error.code, 'INTERNAL_ERROR');
  assert.equal(payload.error.message, 'answer boom');
  await app.close();
});
