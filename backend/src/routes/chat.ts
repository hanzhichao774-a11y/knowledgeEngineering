import type { FastifyPluginAsync } from 'fastify';

export const chatRoutes: FastifyPluginAsync = async (app) => {
  app.post<{ Body: { taskId: string; content: string } }>('/chat', async (req) => {
    const { taskId, content } = req.body;
    return {
      id: `msg-${Date.now()}`,
      role: 'user',
      content,
      taskId,
      timestamp: new Date().toISOString(),
    };
  });
};
