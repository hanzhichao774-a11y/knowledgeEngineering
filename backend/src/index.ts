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
import { resolve } from 'path';

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
