import test from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';
import type { GatewayClientLike } from '../src/clients/GatewayClient.js';
import type { GraphifyClientLike } from '../src/clients/GraphifyClient.js';

test('backend query flow returns an answer via gateway + graphify clients', async () => {
  const gatewayClient: GatewayClientLike = {
    async classifyIntent() {
      return {
        intent: 'query',
        reason: 'stubbed query intent',
        usage: {
          provider: 'stub',
          model: 'stub-model',
          inputTokens: 1,
          outputTokens: 1,
          totalTokens: 2,
          latencyMs: 1,
        },
        meta: {
          retryCount: 0,
          fallbackUsed: false,
        },
      };
    },
    async runSkill() {
      throw new Error('runSkill is not expected in query smoke');
    },
    async generateAnswer(input) {
      assert.equal(input.question, '访问控制有什么要求？');
      assert.equal(input.retrievalContext.source, 'graphify');
      return {
        answer: '## 结论\n\n知识库显示访问控制需要按角色分配权限。',
        citations: ['doc/access-control.md'],
        usage: {
          provider: 'stub',
          model: 'stub-model',
          inputTokens: 12,
          outputTokens: 6,
          totalTokens: 18,
          latencyMs: 1,
        },
        meta: {
          retryCount: 0,
          fallbackUsed: false,
        },
      };
    },
    async healthCheck() {
      return {
        ok: true,
        providerStatus: 'configured',
        provider: 'stub',
        model: 'stub-model',
        skillCount: 4,
      };
    },
  };

  const graphifyClient: GraphifyClientLike = {
    async ask() {
      return {
        ok: true,
        snapshotId: 'snapshot-1',
        freshness: {
          status: 'fresh',
          updatedAt: '2026-04-09T00:00:00Z',
        },
        answer: {
          question: '访问控制有什么要求？',
          records: [
            {
              label: '访问控制策略',
              source_file: 'doc/access-control.md',
            },
          ],
          nodes: [
            {
              label: '角色权限',
              source_file: 'doc/access-control.md',
            },
          ],
          sources: ['doc/access-control.md'],
        },
      };
    },
    async searchRecords() {
      return {
        ok: true,
        snapshotId: 'snapshot-1',
        records: [
          {
            label: '访问控制策略',
            source_file: 'doc/access-control.md',
            record_json: {
              requirement: '按角色分配权限',
            },
          },
        ],
      };
    },
    async getHealth() {
      return {
        ok: true,
        snapshotId: 'snapshot-1',
        health: {
          warnings: [],
        },
      };
    },
    async getSnapshotStatus() {
      return {
        ok: true,
        exists: true,
        snapshotId: 'snapshot-1',
        updatedAt: '2026-04-09T00:00:00Z',
        assetRoot: '/tmp/graphify-out',
        graphPath: '/tmp/graphify-out/graph.json',
        nodeCount: 2,
        edgeCount: 1,
        recordCount: 1,
        freshness: {
          status: 'fresh',
          updatedAt: '2026-04-09T00:00:00Z',
        },
      };
    },
    async rebuild() {
      return {
        ok: true,
        snapshotId: 'snapshot-1',
        assetRoot: '/tmp/graphify-out',
        graphPath: '/tmp/graphify-out/graph.json',
        nodeCount: 2,
        edgeCount: 1,
        recordCount: 1,
        updatedAt: '2026-04-09T00:00:00Z',
      };
    },
  };

  const app = await buildApp({
    gatewayClient,
    graphifyClient,
    initializeNeo4j: false,
  });

  const createResponse = await app.inject({
    method: 'POST',
    url: '/api/tasks',
    payload: {
      title: '访问控制有什么要求？',
    },
  });

  assert.equal(createResponse.statusCode, 200);
  const createdTask = createResponse.json();
  const taskId = createdTask.id as string;
  assert.ok(taskId);

  let status = createdTask.status as string;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const taskResponse = await app.inject({
      method: 'GET',
      url: `/api/tasks/${taskId}`,
    });
    const task = taskResponse.json();
    status = task.status as string;
    if (status === 'completed' || status === 'failed') break;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  assert.equal(status, 'completed');

  const resultResponse = await app.inject({
    method: 'GET',
    url: `/api/tasks/${taskId}/result`,
  });
  assert.equal(resultResponse.statusCode, 200);
  const result = resultResponse.json();
  assert.match(result.answer as string, /按角色分配权限/);
  assert.equal(result.answerMeta.source, 'graphify');
  assert.equal(result.answerMeta.snapshotId, 'snapshot-1');

  await app.close();
});
