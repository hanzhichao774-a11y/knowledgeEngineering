import { fromPath } from 'pdf2pic';
import { readFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { existsSync } from 'fs';

const MINIMAX_VL_ENDPOINTS = [
  'https://api.minimaxi.com/v1/text/chatcompletion_v2',
  'https://api.minimax.chat/v1/text/chatcompletion_v2',
  'https://api.minimax.io/v1/text/chatcompletion_v2',
];
const VISION_MODEL = 'MiniMax-M2.7';

const TABLE_EXTRACT_PROMPT = `请仔细查看这张图片，完整提取其中所有文字和表格内容。

**关键规则**：
- 如果图片中包含表格，你必须逐行逐列提取每一个单元格的值
- 表格用 Markdown 格式输出（用 | 分隔列），包含完整的表头和所有数据行
- 所有数字必须100%忠实于图片原文，不得修改、四舍五入或推测
- 非表格的文字内容也要提取
- 不要添加任何你自己的分析或总结，只输出图片中实际存在的内容
- 不要用代码块包裹输出

请现在开始提取：`;

function getApiKey(): string {
  const key = process.env.MINIMAX_API_KEY ?? '';
  if (!key) throw new Error('MINIMAX_API_KEY not set');
  return key;
}

interface VLResponse {
  choices?: Array<{
    message?: { content?: string; reasoning_content?: string };
    finish_reason?: string;
  }>;
  base_resp?: { status_code: number; status_msg: string };
  usage?: { total_tokens?: number; prompt_tokens?: number; completion_tokens?: number };
}

export async function pdfToImages(pdfPath: string): Promise<string[]> {
  const tmpDir = join(dirname(pdfPath), '.pdf-images');
  if (!existsSync(tmpDir)) {
    await mkdir(tmpDir, { recursive: true });
  }

  const convert = fromPath(pdfPath, {
    density: 200,
    saveFilename: 'page',
    savePath: tmpDir,
    format: 'png',
    width: 1600,
    height: 2200,
  });

  const base64Images: string[] = [];
  let pageNum = 1;

  while (true) {
    try {
      const result = await convert(pageNum, { responseType: 'base64' });
      if (result.base64) {
        base64Images.push(result.base64);
        console.log(`[VisionExtract] Converted page ${pageNum} to image`);
        pageNum++;
      } else {
        break;
      }
    } catch {
      break;
    }
  }

  console.log(`[VisionExtract] Total ${base64Images.length} pages converted`);
  return base64Images;
}

export async function extractPageWithVision(base64Image: string): Promise<string> {
  const apiKey = getApiKey();

  const body = {
    model: VISION_MODEL,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: TABLE_EXTRACT_PROMPT },
          {
            type: 'image_url',
            image_url: { url: `data:image/png;base64,${base64Image}` },
          },
        ],
      },
    ],
    max_tokens: 8192,
    temperature: 0.01,
  };

  const startTime = Date.now();
  let lastError = '';

  for (const endpoint of MINIMAX_VL_ENDPOINTS) {
    try {
      console.log(`[VisionExtract] Calling MiniMax-VL at ${endpoint}...`);

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        lastError = await res.text().catch(() => `HTTP ${res.status}`);
        console.warn(`[VisionExtract] ${endpoint} returned ${res.status}: ${lastError.slice(0, 100)}`);
        continue;
      }

      const json = (await res.json()) as VLResponse;

      if (json.base_resp?.status_code && json.base_resp.status_code !== 0) {
        lastError = json.base_resp.status_msg ?? `status_code=${json.base_resp.status_code}`;
        console.warn(`[VisionExtract] ${endpoint} error: ${lastError}`);
        continue;
      }

      const msg = json.choices?.[0]?.message;
      const content = msg?.content ?? '';
      const reasoning = msg?.reasoning_content ?? '';
      const tokens = json.usage?.total_tokens ?? 0;
      const elapsed = Date.now() - startTime;
      console.log(`[VisionExtract] OK via ${endpoint} in ${elapsed}ms, content: ${content.length} chars, reasoning: ${reasoning.length} chars, tokens: ${tokens}`);
      if (content.length < 50 && reasoning.length > content.length) {
        console.log(`[VisionExtract] Content too short, using reasoning_content instead`);
        return reasoning;
      }
      return content;
    } catch (err) {
      lastError = (err as Error).message;
      console.warn(`[VisionExtract] ${endpoint} failed: ${lastError}`);
    }
  }

  throw new Error(`MiniMax-VL all endpoints failed: ${lastError.slice(0, 200)}`);
}

export async function extractPdfWithVision(pdfPath: string): Promise<string> {
  const images = await pdfToImages(pdfPath);
  if (images.length === 0) {
    throw new Error('Failed to convert PDF to images');
  }

  const pageResults: string[] = [];
  for (let i = 0; i < images.length; i++) {
    try {
      const content = await extractPageWithVision(images[i]);
      if (content.trim()) {
        pageResults.push(content);
      }
    } catch (err) {
      console.warn(`[VisionExtract] Page ${i + 1} failed: ${(err as Error).message}`);
    }
  }

  return pageResults.join('\n\n---\n\n');
}
