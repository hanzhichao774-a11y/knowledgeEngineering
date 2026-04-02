import type { FastifyPluginAsync } from 'fastify';
import type { WebSocket } from '@fastify/websocket';

const clients = new Set<WebSocket>();

export function broadcast(data: unknown) {
  const msg = JSON.stringify(data);
  for (const ws of clients) {
    if (ws.readyState === 1) {
      ws.send(msg);
    }
  }
}

export const wsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/ws', { websocket: true }, (socket) => {
    clients.add(socket);
    socket.send(JSON.stringify({ type: 'connected', timestamp: Date.now() }));

    socket.on('message', (raw: Buffer) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'ping') {
          socket.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
        }
      } catch {
        // ignore invalid JSON
      }
    });

    socket.on('close', () => {
      clients.delete(socket);
    });
  });
};
