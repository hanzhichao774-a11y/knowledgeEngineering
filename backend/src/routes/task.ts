import type { FastifyPluginAsync } from 'fastify';
import { TaskService } from '../services/TaskService.js';

export const taskRoutes: FastifyPluginAsync = async (app) => {
  const svc = new TaskService();

  app.get('/tasks', async () => {
    return svc.listTasks();
  });

  app.get<{ Params: { id: string } }>('/tasks/:id', async (req) => {
    const task = svc.getTask(req.params.id);
    if (!task) return { error: 'Task not found' };
    return task;
  });

  app.post<{ Body: { title: string; description?: string; fileId?: string } }>(
    '/tasks',
    async (req) => {
      const { title, description, fileId } = req.body;
      const task = await svc.createTask(title, description, fileId);
      return task;
    }
  );

  app.get<{ Params: { id: string } }>('/tasks/:id/result', async (req) => {
    const result = svc.getTaskResult(req.params.id);
    if (!result) return { error: 'No result available' };
    return result;
  });
};
