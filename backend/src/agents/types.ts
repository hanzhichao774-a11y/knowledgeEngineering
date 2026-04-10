import type { GatewayClientLike } from '../clients/GatewayClient.js';
import type { GraphifyClientLike } from '../clients/GraphifyClient.js';

export interface AgentConfig {
  id: string;
  name: string;
  role: 'manager' | 'worker';
  description: string;
  skills: string[];
  model: string;
}

export interface AgentMessage {
  agentId: string;
  role: 'manager' | 'worker';
  content: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface SkillResult {
  skillName: string;
  status: 'success' | 'error';
  data: unknown;
  tokenUsed: number;
  duration: number;
}

export type TaskIntent = 'ingest' | 'query';

export interface AgentServices {
  gateway: GatewayClientLike;
  graphify: GraphifyClientLike;
}

export interface ExecutionContext {
  taskId: string;
  intent: TaskIntent;
  workspaceId: string;
  query?: string;
  fileId?: string;
  filePath?: string;
  fileIds?: string[];
  filePaths?: string[];
  previousResults: SkillResult[];
  services: AgentServices;
  onProgress: (msg: AgentMessage) => void;
  onStepComplete: (stepIndex: number, result: SkillResult) => void;
}
