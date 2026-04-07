import { readFile } from 'fs/promises';
import { createRequire } from 'module';
import { extractPdfWithVision } from './VisionExtractService.js';

const require = createRequire(import.meta.url);

const DOCLING_URL = process.env.DOCLING_API_URL || 'http://localhost:5001';

export interface ParseResult {
  markdown: string;
  format: string;
  channel: 'docling' | 'exceljs' | 'mammoth' | 'vision' | 'text';
}

export async function parseDocument(filePath: string): Promise<ParseResult> {
  const ext = filePath.toLowerCase().split('.').pop() ?? '';

  switch (ext) {
    case 'xlsx':
    case 'xls':
      return parseExcel(filePath);
    case 'docx':
      return parseWord(filePath);
    case 'pdf':
      return parsePdfWithDocling(filePath);
    default:
      return parsePlainText(filePath);
  }
}

export async function parsePdfWithDocling(filePath: string): Promise<ParseResult> {
  const buffer = await readFile(filePath);
  const filename = filePath.split('/').pop() ?? 'document.pdf';

  const startTime = Date.now();
  console.log(`[DocParser] Calling Docling API at ${DOCLING_URL} (file upload)...`);

  try {
    const formData = new FormData();
    const blob = new Blob([buffer], { type: 'application/pdf' });
    formData.append('files', blob, filename);
    formData.append('to_formats', 'md');
    formData.append('do_table_structure', 'true');
    formData.append('table_mode', 'accurate');
    formData.append('do_ocr', 'true');

    const res = await fetch(`${DOCLING_URL}/v1/convert/file`, {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => `HTTP ${res.status}`);
      throw new Error(`Docling API ${res.status}: ${errText.slice(0, 300)}`);
    }

    const json = (await res.json()) as Record<string, unknown>;
    const elapsed = Date.now() - startTime;
    console.log(`[DocParser] Docling OK in ${elapsed}ms`);

    const md = extractDoclingMarkdown(json);
    return { markdown: md, format: 'pdf', channel: 'docling' };
  } catch (err) {
    console.warn(`[DocParser] Docling failed: ${(err as Error).message}, falling back to vision...`);
    return parsePdfWithVision(filePath);
  }
}

function extractDoclingMarkdown(json: Record<string, unknown>): string {
  if (typeof json === 'string') return json;

  if (json.document && typeof json.document === 'object') {
    const doc = json.document as Record<string, unknown>;
    if (typeof doc.md_content === 'string') return doc.md_content;
    if (typeof doc.markdown === 'string') return doc.markdown;
  }

  if (typeof json.md_content === 'string') return json.md_content;
  if (typeof json.markdown === 'string') return json.markdown;
  if (typeof json.content === 'string') return json.content;

  if (json.document_text && typeof json.document_text === 'string') return json.document_text;

  if (Array.isArray(json.results) && json.results.length > 0) {
    const first = json.results[0] as Record<string, unknown>;
    if (typeof first.md_content === 'string') return first.md_content;
    if (typeof first.markdown === 'string') return first.markdown;
    if (first.document && typeof first.document === 'object') {
      const d = first.document as Record<string, unknown>;
      if (typeof d.md_content === 'string') return d.md_content;
      if (typeof d.markdown === 'string') return d.markdown;
    }
  }

  console.warn('[DocParser] Could not extract markdown from Docling response, using JSON dump');
  return JSON.stringify(json, null, 2).slice(0, 15000);
}

export async function parsePdfWithVision(filePath: string): Promise<ParseResult> {
  const markdown = await extractPdfWithVision(filePath);
  return { markdown, format: 'pdf', channel: 'vision' };
}

async function parseExcel(filePath: string): Promise<ParseResult> {
  const ExcelJS = require('exceljs');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const parts: string[] = [];

  workbook.eachSheet((sheet: any) => {
    parts.push(`## ${sheet.name}\n`);

    const rows: string[][] = [];
    let maxCols = 0;

    sheet.eachRow({ includeEmpty: false }, (row: any) => {
      const cells: string[] = [];
      row.eachCell({ includeEmpty: true }, (cell: any) => {
        cells.push(String(cell.value ?? ''));
      });
      if (cells.length > maxCols) maxCols = cells.length;
      rows.push(cells);
    });

    if (rows.length === 0) return;

    for (let i = 0; i < rows.length; i++) {
      while (rows[i].length < maxCols) rows[i].push('');
    }

    const header = rows[0];
    parts.push('| ' + header.join(' | ') + ' |');
    parts.push('| ' + header.map(() => '---').join(' | ') + ' |');

    for (let i = 1; i < rows.length; i++) {
      parts.push('| ' + rows[i].join(' | ') + ' |');
    }
    parts.push('');
  });

  const markdown = parts.join('\n');
  console.log(`[DocParser] Excel parsed: ${markdown.length} chars`);
  return { markdown, format: 'xlsx', channel: 'exceljs' };
}

async function parseWord(filePath: string): Promise<ParseResult> {
  const mammoth = require('mammoth');
  const buffer = await readFile(filePath);
  const result = await mammoth.convertToHtml({ buffer });
  const html: string = result.value;

  const markdown = htmlToMarkdown(html);
  console.log(`[DocParser] Word parsed: ${markdown.length} chars`);
  return { markdown, format: 'docx', channel: 'mammoth' };
}

function htmlToMarkdown(html: string): string {
  let md = html;
  md = md.replace(/<h([1-6])[^>]*>(.*?)<\/h\1>/gi, (_m, level, text) => {
    return '#'.repeat(Number(level)) + ' ' + text.replace(/<[^>]+>/g, '') + '\n\n';
  });
  md = md.replace(/<strong>(.*?)<\/strong>/gi, '**$1**');
  md = md.replace(/<em>(.*?)<\/em>/gi, '*$1*');
  md = md.replace(/<br\s*\/?>/gi, '\n');
  md = md.replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n');
  md = md.replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n');

  md = md.replace(/<table[^>]*>([\s\S]*?)<\/table>/gi, (_m, tbody) => {
    const rows: string[][] = [];
    const rowMatches = tbody.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) || [];
    for (const rowHtml of rowMatches) {
      const cells: string[] = [];
      const cellMatches = rowHtml.match(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi) || [];
      for (const cellHtml of cellMatches) {
        const text = cellHtml.replace(/<[^>]+>/g, '').trim();
        cells.push(text);
      }
      rows.push(cells);
    }
    if (rows.length === 0) return '';
    const maxCols = Math.max(...rows.map((r) => r.length));
    for (const row of rows) {
      while (row.length < maxCols) row.push('');
    }
    let result = '| ' + rows[0].join(' | ') + ' |\n';
    result += '| ' + rows[0].map(() => '---').join(' | ') + ' |\n';
    for (let i = 1; i < rows.length; i++) {
      result += '| ' + rows[i].join(' | ') + ' |\n';
    }
    return result + '\n';
  });

  md = md.replace(/<[^>]+>/g, '');
  md = md.replace(/\n{3,}/g, '\n\n');
  return md.trim();
}

async function parsePlainText(filePath: string): Promise<ParseResult> {
  const buffer = await readFile(filePath);
  const text = buffer.toString('utf-8').slice(0, 15000);
  return { markdown: text, format: 'txt', channel: 'text' };
}
