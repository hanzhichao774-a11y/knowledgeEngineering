import type { FastifyPluginAsync } from 'fastify';
import { GraphService } from '../services/GraphService.js';
import { readGraphData, getKnowledgeStatus, isNeo4jConnected } from '../db/neo4j.js';

export const graphRoutes: FastifyPluginAsync = async (app) => {
  const svc = new GraphService();

  app.get<{ Params: { taskId: string } }>('/graph/:taskId', async (req) => {
    const data = await svc.getGraphData(req.params.taskId);
    if (!data) return { error: 'No graph data available' };
    return data;
  });

  app.get('/graph/neo4j/all', async () => {
    if (!isNeo4jConnected()) return { error: 'Neo4j not connected' };
    const data = await readGraphData(200);
    if (!data) return { error: 'Failed to read graph data' };
    return data;
  });

  app.get('/knowledge/status', async () => {
    if (!isNeo4jConnected()) {
      return { connected: false, nodeCount: 0, edgeCount: 0 };
    }
    const status = await getKnowledgeStatus();
    return {
      connected: true,
      nodeCount: status?.nodeCount ?? 0,
      edgeCount: status?.edgeCount ?? 0,
    };
  });
};
