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

export interface ExecutionContext {
  taskId: string;
  fileId?: string;
  filePath?: string;
  previousResults: SkillResult[];
  onProgress: (msg: AgentMessage) => void;
  onStepComplete: (stepIndex: number, result: SkillResult) => void;
}
