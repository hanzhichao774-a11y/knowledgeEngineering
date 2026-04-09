import Fastify from 'fastify';
import { projects } from './data/projects.js';

const server = Fastify({
  logger: true,
});

server.get('/health', async () => ({
  status: 'ok',
}));

server.get('/api/projects', async () => ({
  projects,
}));

const host = process.env.HOST ?? '0.0.0.0';
const port = Number(process.env.PORT ?? 3010);

const start = async () => {
  try {
    await server.listen({ host, port });
  } catch (error) {
    server.log.error(error);
    process.exit(1);
  }
};

void start();
