import type { FastifyPluginAsync } from 'fastify';
import { randomUUID } from 'crypto';
import { writeFile, mkdir } from 'fs/promises';
import { resolve } from 'path';

const UPLOAD_DIR = resolve(import.meta.dirname, '../../uploads');

export const uploadRoutes: FastifyPluginAsync = async (app) => {
  app.post('/upload', async (req) => {
    const file = await req.file();
    if (!file) return { error: 'No file uploaded' };

    await mkdir(UPLOAD_DIR, { recursive: true });
    const fileId = randomUUID();
    const ext = file.filename.split('.').pop() || 'bin';
    const filePath = resolve(UPLOAD_DIR, `${fileId}.${ext}`);
    const buffer = await file.toBuffer();
    await writeFile(filePath, buffer);

    return {
      fileId,
      filename: file.filename,
      size: buffer.length,
      mimetype: file.mimetype,
    };
  });
};
