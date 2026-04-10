import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { config as loadDotEnv } from 'dotenv';

export const AGENTOS_ROOT = resolve(import.meta.dirname, '../..');

for (const envPath of [
  resolve(AGENTOS_ROOT, '.env'),
  resolve(AGENTOS_ROOT, 'backend/.env'),
]) {
  if (existsSync(envPath)) {
    loadDotEnv({ path: envPath });
  }
}

export const agentOsConfig = {
  rootPath: AGENTOS_ROOT,
  port: Number(process.env.PORT ?? '3011'),
  runtimeRoot: resolve(process.env.AGENTOS_RUNTIME_ROOT ?? resolve(AGENTOS_ROOT, 'runtime')),
  graphifyRepoPath: process.env.GRAPHIFY_REPO_PATH,
  graphifyPythonBin: process.env.GRAPHIFY_PYTHON_BIN,
  graphifyBuildCommand: process.env.AGENTOS_GRAPHIFY_BUILD_COMMAND,
  legacyGraphifyWorkspacePath: process.env.AGENTOS_LEGACY_GRAPHIFY_WORKSPACE_PATH
    ?? resolve(AGENTOS_ROOT, '../graphify-workspace'),
};

export function resolveAgentOsPath(...segments: string[]) {
  return resolve(agentOsConfig.rootPath, ...segments);
}

export function resolveRuntimePath(...segments: string[]) {
  return resolve(agentOsConfig.runtimeRoot, ...segments);
}
