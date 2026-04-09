export interface GatewayUsage {
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  latencyMs: number;
}

export interface GatewayMeta {
  retryCount: number;
  fallbackUsed: boolean;
}

export interface GatewayProviderInfo {
  name: string;
  configured: boolean;
}

export interface GatewayCitationDetail {
  source: string;
  location?: string;
}

export interface GatewayAnswerSection {
  type: string;
  title: string;
  content: string | string[];
}

export interface GatewaySuccess<T> {
  ok: true;
  traceId: string;
  taskId: string;
  data: T;
  usage: GatewayUsage;
  meta: GatewayMeta;
}

export interface GatewayFailure {
  ok: false;
  traceId: string;
  taskId: string;
  error: {
    code: string;
    message: string;
    retryable: boolean;
    details?: Record<string, unknown>;
  };
}

export type GatewayResponse<T> = GatewaySuccess<T> | GatewayFailure;

export interface RequestEnvelope {
  traceId?: string;
  taskId?: string;
  workspaceId?: string;
  requestedBy?: string;
}

export interface IntentClassifyRequest extends RequestEnvelope {
  query: string;
  hasFile?: boolean;
  context?: Record<string, unknown>;
}

export interface SkillRunRequest extends RequestEnvelope {
  skillName: string;
  input: Record<string, unknown>;
  context?: Record<string, unknown>;
}

export interface AnswerGenerateRequest extends RequestEnvelope {
  question: string;
  retrievalContext: Record<string, unknown>;
  outputMode?: 'text' | 'structured' | 'artifact-draft';
  context?: Record<string, unknown>;
}

export interface GatewayHealthData {
  ok: boolean;
  status: 'ok';
  providerStatus: 'configured' | 'missing_api_key';
  provider: string;
  model: string;
  skillCount: number;
  providers: GatewayProviderInfo[];
  skills: string[];
}

export interface GatewayAnswerData {
  answer: string;
  citations: string[];
  sections?: GatewayAnswerSection[];
  citationDetails?: GatewayCitationDetail[];
}
