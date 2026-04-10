import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { cp, mkdir, readFile, readdir, rename, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { agentOsConfig } from '../config.js';
import {
  buildProjectId,
  defaultKnowledgeBaseState,
  defaultSuggestedQuestions,
  deriveShortName,
  normalizeExtension,
  type KnowledgeBaseState,
  type KnowledgeBaseStateRecord,
  type ProjectFileRecord,
  type ProjectMetaRecord,
  type ProjectRecord,
  type ProjectTaskRecord,
  type ProjectTaskStatus,
} from '../data/projects.js';

interface CreateProjectInput {
  id?: string;
  name: string;
  description?: string;
  focus?: string;
  knowledgeBaseLabel?: string;
  suggestedQuestions?: string[];
}

interface SaveUploadedFileInput {
  originalName: string;
  mimeType: string;
  buffer: Buffer;
  uploadedAt?: string;
}

interface TaskInput {
  id?: string;
  type: string;
  status: ProjectTaskStatus;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

const PROJECTS_ROOT = resolve(agentOsConfig.runtimeRoot, 'projects');

async function ensureDirectory(dirPath: string) {
  await mkdir(dirPath, { recursive: true });
}

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  if (!existsSync(filePath)) return fallback;

  try {
    return JSON.parse(await readFile(filePath, 'utf-8')) as T;
  } catch {
    return fallback;
  }
}

async function writeJsonFile(filePath: string, value: unknown) {
  await ensureDirectory(resolve(filePath, '..'));
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf-8');
}

function sanitizeFileName(name: string) {
  return name.replace(/[^\p{L}\p{N}._-]+/gu, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '') || 'file';
}

function sortByUpdatedAtDesc<T extends { updatedAt?: string; uploadedAt?: string; createdAt?: string }>(items: T[]) {
  return [...items].sort((left, right) => {
    const leftTime = new Date(left.updatedAt ?? left.uploadedAt ?? left.createdAt ?? 0).getTime();
    const rightTime = new Date(right.updatedAt ?? right.uploadedAt ?? right.createdAt ?? 0).getTime();
    return rightTime - leftTime;
  });
}

export class ProjectStore {
  async ensureRuntimeLayout() {
    await ensureDirectory(PROJECTS_ROOT);
  }

  projectRoot(projectId: string) {
    return resolve(PROJECTS_ROOT, projectId);
  }

  projectRawRoot(projectId: string) {
    return resolve(this.projectRoot(projectId), 'raw');
  }

  projectGraphRoot(projectId: string) {
    return resolve(this.projectRoot(projectId), 'graphify-out');
  }

  projectMetaRoot(projectId: string) {
    return resolve(this.projectRoot(projectId), 'meta');
  }

  projectMetaPath(projectId: string) {
    return resolve(this.projectMetaRoot(projectId), 'project.json');
  }

  projectFilesPath(projectId: string) {
    return resolve(this.projectMetaRoot(projectId), 'files.json');
  }

  projectTasksPath(projectId: string) {
    return resolve(this.projectMetaRoot(projectId), 'tasks.json');
  }

  projectKbPath(projectId: string) {
    return resolve(this.projectMetaRoot(projectId), 'kb.json');
  }

  async projectExists(projectId: string) {
    return existsSync(this.projectMetaPath(projectId));
  }

  async ensureProjectLayout(projectId: string) {
    await Promise.all([
      ensureDirectory(this.projectRoot(projectId)),
      ensureDirectory(this.projectRawRoot(projectId)),
      ensureDirectory(this.projectGraphRoot(projectId)),
      ensureDirectory(this.projectMetaRoot(projectId)),
    ]);
  }

  async listProjectIds() {
    await this.ensureRuntimeLayout();
    const entries = await readdir(PROJECTS_ROOT, { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  }

  async listProjectRecords() {
    const projectIds = await this.listProjectIds();
    const records = await Promise.all(projectIds.map((projectId) => this.getProjectRecord(projectId)));
    return records
      .filter((record): record is ProjectRecord => record !== null)
      .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());
  }

  async getProjectRecord(projectId: string): Promise<ProjectRecord | null> {
    const meta = await readJsonFile<ProjectMetaRecord | null>(this.projectMetaPath(projectId), null);
    if (!meta) return null;

    const files = sortByUpdatedAtDesc(await readJsonFile<ProjectFileRecord[]>(this.projectFilesPath(projectId), []));
    const tasks = sortByUpdatedAtDesc(await readJsonFile<ProjectTaskRecord[]>(this.projectTasksPath(projectId), []));
    const kbState = await readJsonFile<KnowledgeBaseStateRecord>(this.projectKbPath(projectId), defaultKnowledgeBaseState());

    return {
      ...meta,
      files,
      tasks,
      kbState,
      projectRoot: this.projectRoot(projectId),
      workspacePath: this.projectRoot(projectId),
    };
  }

  async createProject(input: CreateProjectInput) {
    const now = new Date().toISOString();
    const projectId = input.id ?? buildProjectId(input.name);
    if (await this.projectExists(projectId)) {
      throw new Error(`Project ${projectId} already exists`);
    }

    await this.ensureProjectLayout(projectId);

    const meta: ProjectMetaRecord = {
      id: projectId,
      name: input.name.trim(),
      shortName: deriveShortName(input.name),
      description: input.description?.trim() || '项目知识库工作台，支持资料上传、知识构建、任务追踪与项目群聊。',
      focus: input.focus?.trim() || '项目知识库构建、问答与证据追踪',
      knowledgeBaseLabel: input.knowledgeBaseLabel?.trim() || `${input.name.trim()} 知识库`,
      suggestedQuestions: input.suggestedQuestions?.length ? input.suggestedQuestions : defaultSuggestedQuestions(input.name),
      createdAt: now,
      updatedAt: now,
    };

    await Promise.all([
      writeJsonFile(this.projectMetaPath(projectId), meta),
      writeJsonFile(this.projectFilesPath(projectId), []),
      writeJsonFile(this.projectTasksPath(projectId), []),
      writeJsonFile(this.projectKbPath(projectId), defaultKnowledgeBaseState()),
    ]);

    await this.appendTask(projectId, {
      type: 'project.created',
      status: 'completed',
      title: '项目已创建',
      message: `项目“${meta.name}”已建立本地 runtime 目录。`,
      createdAt: now,
      updatedAt: now,
      metadata: {
        projectId,
      },
    });

    return this.getProjectRecord(projectId);
  }

  async updateProjectMeta(projectId: string, patch: Partial<ProjectMetaRecord>) {
    const current = await this.getProjectRecord(projectId);
    if (!current) {
      throw new Error(`Project ${projectId} not found`);
    }

    const nextMeta: ProjectMetaRecord = {
      id: current.id,
      name: patch.name ?? current.name,
      shortName: patch.shortName ?? current.shortName,
      description: patch.description ?? current.description,
      focus: patch.focus ?? current.focus,
      knowledgeBaseLabel: patch.knowledgeBaseLabel ?? current.knowledgeBaseLabel,
      suggestedQuestions: patch.suggestedQuestions ?? current.suggestedQuestions,
      createdAt: current.createdAt,
      updatedAt: patch.updatedAt ?? new Date().toISOString(),
    };

    await writeJsonFile(this.projectMetaPath(projectId), nextMeta);
    return nextMeta;
  }

  async setKnowledgeBaseState(projectId: string, state: KnowledgeBaseStateRecord) {
    await writeJsonFile(this.projectKbPath(projectId), state);
  }

  async updateKnowledgeBaseState(projectId: string, patch: Partial<KnowledgeBaseStateRecord>) {
    const current = await readJsonFile<KnowledgeBaseStateRecord>(this.projectKbPath(projectId), defaultKnowledgeBaseState());
    const nextState: KnowledgeBaseStateRecord = {
      ...current,
      ...patch,
    };
    await this.setKnowledgeBaseState(projectId, nextState);
    return nextState;
  }

  async saveUploadedFile(projectId: string, input: SaveUploadedFileInput) {
    const project = await this.getProjectRecord(projectId);
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }

    const uploadedAt = input.uploadedAt ?? new Date().toISOString();
    const extension = normalizeExtension(input.originalName);
    const storedName = `${uploadedAt.replace(/[:.]/g, '-')}-${randomUUID()}-${sanitizeFileName(input.originalName)}`;
    const targetPath = resolve(this.projectRawRoot(projectId), storedName);
    await ensureDirectory(this.projectRawRoot(projectId));
    await writeFile(targetPath, input.buffer);

    const fileRecord: ProjectFileRecord = {
      id: randomUUID(),
      originalName: input.originalName,
      storedName,
      mimeType: input.mimeType || 'application/octet-stream',
      extension,
      sizeBytes: input.buffer.byteLength,
      uploadedAt,
    };

    const files = [fileRecord, ...project.files];
    await writeJsonFile(this.projectFilesPath(projectId), files);

    const nextKbStatus: KnowledgeBaseState = project.kbState.activeSnapshotId ? 'dirty' : 'empty';
    await this.updateKnowledgeBaseState(projectId, {
      status: nextKbStatus,
      dirtySince: uploadedAt,
      dirtyReason: `新增文件 ${input.originalName}`,
      lastError: undefined,
    });
    await this.updateProjectMeta(projectId, { updatedAt: uploadedAt });

    await this.appendTask(projectId, {
      type: 'file.uploaded',
      status: 'completed',
      title: '项目资料已上传',
      message: `文件“${input.originalName}”已写入项目 raw 目录，知识库状态已标记为 ${nextKbStatus}。`,
      createdAt: uploadedAt,
      updatedAt: uploadedAt,
      metadata: {
        fileId: fileRecord.id,
        storedName,
        sizeBytes: fileRecord.sizeBytes,
      },
    });

    return fileRecord;
  }

  async appendTask(projectId: string, input: TaskInput) {
    const tasks = await readJsonFile<ProjectTaskRecord[]>(this.projectTasksPath(projectId), []);
    const now = new Date().toISOString();
    const task: ProjectTaskRecord = {
      id: input.id ?? randomUUID(),
      type: input.type,
      status: input.status,
      title: input.title,
      message: input.message,
      metadata: input.metadata,
      createdAt: input.createdAt ?? now,
      updatedAt: input.updatedAt ?? now,
    };

    const nextTasks = sortByUpdatedAtDesc([task, ...tasks]);
    await writeJsonFile(this.projectTasksPath(projectId), nextTasks);
    return task;
  }

  async updateTask(projectId: string, taskId: string, patch: Partial<ProjectTaskRecord>) {
    const tasks = await readJsonFile<ProjectTaskRecord[]>(this.projectTasksPath(projectId), []);
    const nextTasks = tasks.map((task) => (
      task.id === taskId
        ? {
          ...task,
          ...patch,
          updatedAt: patch.updatedAt ?? new Date().toISOString(),
        }
        : task
    ));
    await writeJsonFile(this.projectTasksPath(projectId), sortByUpdatedAtDesc(nextTasks));
  }

  async replaceFiles(projectId: string, files: ProjectFileRecord[]) {
    await writeJsonFile(this.projectFilesPath(projectId), sortByUpdatedAtDesc(files));
  }

  async replaceTasks(projectId: string, tasks: ProjectTaskRecord[]) {
    await writeJsonFile(this.projectTasksPath(projectId), sortByUpdatedAtDesc(tasks));
  }

  async importDirectory(projectId: string, sourcePath: string, targetRelativePath: 'graphify-out' | 'raw') {
    const targetPath = targetRelativePath === 'graphify-out'
      ? this.projectGraphRoot(projectId)
      : this.projectRawRoot(projectId);

    await ensureDirectory(resolve(targetPath, '..'));
    await cp(sourcePath, targetPath, { recursive: true, force: true });
  }

  async copySupportFile(projectId: string, sourcePath: string) {
    const fileName = sourcePath.split('/').at(-1);
    if (!fileName) return;
    const targetPath = resolve(this.projectRoot(projectId), fileName);
    await ensureDirectory(this.projectRoot(projectId));
    await cp(sourcePath, targetPath, { force: true });
  }

  async moveTempFile(tempPath: string, projectId: string, originalName: string, mimeType: string) {
    const uploadedAt = new Date().toISOString();
    const storedName = `${uploadedAt.replace(/[:.]/g, '-')}-${randomUUID()}-${sanitizeFileName(originalName)}`;
    const targetPath = resolve(this.projectRawRoot(projectId), storedName);
    await ensureDirectory(this.projectRawRoot(projectId));
    await rename(tempPath, targetPath);
    const fileStats = await stat(targetPath);

    const record: ProjectFileRecord = {
      id: randomUUID(),
      originalName,
      storedName,
      mimeType,
      extension: normalizeExtension(originalName),
      sizeBytes: fileStats.size,
      uploadedAt,
    };

    const project = await this.getProjectRecord(projectId);
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }

    await writeJsonFile(this.projectFilesPath(projectId), [record, ...project.files]);
    await this.updateKnowledgeBaseState(projectId, {
      status: project.kbState.activeSnapshotId ? 'dirty' : 'empty',
      dirtySince: uploadedAt,
      dirtyReason: `新增文件 ${originalName}`,
      lastError: undefined,
    });
    await this.updateProjectMeta(projectId, { updatedAt: uploadedAt });

    await this.appendTask(projectId, {
      type: 'file.uploaded',
      status: 'completed',
      title: '项目资料已上传',
      message: `文件“${originalName}”已写入项目 raw 目录。`,
      createdAt: uploadedAt,
      updatedAt: uploadedAt,
      metadata: {
        fileId: record.id,
        storedName,
        sizeBytes: fileStats.size,
      },
    });

    return record;
  }
}
