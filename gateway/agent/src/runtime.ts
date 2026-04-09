import { createAgent } from '@codeany/open-agent-sdk';
import type {
  AnswerGenerateRequest,
  GatewayAnswerData,
  GatewayAnswerSection,
  GatewayCitationDetail,
  GatewayHealthData,
  GatewayMeta,
  GatewayUsage,
  IntentClassifyRequest,
  SkillRunRequest,
} from './contracts.js';
import { extractJSON } from './json.js';
import {
  ANSWER_GENERATE_SYSTEM_PROMPT,
  ANSWER_GENERATE_STRUCTURED_SYSTEM_PROMPT,
  DOCUMENT_PARSE_SUMMARY_SYSTEM_PROMPT,
  INTENT_CLASSIFY_SYSTEM_PROMPT,
  ONTOLOGY_EXTRACT_SYSTEM_PROMPT,
  SCHEMA_BUILD_SYSTEM_PROMPT,
} from './prompts.js';

export interface GatewayRuntimeResult<T> {
  data: T;
  usage: GatewayUsage;
  meta: GatewayMeta;
}

export interface GatewayRuntime {
  classifyIntent(input: IntentClassifyRequest): Promise<GatewayRuntimeResult<{ intent: 'ingest' | 'query'; reason: string }>>;
  runSkill(input: SkillRunRequest): Promise<GatewayRuntimeResult<{ skillName: string; status: 'success'; result: Record<string, unknown> }>>;
  generateAnswer(input: AnswerGenerateRequest): Promise<GatewayRuntimeResult<GatewayAnswerData>>;
  health(): Promise<GatewayHealthData>;
}

interface AgentCallResult {
  text: string;
  usage: GatewayUsage;
  meta: GatewayMeta;
}

interface GatewayModelConfig {
  provider: string;
  apiType: 'anthropic-messages' | 'openai-completions';
  apiKey?: string;
  baseURL?: string;
  model: string;
  maxRetries: number;
}

export const AVAILABLE_GATEWAY_SKILLS = [
  'document-parse-summary',
  'ontology-extract',
  'schema-build',
  'answer-generate',
] as const;

class GatewayRuntimeError extends Error {
  readonly code: string;
  readonly retryable: boolean;
  readonly statusCode: number;
  readonly details: Record<string, unknown>;

  constructor(
    code: string,
    message: string,
    options: {
      retryable?: boolean;
      statusCode?: number;
      details?: Record<string, unknown>;
    } = {},
  ) {
    super(message);
    this.name = 'GatewayRuntimeError';
    this.code = code;
    this.retryable = options.retryable ?? false;
    this.statusCode = options.statusCode ?? 500;
    this.details = options.details ?? {};
  }
}

function detectProviderName(): string {
  if (process.env.GATEWAY_PROVIDER) return process.env.GATEWAY_PROVIDER;
  if (process.env.MINIMAX_API_KEY) return 'minimax';
  if (process.env.CODEANY_API_KEY) return 'codeany';
  if (process.env.OPENAI_API_KEY) return 'openai';
  return 'anthropic-compatible';
}

function getModelConfig(): GatewayModelConfig {
  return {
    provider: detectProviderName(),
    apiType: (process.env.GATEWAY_API_TYPE as 'anthropic-messages' | 'openai-completions') ?? 'anthropic-messages',
    apiKey: process.env.CODEANY_API_KEY ?? process.env.MINIMAX_API_KEY ?? process.env.OPENAI_API_KEY,
    baseURL: process.env.CODEANY_BASE_URL ?? process.env.MINIMAX_BASE_URL ?? 'https://api.minimaxi.com/anthropic',
    model: process.env.CODEANY_MODEL ?? process.env.GATEWAY_MODEL ?? 'MiniMax-M2.7',
    maxRetries: Number(process.env.GATEWAY_MAX_RETRIES ?? 1),
  };
}

export class OpenAgentGatewayRuntime implements GatewayRuntime {
  private readonly config = getModelConfig();

  async classifyIntent(input: IntentClassifyRequest): Promise<GatewayRuntimeResult<{ intent: 'ingest' | 'query'; reason: string }>> {
    const userPrompt = input.query || '';
    const result = await this.runText(INTENT_CLASSIFY_SYSTEM_PROMPT, userPrompt);
    const raw = result.text.trim().toLowerCase();
    const intent = raw.includes('ingest') ? 'ingest' : 'query';
    return {
      data: {
        intent,
        reason: intent === 'ingest' ? '模型判断该任务更接近知识入库。' : '模型判断该任务更接近知识查询。',
      },
      usage: result.usage,
      meta: result.meta,
    };
  }

  async runSkill(input: SkillRunRequest): Promise<GatewayRuntimeResult<{ skillName: string; status: 'success'; result: Record<string, unknown> }>> {
    let result: AgentCallResult;
    let payload: Record<string, unknown>;

    switch (input.skillName) {
      case 'document-parse-summary': {
        const documentText = String(input.input.documentText ?? '');
        result = await this.runText(
          DOCUMENT_PARSE_SUMMARY_SYSTEM_PROMPT,
          `请分析以下文档内容：\n\n${documentText.slice(0, 15000)}`,
        );
        payload = extractJSON<Record<string, unknown>>(result.text);
        break;
      }
      case 'ontology-extract': {
        const documentText = String(input.input.documentText ?? '');
        result = await this.runText(
          ONTOLOGY_EXTRACT_SYSTEM_PROMPT,
          `以下是文档原始内容，请提取完整的本体知识（本体类、实体、关系、属性）。特别注意：表格中的每一行数据都要逐行提取，不要只提取汇总值。\n\n${documentText}`,
        );
        payload = extractJSON<Record<string, unknown>>(result.text);
        break;
      }
      case 'schema-build': {
        result = await this.runText(
          SCHEMA_BUILD_SYSTEM_PROMPT,
          `本体提取结果：\n${JSON.stringify(input.input.ontologyData ?? {}, null, 2)}\n\n请据此构建 RDF Schema。`,
        );
        payload = {
          schema: result.text.replace(/```[\w]*\n?/g, '').trim(),
        };
        break;
      }
      case 'answer-generate': {
        const answerResult = await this.generateAnswer({
          ...input,
          question: String(input.input.question ?? ''),
          retrievalContext: (input.input.retrievalContext as Record<string, unknown> | undefined) ?? {},
          outputMode: (input.input.outputMode as AnswerGenerateRequest['outputMode'] | undefined) ?? 'text',
        });
        return {
          data: {
            skillName: input.skillName,
            status: 'success',
            result: {
              answer: answerResult.data.answer,
              citations: answerResult.data.citations,
              ...(answerResult.data.sections ? { sections: answerResult.data.sections } : {}),
              ...(answerResult.data.citationDetails ? { citationDetails: answerResult.data.citationDetails } : {}),
            },
          },
          usage: answerResult.usage,
          meta: answerResult.meta,
        };
      }
      default:
        throw new GatewayRuntimeError(
          'SKILL_NOT_FOUND',
          `Unsupported gateway skill: ${input.skillName}`,
          {
            statusCode: 404,
            details: {
              availableSkills: [...AVAILABLE_GATEWAY_SKILLS],
            },
          },
        );
    }

    return {
      data: {
        skillName: input.skillName,
        status: 'success',
        result: payload,
      },
      usage: result.usage,
      meta: result.meta,
    };
  }

  async generateAnswer(input: AnswerGenerateRequest): Promise<GatewayRuntimeResult<GatewayAnswerData>> {
    const outputMode = input.outputMode ?? 'text';
    if (outputMode === 'structured' || outputMode === 'artifact-draft') {
      return this.generateStructuredAnswer(input, outputMode);
    }

    const result = await this.runText(ANSWER_GENERATE_SYSTEM_PROMPT, buildAnswerUserPrompt(input));
    const citationDetails = buildCitationDetails(input.retrievalContext);
    return {
      data: {
        answer: result.text.trim(),
        citations: uniqueStrings(citationDetails.map((item) => item.source)),
        citationDetails,
      },
      usage: result.usage,
      meta: result.meta,
    };
  }

  async health(): Promise<GatewayHealthData> {
    return {
      ok: true,
      status: 'ok',
      providerStatus: this.config.apiKey ? 'configured' : 'missing_api_key',
      provider: this.config.provider,
      model: this.config.model,
      skillCount: AVAILABLE_GATEWAY_SKILLS.length,
      providers: [
        {
          name: this.config.provider,
          configured: Boolean(this.config.apiKey),
        },
      ],
      skills: [...AVAILABLE_GATEWAY_SKILLS],
    };
  }

  private async runText(systemPrompt: string, userPrompt: string): Promise<AgentCallResult> {
    if (!this.config.apiKey) {
      throw new GatewayRuntimeError(
        'PROVIDER_NOT_CONFIGURED',
        'Gateway provider API key is not configured',
        { statusCode: 503, retryable: false },
      );
    }

    let attempt = 0;
    let lastError: unknown = null;

    while (attempt <= this.config.maxRetries) {
      const startedAt = Date.now();
      try {
        const agent = createAgent({
          apiType: this.config.apiType,
          apiKey: this.config.apiKey,
          baseURL: this.config.baseURL,
          model: this.config.model,
          maxTurns: 1,
          permissionMode: 'bypassPermissions',
          tools: [],
        });
        const response = await agent.prompt(userPrompt, {
          systemPrompt,
          permissionMode: 'bypassPermissions',
          tools: [],
          maxTurns: 1,
        });
        await agent.close();

        const inputTokens = response.usage.input_tokens ?? 0;
        const outputTokens = response.usage.output_tokens ?? 0;
        const text = response.text.trim();
        if (!text) {
          throw new GatewayRuntimeError(
            'PROVIDER_EMPTY_RESPONSE',
            'Gateway LLM returned an empty response',
            { retryable: true, statusCode: 502 },
          );
        }

        return {
          text,
          usage: {
            provider: this.config.provider,
            model: this.config.model,
            inputTokens,
            outputTokens,
            totalTokens: inputTokens + outputTokens,
            latencyMs: Date.now() - startedAt,
          },
          meta: {
            retryCount: attempt,
            fallbackUsed: false,
          },
        };
      } catch (error) {
        lastError = normalizeRuntimeError(error);
        if (attempt >= this.config.maxRetries) break;
      }
      attempt += 1;
    }

    throw normalizeRuntimeError(lastError);
  }

  private async generateStructuredAnswer(
    input: AnswerGenerateRequest,
    outputMode: 'structured' | 'artifact-draft',
  ): Promise<GatewayRuntimeResult<GatewayAnswerData>> {
    const result = await this.runText(
      ANSWER_GENERATE_STRUCTURED_SYSTEM_PROMPT,
      `${buildAnswerUserPrompt(input)}\n\n输出模式：${outputMode}`,
    );

    const payload = extractJSON<Record<string, unknown>>(result.text);
    const citationDetails = normalizeCitationDetails(payload.citationDetails ?? payload.citations, input.retrievalContext);
    const sections = normalizeSections(payload.sections, outputMode);
    const answer = String(payload.answer ?? '').trim();

    if (!answer) {
      throw new GatewayRuntimeError(
        'VALIDATION_ERROR',
        'Structured answer payload is missing the answer field',
        { statusCode: 502, retryable: false },
      );
    }

    return {
      data: {
        answer,
        citations: uniqueStrings(citationDetails.map((item) => item.source)),
        citationDetails,
        sections,
      },
      usage: result.usage,
      meta: result.meta,
    };
  }
}

function buildAnswerUserPrompt(input: AnswerGenerateRequest): string {
  return `用户问题：${input.question}\n\n知识上下文：\n${JSON.stringify(input.retrievalContext, null, 2)}`;
}

function collectCitations(retrievalContext: Record<string, unknown>): string[] {
  const citations = new Set<string>();
  const graphifySources = retrievalContext.graphifySources;
  if (Array.isArray(graphifySources)) {
    for (const source of graphifySources) {
      if (typeof source === 'string' && source) citations.add(source);
    }
  }

  const recordResults = retrievalContext.recordResults;
  if (Array.isArray(recordResults)) {
    for (const record of recordResults) {
      if (record && typeof record === 'object') {
        const sourceFile = (record as Record<string, unknown>).source_file;
        if (typeof sourceFile === 'string' && sourceFile) citations.add(sourceFile);
      }
    }
  }

  return Array.from(citations);
}

function buildCitationDetails(retrievalContext: Record<string, unknown>): GatewayCitationDetail[] {
  const details = new Map<string, GatewayCitationDetail>();

  for (const source of collectCitations(retrievalContext)) {
    details.set(source, { source });
  }

  const recordResults = retrievalContext.recordResults;
  if (Array.isArray(recordResults)) {
    for (const record of recordResults) {
      if (!record || typeof record !== 'object') continue;
      const sourceFile = (record as Record<string, unknown>).source_file;
      if (typeof sourceFile !== 'string' || !sourceFile) continue;
      const location = (record as Record<string, unknown>).location;
      details.set(sourceFile, {
        source: sourceFile,
        ...(typeof location === 'string' && location ? { location } : {}),
      });
    }
  }

  return Array.from(details.values());
}

function normalizeCitationDetails(
  value: unknown,
  retrievalContext: Record<string, unknown>,
): GatewayCitationDetail[] {
  const fallback = buildCitationDetails(retrievalContext);
  if (!Array.isArray(value)) {
    return fallback;
  }

  const normalized: GatewayCitationDetail[] = [];
  for (const item of value) {
    if (typeof item === 'string' && item) {
      normalized.push({ source: item });
      continue;
    }
    if (!item || typeof item !== 'object') continue;
    const source = (item as Record<string, unknown>).source;
    const location = (item as Record<string, unknown>).location;
    if (typeof source !== 'string' || !source) continue;
    normalized.push({
      source,
      ...(typeof location === 'string' && location ? { location } : {}),
    });
  }

  const merged = [...normalized, ...fallback];
  const deduped = new Map<string, GatewayCitationDetail>();
  for (const item of merged) {
    const existing = deduped.get(item.source);
    deduped.set(item.source, existing?.location ? existing : item);
  }
  return Array.from(deduped.values());
}

function normalizeSections(
  value: unknown,
  outputMode: 'structured' | 'artifact-draft',
): GatewayAnswerSection[] {
  if (!Array.isArray(value)) {
    return outputMode === 'artifact-draft'
      ? [{ type: 'artifact-draft', title: '草稿', content: '已生成 artifact draft 结果。' }]
      : [];
  }

  const sections: GatewayAnswerSection[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const raw = item as Record<string, unknown>;
    const type = typeof raw.type === 'string' && raw.type ? raw.type : 'summary';
    const title = typeof raw.title === 'string' && raw.title ? raw.title : '内容';
    const content = Array.isArray(raw.content)
      ? raw.content.filter((entry): entry is string => typeof entry === 'string')
      : String(raw.content ?? '').trim();
    if ((typeof content === 'string' && !content) || (Array.isArray(content) && content.length === 0)) {
      continue;
    }
    sections.push({ type, title, content });
  }
  return sections;
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function normalizeRuntimeError(error: unknown): GatewayRuntimeError {
  if (error instanceof GatewayRuntimeError) {
    return error;
  }
  if (error instanceof Error) {
    return new GatewayRuntimeError(
      'PROVIDER_ERROR',
      error.message,
      { statusCode: 502, retryable: true },
    );
  }
  return new GatewayRuntimeError(
    'INTERNAL_ERROR',
    'Gateway LLM request failed',
    { statusCode: 500, retryable: false },
  );
}
