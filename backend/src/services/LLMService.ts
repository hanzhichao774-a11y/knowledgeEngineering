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
  console.log(`[LLM] Calling provider: ${p.getModel()}, configured: ${p.isConfigured()}`);

  const messages: KodaXMessage[] = [
    { role: 'user', content: userPrompt.slice(0, 200) + (userPrompt.length > 200 ? '...' : '') },
  ];

  const startTime = Date.now();
  try {
    const result = await p.stream(
      [{ role: 'user', content: userPrompt }],
      [],
      systemPrompt,
      false,
    );
    const elapsed = Date.now() - startTime;
    const text = result.textBlocks.map((b) => b.text).join('');
    console.log(`[LLM] OK in ${elapsed}ms, tokens: ${result.usage?.totalTokens ?? 'unknown'}, textBlocks: ${result.textBlocks.length}, text length: ${text.length}`);
    if (!text.trim()) {
      throw new Error('LLM returned empty response');
    }
    return { text, usage: result.usage };
  } catch (err) {
    const elapsed = Date.now() - startTime;
    console.error(`[LLM] FAILED in ${elapsed}ms:`, (err as Error).message);
    throw err;
  }
}

export function extractJSON<T = unknown>(text: string): T {
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  const raw = fenceMatch ? fenceMatch[1].trim() : text.trim();
  return JSON.parse(raw);
}
