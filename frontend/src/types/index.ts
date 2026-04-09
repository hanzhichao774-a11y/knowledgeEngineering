export interface CostInfo {
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number;
  elapsed: string;
}

export interface StepOutput {
  type: 'summary' | 'ontology' | 'schema' | 'graph' | 'text';
  data: unknown;
}

export interface Step {
  name: string;
  status: 'pending' | 'running' | 'done' | 'error' | 'skipped';
  skill: string;
  skillIcon: string;
  tokenUsed: number;
  tokenLimit: number;
  duration?: number;
  output?: StepOutput;
}

export interface Task {
  id: string;
  title: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  steps: Step[];
  cost: CostInfo;
  createdAt: string;
  icon: string;
}

export interface FileAttachment {
  name: string;
  size: string;
  pages?: number;
}

export interface AgentStatus {
  skill: string;
  skillIcon: string;
  tokenUsed: number;
  tokenLimit: number;
  status: 'running' | 'done' | 'error';
  duration?: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'manager' | 'worker' | 'system' | 'assistant';
  name: string;
  content: string;
  timestamp: string;
  agentStatus?: AgentStatus;
  attachment?: FileAttachment;
  thinking?: string;
  metadata?: Record<string, unknown>;
}

export interface OntologyClass {
  name: string;
  desc: string;
}

export interface OntologyEntity {
  name: string;
  class?: string;
  type?: string;
  desc: string;
}

export interface OntologyRelation {
  name: string;
  source: string;
  target: string;
  desc: string;
}

export interface OntologyAttribute {
  name: string;
  entity: string;
  value: string;
  desc: string;
}

export interface OntologyResult {
  classes?: OntologyClass[];
  entities?: OntologyEntity[];
  relations?: OntologyRelation[];
  attributes?: OntologyAttribute[];
  classCount?: number;
  entityCount?: number;
  relationCount?: number;
  ruleCount?: number;
  attrCount?: number;
}

export interface GraphNode {
  id: string;
  label: string;
  type: string;
}

export interface GraphEdge {
  source: string;
  target: string;
  label: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface SkillInfo {
  name: string;
  icon: string;
  status: 'active' | 'idle' | 'running' | 'done';
}

export interface AgentDetail {
  id: string;
  name: string;
  description: string;
  inputTokens: number;
  outputTokens: number;
  elapsed: string;
  currentStep: number;
  totalSteps: number;
  skills: SkillInfo[];
}

export type RightTab = 'result' | 'agent' | 'graph';

export type WSEvent =
  | { type: 'task.step.start'; taskId: string; stepIndex: number }
  | { type: 'task.step.progress'; taskId: string; stepIndex: number; progress: number; tokenUsed: number }
  | { type: 'task.step.complete'; taskId: string; stepIndex: number; output: StepOutput }
  | { type: 'task.complete'; taskId: string }
  | { type: 'agent.message'; message: ChatMessage }
  | { type: 'cost.update'; taskId: string; cost: CostInfo };
