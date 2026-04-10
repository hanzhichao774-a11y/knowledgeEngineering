import { existsSync } from 'node:fs';
import { cp, readdir, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { agentOsConfig } from '../config.js';
import { defaultKnowledgeBaseState, type ProjectFileRecord } from '../data/projects.js';
import { GraphifyClient } from './graphifyClient.js';
import { ProjectStore } from './projectStore.js';

const LEGACY_PROJECT_ID = 'project-beijing-heating-agent-os';

export async function bootstrapRuntime(projectStore: ProjectStore) {
  await projectStore.ensureRuntimeLayout();
  await migrateLegacyBeijingProject(projectStore);
}

async function migrateLegacyBeijingProject(projectStore: ProjectStore) {
  if (await projectStore.projectExists(LEGACY_PROJECT_ID)) {
    return;
  }

  const legacyWorkspacePath = agentOsConfig.legacyGraphifyWorkspacePath;
  if (!legacyWorkspacePath || !existsSync(legacyWorkspacePath)) {
    return;
  }

  const createdProject = await projectStore.createProject({
    id: LEGACY_PROJECT_ID,
    name: '北京热力集团智能体建设',
    description: '围绕北京热力集团智能体建设方案建立独立项目目录，资料、知识资产和任务历史都收口在 AgentOS/runtime/projects 下。',
    focus: '项目资料入库、知识库构建与项目群聊问答',
    knowledgeBaseLabel: '热力简报（2026年2月8日-2月9日）',
    suggestedQuestions: [
      '2月8日0-24时北京市海淀分公司热力诉求总量详细信息是什么？',
      '大网水耗排名后三位的中心有哪些？',
      '当前知识库里记录了哪些影响供热工作的突发情况？',
    ],
  });

  if (!createdProject) {
    return;
  }

  const importedFiles: ProjectFileRecord[] = [];
  const legacyEntries = await readdir(legacyWorkspacePath, { withFileTypes: true });
  for (const entry of legacyEntries) {
    const entryPath = resolve(legacyWorkspacePath, entry.name);
    if (entry.name === 'graphify-out' && entry.isDirectory()) {
      await projectStore.importDirectory(LEGACY_PROJECT_ID, entryPath, 'graphify-out');
      continue;
    }

    if (entry.isFile() && entry.name !== '.DS_Store') {
      if (entry.name.startsWith('.graphify')) {
        await projectStore.copySupportFile(LEGACY_PROJECT_ID, entryPath);
        continue;
      }

      const sourceStats = await stat(entryPath);
      const storedName = `${sourceStats.mtime.toISOString().replace(/[:.]/g, '-')}-${entry.name}`;
      await cp(entryPath, resolve(projectStore.projectRawRoot(LEGACY_PROJECT_ID), storedName), { force: true });
      importedFiles.push({
        id: `seed-${entry.name}`,
        originalName: entry.name,
        storedName,
        mimeType: 'application/octet-stream',
        extension: entry.name.split('.').at(-1)?.toLowerCase() ?? 'file',
        sizeBytes: sourceStats.size,
        uploadedAt: sourceStats.mtime.toISOString(),
      });
    }
  }

  if (importedFiles.length > 0) {
    await projectStore.replaceFiles(LEGACY_PROJECT_ID, importedFiles);
  }

  const runtime = new GraphifyClient({
    workspacePath: projectStore.projectRoot(LEGACY_PROJECT_ID),
  });
  const snapshot = await runtime.getSnapshotStatus();
  const kbState = snapshot.exists
    ? {
      status: 'ready' as const,
      activeSnapshotId: snapshot.snapshotId,
      lastBuildAt: snapshot.updatedAt,
    }
    : defaultKnowledgeBaseState();
  await projectStore.setKnowledgeBaseState(LEGACY_PROJECT_ID, kbState);

  await projectStore.appendTask(LEGACY_PROJECT_ID, {
    type: 'project.migrated',
    status: 'completed',
    title: '历史项目已迁入 AgentOS runtime',
    message: `已将 legacy graphify 工作区迁移到 ${projectStore.projectRoot(LEGACY_PROJECT_ID)}。`,
    metadata: {
      legacyWorkspacePath,
    },
  });

  if (snapshot.exists) {
    await projectStore.appendTask(LEGACY_PROJECT_ID, {
      type: 'kb.migrated',
      status: 'completed',
      title: '知识快照已本地化',
      message: `已把北京热力项目的 graphify 资产迁入本地目录，当前 snapshot 为 ${snapshot.snapshotId}。`,
      metadata: {
        snapshotId: snapshot.snapshotId,
        recordCount: snapshot.recordCount,
        nodeCount: snapshot.nodeCount,
      },
    });
  }
}
