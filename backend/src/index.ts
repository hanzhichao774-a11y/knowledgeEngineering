import { readFileSync } from 'fs';
import { resolve } from 'path';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import websocket from '@fastify/websocket';
import fastifyStatic from '@fastify/static';
import { taskRoutes } from './routes/task.js';
import { chatRoutes } from './routes/chat.js';
import { graphRoutes } from './routes/graph.js';
import { uploadRoutes } from './routes/upload.js';
import { wsRoutes } from './websocket/handler.js';
import { initNeo4j } from './db/neo4j.js';

// Load .env file from backend root
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
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
  console.log('.env loaded');
} catch {
  // .env file not found — rely on environment variables
}

const isMock = process.argv.includes('--mock');

const app = Fastify({ logger: true });

async function start() {
  await app.register(cors, { origin: true });
  await app.register(multipart, { limits: { fileSize: 50 * 1024 * 1024 } });
  await app.register(websocket);
  await app.register(fastifyStatic, {
    root: resolve(import.meta.dirname, '../../frontend/dist'),
    prefix: '/',
    decorateReply: false,
  });

  await app.register(taskRoutes, { prefix: '/api' });
  await app.register(chatRoutes, { prefix: '/api' });
  await app.register(graphRoutes, { prefix: '/api' });
  await app.register(uploadRoutes, { prefix: '/api' });
  await app.register(wsRoutes);

  initNeo4j();

  const port = Number(process.env.PORT) || 3001;
  await app.listen({ port, host: '0.0.0.0' });
  console.log(`BizAgentOS Backend running on http://localhost:${port}`);
  if (isMock) console.log('Mock mode enabled');
}

start().catch((err) => {
  app.log.error(err);
  process.exit(1);
});

export { app, isMock };
