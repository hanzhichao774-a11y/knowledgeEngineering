import type { FastifyPluginAsync } from 'fastify';
import { mkdtempSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { getKodaXOrchestrator, type ExportReportData } from '../services/KodaXOrchestrator.js';

const CONTENT_TYPES: Record<string, string> = {
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pdf: 'application/pdf',
};

interface ExportBody {
  format: 'docx' | 'xlsx' | 'pdf';
  report: ExportReportData;
}

export const reportRoutes: FastifyPluginAsync = async (app) => {
  app.post<{ Body: ExportBody }>('/report/export', async (req, reply) => {
    const { format, report } = req.body;

    if (!format || !['docx', 'xlsx', 'pdf'].includes(format)) {
      return reply.code(400).send({ error: 'Invalid format. Use docx, xlsx, or pdf.' });
    }

    if (!report?.title || !report?.metrics) {
      return reply.code(400).send({ error: 'Missing report data.' });
    }

    const tmpDir = mkdtempSync(path.join(tmpdir(), 'ke-export-'));
    const outputPath = path.join(tmpDir, `report.${format}`);

    try {
      const orchestrator = getKodaXOrchestrator();
      const result = await orchestrator.runExport(format, report, outputPath);

      if (!result.success || !existsSync(result.filePath)) {
        return reply.code(500).send({ error: '文档生成失败，请稍后重试' });
      }

      const fileBuffer = readFileSync(result.filePath);
      const fileName = `${report.title}.${format}`;

      reply
        .header('Content-Type', CONTENT_TYPES[format])
        .header('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`)
        .header('Content-Length', fileBuffer.length)
        .send(fileBuffer);

      setTimeout(() => {
        try { rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
      }, 5000);
    } catch (error) {
      req.log.error(error, 'Report export failed');
      try { rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
      return reply.code(500).send({ error: '导出失败' });
    }
  });
};
