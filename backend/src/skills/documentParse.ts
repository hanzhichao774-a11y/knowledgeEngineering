import type { ExecutionContext, SkillResult } from '../agents/types.js';
import { callLLM, extractJSON } from '../services/LLMService.js';
import { parseDocument, parsePdfWithDocling, parsePdfWithVision } from '../services/DocumentParserService.js';
import { crossValidate, type ValidationResult } from '../services/CrossValidator.js';

const SUMMARY_PROMPT = `你是一个专业的文档分析助手。用户会给你一段文档内容（Markdown 格式），请分析文档结构并返回 JSON 格式的结果。

要求返回如下 JSON 结构（不要包含其他内容）：
\`\`\`json
{
  "pageCount": <估计页数>,
  "chapters": <章节数>,
  "paragraphs": <段落数>,
  "tables": <表格数>,
  "summary": "<500字以内的文档摘要，必须包含关键数值和表格数据概要>"
}
\`\`\`

重要：summary 中必须保留文档中的关键数值、表格列名、数据范围等信息，不要只写泛泛的概述。`;

export async function documentParseSkill(ctx: ExecutionContext): Promise<SkillResult> {
  const startTime = Date.now();

  if (!ctx.filePath) {
    return {
      skillName: '多模态文档解析',
      status: 'error',
      data: { error: '未提供文件路径' },
      tokenUsed: 0,
      duration: 0,
    };
  }

  const ext = ctx.filePath.toLowerCase().split('.').pop() ?? '';
  const isPdf = ext === 'pdf';

  try {
    let documentContent: string;
    let validationInfo: Record<string, unknown> = {};

    if (isPdf) {
      documentContent = await dualChannelPdfParse(ctx.filePath, validationInfo);
    } else {
      const result = await parseDocument(ctx.filePath);
      documentContent = result.markdown;
      validationInfo = { channel: result.channel, format: result.format };
      console.log(`[Skill:documentParse] ${result.format} parsed via ${result.channel}: ${documentContent.length} chars`);
    }

    const contentForLLM = documentContent.slice(0, 15000);
    const userPrompt = `请分析以下文档内容：\n\n${contentForLLM}`;

    const { text, usage } = await callLLM(SUMMARY_PROMPT, userPrompt);
    const data = extractJSON<Record<string, unknown>>(text);

    data.rawText = documentContent;
    data.validation = validationInfo;

    const duration = (Date.now() - startTime) / 1000;

    return {
      skillName: '多模态文档解析',
      status: 'success',
      data,
      tokenUsed: usage?.inputTokens ?? 0,
      duration,
    };
  } catch (err) {
    console.error('[Skill:documentParse] Failed:', (err as Error).message);
    const duration = (Date.now() - startTime) / 1000;
    return {
      skillName: '多模态文档解析',
      status: 'error',
      data: { error: (err as Error).message },
      tokenUsed: 0,
      duration,
    };
  }
}

const ENABLE_VISION_CHANNEL = process.env.ENABLE_VISION_CHANNEL === 'true';

async function dualChannelPdfParse(
  filePath: string,
  validationInfo: Record<string, unknown>,
): Promise<string> {
  if (!ENABLE_VISION_CHANNEL) {
    console.log('[Skill:documentParse] Docling single-channel mode (vision channel disabled)');
    const result = await parsePdfWithDocling(filePath);
    validationInfo.mode = 'single-channel';
    validationInfo.channel = result.channel;
    validationInfo.confidence = 'high';
    console.log(`[Skill:documentParse] Docling (${result.channel}): ${result.markdown.length} chars`);
    return result.markdown;
  }

  console.log('[Skill:documentParse] Starting dual-channel PDF parsing...');

  let channel1Result: string | null = null;
  let channel2Result: string | null = null;
  let channel1Error: string | null = null;
  let channel2Error: string | null = null;

  const [ch1, ch2] = await Promise.allSettled([
    parsePdfWithDocling(filePath),
    parsePdfWithVision(filePath),
  ]);

  if (ch1.status === 'fulfilled') {
    channel1Result = ch1.value.markdown;
    console.log(`[Skill:documentParse] Channel1 (${ch1.value.channel}): ${channel1Result.length} chars`);
  } else {
    channel1Error = ch1.reason?.message ?? 'unknown error';
    console.warn(`[Skill:documentParse] Channel1 failed: ${channel1Error}`);
  }

  if (ch2.status === 'fulfilled') {
    channel2Result = ch2.value.markdown;
    console.log(`[Skill:documentParse] Channel2 (${ch2.value.channel}): ${channel2Result.length} chars`);
  } else {
    channel2Error = ch2.reason?.message ?? 'unknown error';
    console.warn(`[Skill:documentParse] Channel2 failed: ${channel2Error}`);
  }

  if (channel1Result && channel2Result) {
    const validation = crossValidate(channel1Result, channel2Result);
    validationInfo.mode = 'dual-channel';
    validationInfo.confidence = validation.confidence;
    validationInfo.totalCells = validation.totalCells;
    validationInfo.matchedCells = validation.matchedCells;
    validationInfo.mismatchedCells = validation.mismatchedCells;
    validationInfo.mismatches = validation.mismatches.map((m) => ({
      header: m.header,
      row: m.row,
      ch1: m.channel1Value,
      ch2: m.channel2Value,
      resolved: m.resolvedValue,
      resolution: m.resolution,
    }));

    console.log(
      `[Skill:documentParse] Cross-validation: ${validation.confidence} confidence, ` +
        `${validation.matchedCells}/${validation.totalCells} matched, ` +
        `${validation.mismatchedCells} mismatches`,
    );

    return validation.mergedMarkdown;
  }

  if (channel1Result) {
    validationInfo.mode = 'single-channel';
    validationInfo.channel = 'docling';
    validationInfo.confidence = 'high';
    return channel1Result;
  }

  if (channel2Result) {
    validationInfo.mode = 'single-channel';
    validationInfo.channel = 'vision';
    validationInfo.confidence = 'medium';
    return channel2Result;
  }

  throw new Error(
    `Both channels failed. Channel1: ${channel1Error}, Channel2: ${channel2Error}`,
  );
}
