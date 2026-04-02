import type { FastifyPluginAsync } from 'fastify';
import { GraphService } from '../services/GraphService.js';

export const graphRoutes: FastifyPluginAsync = async (app) => {
  const svc = new GraphService();

  app.get<{ Params: { taskId: string } }>('/graph/:taskId', async (req) => {
    const data = await svc.getGraphData(req.params.taskId);
    if (!data) return { error: 'No graph data available' };
    return data;
  });
};
