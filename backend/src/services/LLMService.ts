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

const MAX_RETRIES = 2;

export async function callLLM(systemPrompt: string, userPrompt: string): Promise<LLMResponse> {
  const p = getOrInitProvider();

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    console.log(`[LLM] Calling provider: ${p.getModel()}, configured: ${p.isConfigured()}${attempt > 0 ? ` (retry ${attempt})` : ''}`);

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
        if (attempt < MAX_RETRIES) {
          console.warn(`[LLM] Empty response, retrying (${attempt + 1}/${MAX_RETRIES})...`);
          await sleep(1000 * (attempt + 1));
          continue;
        }
        throw new Error('LLM returned empty response after retries');
      }
      return { text, usage: result.usage };
    } catch (err) {
      const elapsed = Date.now() - startTime;
      const msg = (err as Error).message;
      if (attempt < MAX_RETRIES && (msg.includes('empty response') || msg.includes('timeout') || msg.includes('ECONNRESET'))) {
        console.warn(`[LLM] FAILED in ${elapsed}ms: ${msg}, retrying (${attempt + 1}/${MAX_RETRIES})...`);
        await sleep(1000 * (attempt + 1));
        continue;
      }
      console.error(`[LLM] FAILED in ${elapsed}ms:`, msg);
      throw err;
    }
  }

  throw new Error('LLM call failed after all retries');
}

export function extractJSON<T = unknown>(text: string): T {
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  let raw = fenceMatch ? fenceMatch[1].trim() : text.trim();

  try {
    return JSON.parse(raw);
  } catch {
    // attempt repairs
  }

  raw = raw.replace(/,\s*([}\]])/g, '$1');

  raw = raw.replace(/([{,]\s*)(\w+)\s*:/g, '$1"$2":');

  try {
    return JSON.parse(raw);
  } catch {
    // try harder
  }

  const lastBrace = raw.lastIndexOf('}');
  const lastBracket = raw.lastIndexOf(']');
  if (lastBrace > 0 || lastBracket > 0) {
    const cutoff = Math.max(lastBrace, lastBracket) + 1;
    let truncated = raw.slice(0, cutoff);

    let braces = 0;
    let brackets = 0;
    for (const ch of truncated) {
      if (ch === '{') braces++;
      else if (ch === '}') braces--;
      else if (ch === '[') brackets++;
      else if (ch === ']') brackets--;
    }
    while (brackets > 0) { truncated += ']'; brackets--; }
    while (braces > 0) { truncated += '}'; braces--; }

    truncated = truncated.replace(/,\s*([}\]])/g, '$1');

    try {
      return JSON.parse(truncated);
    } catch {
      // give up
    }
  }

  console.error('[extractJSON] All repair attempts failed. Raw text (first 500 chars):', raw.slice(0, 500));
  throw new Error(`Failed to parse JSON from LLM response: ${raw.slice(0, 100)}...`);
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
