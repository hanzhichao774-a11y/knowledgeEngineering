import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import websocket from '@fastify/websocket';
import fastifyStatic from '@fastify/static';
import { taskRoutes } from './routes/task.js';
import { chatRoutes } from './routes/chat.js';
import { graphRoutes } from './routes/graph.js';
import { graphifyPlaygroundRoutes } from './routes/graphifyPlayground.js';
import { uploadRoutes } from './routes/upload.js';
import { reportRoutes } from './routes/report.js';
import { wsRoutes } from './websocket/handler.js';
import { initNeo4j } from './db/neo4j.js';
import { TaskService } from './services/TaskService.js';
import { GatewayClient, type GatewayClientLike } from './clients/GatewayClient.js';
import { GraphifyClient, type GraphifyClientLike } from './clients/GraphifyClient.js';

let envLoaded = false;

export interface BackendAppOptions {
  gatewayClient?: GatewayClientLike;
  graphifyClient?: GraphifyClientLike;
  taskService?: TaskService;
  initializeNeo4j?: boolean;
}

export function loadBackendEnv(): void {
  if (envLoaded) return;

  try {
    const envPath = resolve(import.meta.dirname, '../.env');
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
    // .env file not found — rely on environment variables.
  }

  envLoaded = true;
}

export async function buildApp(options: BackendAppOptions = {}): Promise<FastifyInstance> {
  loadBackendEnv();

  const app = Fastify({ logger: true });
  const gatewayClient = options.gatewayClient ?? new GatewayClient();
  const graphifyClient = options.graphifyClient ?? new GraphifyClient();
  const taskService = options.taskService ?? new TaskService({
    gatewayClient,
    graphifyClient,
    workspaceId: 'default',
  });

  await app.register(cors, { origin: true });
  await app.register(multipart, { limits: { fileSize: 50 * 1024 * 1024 } });
  await app.register(websocket);
  const frontendDist = resolve(import.meta.dirname, '../../frontend/dist');
  if (existsSync(frontendDist)) {
    await app.register(fastifyStatic, {
      root: frontendDist,
      prefix: '/',
      decorateReply: false,
    });
  }

  await app.register(taskRoutes, { prefix: '/api', taskService });
  await app.register(chatRoutes, { prefix: '/api' });
  await app.register(graphRoutes, { prefix: '/api' });
  await app.register(graphifyPlaygroundRoutes, { prefix: '/api', gatewayClient, graphifyClient });
  await app.register(uploadRoutes, { prefix: '/api' });
  await app.register(reportRoutes, { prefix: '/api' });
  await app.register(wsRoutes);

  if (options.initializeNeo4j !== false) {
    initNeo4j();
  }

  return app;
}
