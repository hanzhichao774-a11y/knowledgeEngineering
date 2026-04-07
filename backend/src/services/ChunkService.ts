export interface TextChunk {
  text: string;
  position: number;
  source: string;
}

export interface ChunkOptions {
  maxChunkSize?: number;
  minChunkSize?: number;
  overlap?: number;
  source?: string;
}

const DEFAULTS: Required<ChunkOptions> = {
  maxChunkSize: 500,
  minChunkSize: 50,
  overlap: 30,
  source: 'unknown',
};

/**
 * Split document text into chunks suitable for embedding.
 * Handles Markdown tables (preserving header context per row),
 * prose paragraphs, and tabular/row data.
 */
export function splitIntoChunks(text: string, opts?: ChunkOptions): TextChunk[] {
  const { maxChunkSize, minChunkSize, overlap, source } = { ...DEFAULTS, ...opts };

  const sections = splitByMarkdownTables(text);
  const chunks: TextChunk[] = [];

  for (const section of sections) {
    if (section.type === 'table') {
      const tableChunks = chunkMarkdownTable(section.content, source, chunks.length);
      chunks.push(...tableChunks);
    } else {
      const proseChunks = chunkProse(section.content, maxChunkSize, minChunkSize, overlap, source, chunks.length);
      chunks.push(...proseChunks);
    }
  }

  console.log(`[ChunkService] Split into ${chunks.length} chunks from ${text.length} chars`);
  return chunks;
}

interface Section {
  type: 'prose' | 'table';
  content: string;
}

function splitByMarkdownTables(text: string): Section[] {
  const lines = text.split('\n');
  const sections: Section[] = [];
  let currentProse: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();

    if (line.startsWith('|') && line.endsWith('|')) {
      if (currentProse.length > 0) {
        sections.push({ type: 'prose', content: currentProse.join('\n') });
        currentProse = [];
      }

      const tableLines: string[] = [];
      while (i < lines.length) {
        const tl = lines[i].trim();
        if (tl.startsWith('|') && (tl.endsWith('|') || /^\|[\s:-]+\|?$/.test(tl))) {
          tableLines.push(lines[i]);
          i++;
        } else {
          break;
        }
      }
      sections.push({ type: 'table', content: tableLines.join('\n') });
    } else {
      currentProse.push(lines[i]);
      i++;
    }
  }

  if (currentProse.length > 0) {
    const content = currentProse.join('\n').trim();
    if (content) sections.push({ type: 'prose', content });
  }

  return sections;
}

function chunkMarkdownTable(tableText: string, source: string, startPos: number): TextChunk[] {
  const lines = tableText.split('\n').filter((l) => l.trim());
  if (lines.length < 3) {
    return [{ text: tableText, position: startPos, source }];
  }

  const headerLine = lines[0];
  const separatorLine = lines[1];
  const isValidSeparator = /^\|[\s:-]+/.test(separatorLine.trim());

  if (!isValidSeparator) {
    return [{ text: tableText, position: startPos, source }];
  }

  const chunks: TextChunk[] = [];
  const dataRows = lines.slice(2);
  const headerContext = `${headerLine}\n${separatorLine}`;

  const ROWS_PER_CHUNK = 5;
  for (let i = 0; i < dataRows.length; i += ROWS_PER_CHUNK) {
    const batch = dataRows.slice(i, i + ROWS_PER_CHUNK);
    const chunkText = `${headerContext}\n${batch.join('\n')}`;
    chunks.push({
      text: chunkText,
      position: startPos + chunks.length,
      source,
    });
  }

  return chunks;
}

function chunkProse(
  text: string,
  maxChunkSize: number,
  minChunkSize: number,
  overlap: number,
  source: string,
  startPos: number,
): TextChunk[] {
  const rawLines = text.split('\n');
  const segments: string[] = [];
  let currentSegment = '';

  for (const line of rawLines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (currentSegment.length >= minChunkSize) {
        segments.push(currentSegment);
        currentSegment = '';
      }
      continue;
    }

    const isTableRow =
      /^\d{1,2}[:\uff1a]\d{2}/.test(trimmed) ||
      /^\d+[\s,.\t]+\d+/.test(trimmed) ||
      (trimmed.split(/[\s\t]+/).length >= 4 && /\d/.test(trimmed));

    if (isTableRow) {
      if (currentSegment) {
        segments.push(currentSegment);
        currentSegment = '';
      }
      segments.push(trimmed);
      continue;
    }

    if (currentSegment.length + trimmed.length + 1 > maxChunkSize && currentSegment.length >= minChunkSize) {
      segments.push(currentSegment);
      currentSegment = trimmed;
    } else {
      currentSegment += (currentSegment ? '\n' : '') + trimmed;
    }
  }
  if (currentSegment.trim()) {
    segments.push(currentSegment);
  }

  const chunks: TextChunk[] = [];
  let prevTail = '';

  for (let i = 0; i < segments.length; i++) {
    let chunkText = segments[i];

    if (prevTail && chunkText.length < maxChunkSize) {
      chunkText = prevTail + '\n' + chunkText;
    }

    if (chunkText.length > maxChunkSize) {
      const subChunks = splitLongSegment(chunkText, maxChunkSize);
      for (const sub of subChunks) {
        chunks.push({ text: sub, position: startPos + chunks.length, source });
      }
    } else if (chunkText.length >= minChunkSize) {
      chunks.push({ text: chunkText, position: startPos + chunks.length, source });
    } else if (chunks.length > 0) {
      chunks[chunks.length - 1].text += '\n' + chunkText;
    } else {
      chunks.push({ text: chunkText, position: startPos, source });
    }

    prevTail = segments[i].slice(-overlap);
  }

  return chunks;
}

function splitLongSegment(text: string, maxSize: number): string[] {
  const results: string[] = [];
  const sentences = text.split(/(?<=[。！？\n])/);
  let current = '';

  for (const sentence of sentences) {
    if (current.length + sentence.length > maxSize && current.length > 0) {
      results.push(current);
      current = sentence;
    } else {
      current += sentence;
    }
  }
  if (current.trim()) {
    results.push(current);
  }

  return results;
}
