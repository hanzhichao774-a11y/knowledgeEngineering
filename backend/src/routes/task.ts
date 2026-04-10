import type { FastifyPluginAsync } from 'fastify';
import { TaskService } from '../services/TaskService.js';

interface TaskRouteOptions {
  taskService: TaskService;
}

export const taskRoutes: FastifyPluginAsync<TaskRouteOptions> = async (app, options) => {
  const svc = options.taskService;

  app.get('/tasks', async () => {
    return svc.listTasks();
  });

  app.get<{ Params: { id: string } }>('/tasks/:id', async (req) => {
    const task = svc.getTask(req.params.id);
    if (!task) return { error: 'Task not found' };
    return task;
  });

  app.post<{ Body: { title: string; description?: string; fileId?: string; fileIds?: string[] } }>(
    '/tasks',
    async (req) => {
      const { title, description, fileId, fileIds } = req.body;
      const resolvedIds = fileIds ?? (fileId ? [fileId] : undefined);
      const task = await svc.createTask(title, description, resolvedIds);
      return task;
    }
  );

  app.get<{ Params: { id: string } }>('/tasks/:id/result', async (req) => {
    const result = svc.getTaskResult(req.params.id);
    if (!result) return { error: 'No result available' };
    return result;
  });
};
