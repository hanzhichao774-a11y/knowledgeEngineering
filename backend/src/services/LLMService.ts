import { getProvider, type KodaXBaseProvider, type KodaXMessage, type KodaXTokenUsage } from '@kodax/ai';

let provider: KodaXBaseProvider | null = null;

function getOrInitProvider(): KodaXBaseProvider {
  if (!provider) {
    provider = getProvider('minimax-coding');
    if (!provider.isConfigured()) {
      console.warn('MINIMAX_API_KEY not set — LLM calls will fail. Set it in .env or environment.');
    }
  }
  return provider;
}

export interface LLMResponse {
  text: string;
  usage?: KodaXTokenUsage;
}

export async function callLLM(systemPrompt: string, userPrompt: string): Promise<LLMResponse> {
  const p = getOrInitProvider();
  const messages: KodaXMessage[] = [
    { role: 'user', content: userPrompt },
  ];

  const startTime = Date.now();
  const result = await p.stream(messages, [], systemPrompt, false);
  const elapsed = Date.now() - startTime;

  const text = result.textBlocks.map((b) => b.text).join('');

  console.log(`LLM call completed in ${elapsed}ms, tokens: ${result.usage?.totalTokens ?? 'unknown'}`);

  return { text, usage: result.usage };
}

export function extractJSON<T = unknown>(text: string): T {
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  const raw = fenceMatch ? fenceMatch[1].trim() : text.trim();
  return JSON.parse(raw);
}
