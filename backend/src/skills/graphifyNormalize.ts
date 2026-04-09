import type { ExecutionContext, SkillResult } from '../agents/types.js';
import { getGraphifyBridge } from '../services/GraphifyBridge.js';
import { getWorkspaceManager } from '../services/WorkspaceManager.js';
import { writeFileSync } from 'node:fs';
import path from 'node:path';

const bridge = getGraphifyBridge();

export async function graphifyNormalizeSkill(ctx: ExecutionContext): Promise<SkillResult> {
  const startTime = Date.now();
  const ws = getWorkspaceManager();

  try {
    if (!ctx.filePath) {
      return {
        skillName: '文档规范化',
        status: 'error',
        data: { error: '没有上传文件' },
        tokenUsed: 0,
        duration: (Date.now() - startTime) / 1000,
      };
    }

    const rawPath = ws.copyToRaw(ctx.filePath);
    const isIncremental = ws.isIncremental();

    let detection;
    let normalizedFiles: string[] = [];
    let newFileCount = 0;

    if (isIncremental) {
      const incremental = await bridge.detectIncremental(ws.workspacePath);

      if (incremental.new_total === 0) {
        return {
          skillName: '文档规范化',
          status: 'success',
          data: {
            detection: incremental,
            isIncremental: true,
            skipRemaining: true,
            message: '没有新文件需要处理，知识库已是最新',
          },
          tokenUsed: 0,
          duration: (Date.now() - startTime) / 1000,
        };
      }

      detection = incremental;
      newFileCount = incremental.new_total;

      const allNewFiles = Object.values(incremental.new_files ?? {}).flat();
      if (allNewFiles.length > 0) {
        const result = await bridge.normalize(allNewFiles, ws.workspacePath);
        normalizedFiles = result.normalizedFiles;
      }
    } else {
      detection = await bridge.detect(ws.workspacePath);

      writeFileSync(
        path.join(ws.workspacePath, '.graphify_detect.json'),
        JSON.stringify(detection),
      );

      if (detection.total_files === 0) {
        return {
          skillName: '文档规范化',
          status: 'error',
          data: { error: '未找到支持的文件' },
          tokenUsed: 0,
          duration: (Date.now() - startTime) / 1000,
        };
      }

      if (detection.total_words > 2_000_000 || detection.total_files > 200) {
        ctx.onProgress({
          agentId: 'KE-01',
          role: 'worker',
          content: `⚠️ 大规模语料：${detection.total_files} 个文件，约 ${Math.round(detection.total_words / 1000)}K 词`,
          timestamp: new Date().toISOString(),
        });
      }

      const allFiles = Object.values(detection.files).flat();
      if (allFiles.length > 0) {
        const result = await bridge.normalize(allFiles, ws.workspacePath);
        normalizedFiles = result.normalizedFiles;
      }
      newFileCount = detection.total_files;
    }

    const fileSummary = Object.entries(detection.files)
      .filter(([, files]) => files.length > 0)
      .map(([type, files]) => `${type}: ${files.length}`)
      .join(', ');

    ctx.onProgress({
      agentId: 'KE-01',
      role: 'worker',
      content: `${isIncremental ? '增量' : '全量'}规范化完成：${fileSummary}，生成 ${normalizedFiles.length} 个 sidecar`,
      timestamp: new Date().toISOString(),
    });

    return {
      skillName: '文档规范化',
      status: 'success',
      data: {
        detection,
        isIncremental,
        normalizedFiles,
        newFileCount,
        rawPath,
      },
      tokenUsed: 0,
      duration: (Date.now() - startTime) / 1000,
    };
  } catch (err) {
    return {
      skillName: '文档规范化',
      status: 'error',
      data: { error: (err as Error).message },
      tokenUsed: 0,
      duration: (Date.now() - startTime) / 1000,
    };
  }
}
