export const EMBEDDING_DIMENSION = 1536;

const ENDPOINTS = [
  'https://api.minimaxi.com/v1/embeddings',
  'https://api.minimax.chat/v1/embeddings',
];

interface EmbeddingResponse {
  data: Array<{ embedding: number[]; index: number }>;
  model: string;
  usage: { total_tokens: number };
}

function getApiKey(): string {
  const key = process.env.MINIMAX_API_KEY ?? '';
  if (!key) throw new Error('MINIMAX_API_KEY not set — embedding calls will fail');
  return key;
}

function getGroupId(): string {
  return process.env.MINIMAX_GROUP_ID ?? '';
}

async function callEmbeddingAPI(texts: string[], type: 'db' | 'query'): Promise<number[][]> {
  const apiKey = getApiKey();
  const groupId = getGroupId();

  const body = {
    model: 'embo-01',
    texts,
    type,
  };

  console.log(`[Embedding] Calling MiniMax embo-01, type=${type}, texts=${texts.length}`);
  const startTime = Date.now();

  let lastError = '';
  for (const base of ENDPOINTS) {
    const url = groupId ? `${base}?GroupId=${groupId}` : base;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        lastError = await res.text().catch(() => `HTTP ${res.status}`);
        console.warn(`[Embedding] ${base} returned ${res.status}: ${lastError.slice(0, 100)}`);
        continue;
      }

      const json = (await res.json()) as EmbeddingResponse;

      if (json.data && json.data.length > 0) {
        const elapsed = Date.now() - startTime;
        console.log(`[Embedding] OK via ${base} in ${elapsed}ms, vectors=${json.data.length}, tokens=${json.usage?.total_tokens ?? '?'}`);
        return json.data
          .sort((a, b) => a.index - b.index)
          .map((d) => d.embedding);
      }

      lastError = 'Empty response data';
    } catch (fetchErr) {
      lastError = (fetchErr as Error).message;
      console.warn(`[Embedding] ${base} failed: ${lastError}`);
    }
  }

  const elapsed = Date.now() - startTime;
  console.error(`[Embedding] All endpoints failed in ${elapsed}ms: ${lastError.slice(0, 200)}`);
  throw new Error(`Embedding API error: ${lastError.slice(0, 100)}`);
}

/**
 * Generate embeddings for texts to store in the database.
 * Batches automatically if more than 20 texts.
 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const BATCH_SIZE = 20;
  const allEmbeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const embeddings = await callEmbeddingAPI(batch, 'db');
    allEmbeddings.push(...embeddings);
  }

  return allEmbeddings;
}

/**
 * Generate embedding for a single query text.
 */
export async function embedQuery(query: string): Promise<number[]> {
  const [embedding] = await callEmbeddingAPI([query], 'query');
  return embedding;
}
