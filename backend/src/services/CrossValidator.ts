export interface ValidationResult {
  mergedMarkdown: string;
  confidence: 'high' | 'medium' | 'low';
  totalCells: number;
  matchedCells: number;
  mismatchedCells: number;
  mismatches: CellMismatch[];
  channel1Tables: ParsedTable[];
  channel2Tables: ParsedTable[];
}

export interface CellMismatch {
  table: number;
  row: number;
  col: number;
  header: string;
  channel1Value: string;
  channel2Value: string;
  resolvedValue: string;
  resolution: 'auto-vision' | 'flagged';
}

export interface ParsedTable {
  headers: string[];
  rows: string[][];
}

export function crossValidate(
  channel1Markdown: string,
  channel2Markdown: string,
): ValidationResult {
  const tables1 = extractTablesFromMarkdown(channel1Markdown);
  const tables2 = extractTablesFromMarkdown(channel2Markdown);

  console.log(`[CrossValidator] Channel1: ${tables1.length} tables, Channel2: ${tables2.length} tables`);

  if (tables1.length === 0 && tables2.length === 0) {
    return {
      mergedMarkdown: channel1Markdown || channel2Markdown,
      confidence: 'medium',
      totalCells: 0,
      matchedCells: 0,
      mismatchedCells: 0,
      mismatches: [],
      channel1Tables: tables1,
      channel2Tables: tables2,
    };
  }

  if (tables1.length === 0) {
    return {
      mergedMarkdown: channel2Markdown,
      confidence: 'medium',
      totalCells: countCells(tables2),
      matchedCells: 0,
      mismatchedCells: 0,
      mismatches: [],
      channel1Tables: tables1,
      channel2Tables: tables2,
    };
  }

  if (tables2.length === 0) {
    return {
      mergedMarkdown: channel1Markdown,
      confidence: 'medium',
      totalCells: countCells(tables1),
      matchedCells: 0,
      mismatchedCells: 0,
      mismatches: [],
      channel1Tables: tables1,
      channel2Tables: tables2,
    };
  }

  const pairCount = Math.min(tables1.length, tables2.length);
  let totalCells = 0;
  let matchedCells = 0;
  const allMismatches: CellMismatch[] = [];
  const mergedTables: ParsedTable[] = [];

  for (let t = 0; t < pairCount; t++) {
    const t1 = tables1[t];
    const t2 = tables2[t];

    const merged = mergeAndCompare(t1, t2, t, allMismatches);
    totalCells += merged.cellCount;
    matchedCells += merged.matchCount;
    mergedTables.push(merged.table);
  }

  for (let t = pairCount; t < tables1.length; t++) {
    mergedTables.push(tables1[t]);
    totalCells += countTableCells(tables1[t]);
  }
  for (let t = pairCount; t < tables2.length; t++) {
    mergedTables.push(tables2[t]);
    totalCells += countTableCells(tables2[t]);
  }

  const mismatchedCells = allMismatches.length;
  const mismatchRate = totalCells > 0 ? mismatchedCells / totalCells : 0;

  let confidence: 'high' | 'medium' | 'low';
  if (mismatchRate === 0) {
    confidence = 'high';
  } else if (mismatchRate < 0.05) {
    confidence = 'medium';
  } else {
    confidence = 'low';
  }

  const nonTableContent1 = extractNonTableContent(channel1Markdown);
  const nonTableContent2 = extractNonTableContent(channel2Markdown);
  const nonTableContent = nonTableContent1.length >= nonTableContent2.length
    ? nonTableContent1 : nonTableContent2;

  const mergedMarkdown = rebuildMarkdown(nonTableContent, mergedTables);

  console.log(`[CrossValidator] Result: ${confidence} confidence, ${matchedCells}/${totalCells} matched, ${mismatchedCells} mismatches`);

  return {
    mergedMarkdown,
    confidence,
    totalCells,
    matchedCells,
    mismatchedCells,
    mismatches: allMismatches,
    channel1Tables: tables1,
    channel2Tables: tables2,
  };
}

function mergeAndCompare(
  t1: ParsedTable,
  t2: ParsedTable,
  tableIdx: number,
  mismatches: CellMismatch[],
): { table: ParsedTable; cellCount: number; matchCount: number } {
  const rowCount = Math.max(t1.rows.length, t2.rows.length);
  const colCount = Math.max(t1.headers.length, t2.headers.length);
  const mergedHeaders = t1.headers.length >= t2.headers.length ? [...t1.headers] : [...t2.headers];

  let cellCount = 0;
  let matchCount = 0;
  const mergedRows: string[][] = [];

  for (let r = 0; r < rowCount; r++) {
    const row1 = t1.rows[r] ?? [];
    const row2 = t2.rows[r] ?? [];
    const mergedRow: string[] = [];

    for (let c = 0; c < colCount; c++) {
      const v1 = (row1[c] ?? '').trim();
      const v2 = (row2[c] ?? '').trim();
      cellCount++;

      if (cellsMatch(v1, v2)) {
        matchCount++;
        mergedRow.push(v1 || v2);
      } else if (!v1 && v2) {
        mergedRow.push(v2);
      } else if (v1 && !v2) {
        mergedRow.push(v1);
      } else {
        mergedRow.push(v2);
        mismatches.push({
          table: tableIdx,
          row: r,
          col: c,
          header: mergedHeaders[c] ?? `col${c}`,
          channel1Value: v1,
          channel2Value: v2,
          resolvedValue: v2,
          resolution: 'auto-vision',
        });
      }
    }
    mergedRows.push(mergedRow);
  }

  return {
    table: { headers: mergedHeaders, rows: mergedRows },
    cellCount,
    matchCount,
  };
}

function cellsMatch(v1: string, v2: string): boolean {
  if (v1 === v2) return true;
  if (!v1 || !v2) return false;

  const norm1 = normalizeValue(v1);
  const norm2 = normalizeValue(v2);
  if (norm1 === norm2) return true;

  const n1 = parseFloat(norm1);
  const n2 = parseFloat(norm2);
  if (!isNaN(n1) && !isNaN(n2)) {
    if (n1 === n2) return true;
    const tolerance = Math.max(Math.abs(n1), Math.abs(n2)) * 0.001;
    return Math.abs(n1 - n2) <= tolerance;
  }

  return false;
}

function normalizeValue(v: string): string {
  return v
    .replace(/\s+/g, '')
    .replace(/，/g, ',')
    .replace(/。/g, '.')
    .replace(/：/g, ':');
}

export function extractTablesFromMarkdown(md: string): ParsedTable[] {
  const tables: ParsedTable[] = [];
  const lines = md.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();
    if (line.startsWith('|') && line.endsWith('|')) {
      const headerCells = parseTableRow(line);

      if (i + 1 < lines.length && /^\|[\s:-]+\|/.test(lines[i + 1].trim())) {
        i += 2;
        const rows: string[][] = [];

        while (i < lines.length) {
          const rowLine = lines[i].trim();
          if (rowLine.startsWith('|') && rowLine.endsWith('|')) {
            rows.push(parseTableRow(rowLine));
            i++;
          } else {
            break;
          }
        }

        if (rows.length > 0) {
          tables.push({ headers: headerCells, rows });
        }
        continue;
      }
    }
    i++;
  }

  return tables;
}

function parseTableRow(line: string): string[] {
  return line
    .slice(1, -1)
    .split('|')
    .map((c) => c.trim());
}

function countCells(tables: ParsedTable[]): number {
  return tables.reduce((sum, t) => sum + countTableCells(t), 0);
}

function countTableCells(table: ParsedTable): number {
  return table.rows.length * table.headers.length;
}

function extractNonTableContent(md: string): string {
  const lines = md.split('\n');
  const nonTableLines: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();
    if (line.startsWith('|') && line.endsWith('|')) {
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        i++;
      }
      nonTableLines.push('{{TABLE}}');
    } else {
      nonTableLines.push(lines[i]);
      i++;
    }
  }

  return nonTableLines.join('\n');
}

function rebuildMarkdown(nonTableContent: string, tables: ParsedTable[]): string {
  let tableIdx = 0;
  const lines = nonTableContent.split('\n');
  const result: string[] = [];

  for (const line of lines) {
    if (line.trim() === '{{TABLE}}' && tableIdx < tables.length) {
      const table = tables[tableIdx];
      result.push('| ' + table.headers.join(' | ') + ' |');
      result.push('| ' + table.headers.map(() => '---').join(' | ') + ' |');
      for (const row of table.rows) {
        result.push('| ' + row.join(' | ') + ' |');
      }
      tableIdx++;
    } else {
      result.push(line);
    }
  }

  while (tableIdx < tables.length) {
    const table = tables[tableIdx];
    result.push('');
    result.push('| ' + table.headers.join(' | ') + ' |');
    result.push('| ' + table.headers.map(() => '---').join(' | ') + ' |');
    for (const row of table.rows) {
      result.push('| ' + row.join(' | ') + ' |');
    }
    tableIdx++;
  }

  return result.join('\n');
}
