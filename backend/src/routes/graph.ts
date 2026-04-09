import { readFileSync, existsSync } from 'node:fs';
import type { FastifyPluginAsync } from 'fastify';
import { GraphService } from '../services/GraphService.js';
import { readGraphData, getKnowledgeStatus, isNeo4jConnected, withSession } from '../db/neo4j.js';
import { getWorkspaceManager } from '../services/WorkspaceManager.js';

export const graphRoutes: FastifyPluginAsync = async (app) => {
  const svc = new GraphService();
  const ws = getWorkspaceManager();

  app.get<{ Params: { taskId: string } }>('/graph/:taskId', async (req) => {
    const data = await svc.getGraphData(req.params.taskId);
    if (!data) return { error: 'No graph data available' };
    return data;
  });

  app.get('/graph/global', async () => {
    if (!existsSync(ws.graphJsonPath)) {
      return { error: 'No global graph built yet' };
    }
    const raw = readFileSync(ws.graphJsonPath, 'utf-8');
    return JSON.parse(raw);
  });

  app.get('/graph/report', async () => {
    if (!existsSync(ws.graphReportPath)) {
      return { content: null };
    }
    return { content: readFileSync(ws.graphReportPath, 'utf-8') };
  });

  app.get('/graph/health-report', async () => {
    if (!existsSync(ws.healthReportPath)) {
      return { content: null };
    }
    return { content: readFileSync(ws.healthReportPath, 'utf-8') };
  });

  app.get('/graph/neo4j/all', async () => {
    if (!isNeo4jConnected()) return { error: 'Neo4j not connected' };
    const data = await readGraphData(200);
    if (!data) return { error: 'Failed to read graph data' };
    return data;
  });

  app.post('/neo4j/reset', async () => {
    if (!isNeo4jConnected()) {
      return { ok: false, error: 'Neo4j not connected' };
    }
    const result = await withSession(async (session) => {
      await session.run('MATCH (n) DETACH DELETE n');
      return { ok: true, message: 'All Neo4j data cleared' };
    });
    return result ?? { ok: false, error: 'Session error' };
  });

  app.get('/knowledge/status', async () => {
    const hasGraph = ws.hasExistingGraph();
    if (!isNeo4jConnected()) {
      return { connected: false, hasGraph, nodeCount: 0, edgeCount: 0 };
    }
    const status = await getKnowledgeStatus();
    return {
      connected: true,
      hasGraph,
      nodeCount: status?.nodeCount ?? 0,
      edgeCount: status?.edgeCount ?? 0,
    };
  });
};
