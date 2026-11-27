import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { createWorker, type Worker } from 'tesseract.js';
import type { JournalCheckRow } from '../../types/journal';
import { formatDdMmmYy, parseLooseDate } from '../journal/engine';
import type {
  ExtractedField,
  ExtractedTable,
  ExtractionSchemaTemplate,
  FolioParseDocumentResult,
  OcrMode,
  OcrPage,
  SupportedMimeType,
} from './types';
import { preprocessScannedImage } from './imagePreprocess';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

interface PositionedItem {
  x: number;
  y: number;
  width: number;
  str: string;
}

interface VisualLine {
  pageNumber: number;
  y: number;
  minX: number;
  maxX: number;
  items: PositionedItem[];
  text: string;
}

export interface OfflineExtractOptions {
  file: File;
  mimeType: SupportedMimeType;
  schema: ExtractionSchemaTemplate;
  startPage: number;
  endPage?: number;
  ocrMode: OcrMode;
  enhanceScanContrast: boolean;
  normalizeDates: boolean;
  onProgress?: (pct: number, stageLabel: string) => void;
}

let sharedOcrWorker: Worker | null = null;

async function getOfflineOcrWorker(): Promise<Worker> {
  if (sharedOcrWorker) return sharedOcrWorker;
  const worker = await createWorker('eng', 1, {
    workerPath: '/ocr/worker.min.js',
    corePath: '/ocr/core',
    langPath: '/ocr/lang',
    gzip: true,
  });
  sharedOcrWorker = worker;
  return worker;
}

function groupItemsIntoLines(pageNumber: number, rawItems: PositionedItem[]): VisualLine[] {
  const nonEmpty = rawItems.filter((i) => i.str.trim().length > 0);
  if (nonEmpty.length === 0) return [];

  const sorted = [...nonEmpty].sort((a, b) => {
    if (Math.abs(b.y - a.y) > 3.2) return b.y - a.y;
    return a.x - b.x;
  });

  const groups: PositionedItem[][] = [];
  for (const item of sorted) {
    const lastGroup = groups[groups.length - 1];
    if (!lastGroup) {
      groups.push([item]);
      continue;
    }
    const refY = lastGroup[0].y;
    if (Math.abs(item.y - refY) <= 3.2) {
      lastGroup.push(item);
    } else {
      groups.push([item]);
    }
  }

  return groups.map((group) => {
    group.sort((a, b) => a.x - b.x);
    let text = '';
    let prevEnd = -1;
    let minX = Infinity;
    let maxX = 0;

    for (const item of group) {
      if (item.x < minX) minX = item.x;
      const itemEnd = item.x + Math.max(item.width, item.str.length * 4);
      if (itemEnd > maxX) maxX = itemEnd;

      if (prevEnd >= 0) {
        const gap = item.x - prevEnd;
        if (gap > 14) {
          text += '  ';
        } else if (gap > 1.5 && !text.endsWith(' ') && !item.str.startsWith(' ')) {
          text += ' ';
        }
      }
      text += item.str;
      prevEnd = item.x + item.width;
    }

    return {
      pageNumber,
      y: group[0].y,
      minX: Number.isFinite(minX) ? minX : 0,
      maxX,
      items: group,
      text: text.replace(/\u00a0/g, ' ').trim(),
    };
  });
}

async function runOcrOnCanvasOrBlob(
  input: HTMLCanvasElement | File,
  pageNumber: number
): Promise<{ lines: VisualLine[]; text: string; confidence: number }> {
  const worker = await getOfflineOcrWorker();
  const result = await worker.recognize(input, {}, { blocks: true });
  const data = result.data;
  const pageHeight = 1000;
  const positioned: PositionedItem[] = [];

  for (const block of data.blocks ?? []) {
    for (const para of block.paragraphs ?? []) {
      for (const line of para.lines ?? []) {
        for (const word of line.words ?? []) {
          if (!word.text.trim()) continue;
          positioned.push({
            x: word.bbox.x0,
            y: pageHeight - word.bbox.y0,
            width: Math.max(1, word.bbox.x1 - word.bbox.x0),
            str: word.text,
          });
        }
      }
    }
  }

  const lines = groupItemsIntoLines(pageNumber, positioned);
  const fullText = (data.text || lines.map((l) => l.text).join('\n')).trim();

  return {
    lines,
    text: fullText,
    confidence: Math.round(data.confidence ?? 85),
  };
}

function normalizeDateString(raw: string): string {
  const cleaned = raw.trim();
  const dmy = cleaned.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (dmy) {
    const day = dmy[1].padStart(2, '0');
    const month = dmy[2].padStart(2, '0');
    const yearRaw = dmy[3];
    const year = yearRaw.length === 2 ? `20${yearRaw}` : yearRaw;
    return `${year}-${month}-${day}`;
  }
  return cleaned;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractJournalHeaderFields(frontLines: VisualLine[]): ExtractedField[] {
  const fullText = frontLines.map((l) => l.text).join('\n');
  const fields: ExtractedField[] = [];
  const push = (
    key: string,
    value: string,
    dataType: ExtractedField['dataType'] = 'string',
    pageNumber = 1
  ) => {
    if (!value.trim()) return;
    if (fields.some((f) => f.key === key)) return;
    fields.push({
      key,
      value: value.trim(),
      dataType,
      confidence: 'high',
      pageNumber,
    });
  };

  const jMatch = fullText.match(/Journal\s*No\.?\s*[:.]?\s*(\d+)/i);
  if (jMatch) push('journal_no', jMatch[1], 'string', 1);

  const regMatch = fullText.match(/Regd\.?\s*No\.?\s*([A-Z0-9.\s-]+?)(?=\s{2,}|TMR-|\n|$)/i);
  if (regMatch) push('regd_no', regMatch[1], 'string', 1);

  const codeMatch = fullText.match(/\b(TMR-\d{2}-\d{2}-\d{4})\b/i);
  if (codeMatch) push('document_code', codeMatch[1], 'string', 1);

  const dateMatch = fullText.match(/\b([A-Z][a-z]+,?\s*(?:\d{1,2}(?:st|nd|rd|th)?\s*)?20\d{2})\b/);
  if (dateMatch) push('journal_date', dateMatch[1], 'string', 1);

  if (/TRADE MARKS REGISTRY/i.test(fullText)) {
    push(
      'issuing_authority',
      'Trade Marks Registry (IPO-Pakistan)',
      'string',
      1
    );
  }

  const feeMatch = fullText.match(/fee of\s*(Rs\.?\s*[\d,/-]+)/i);
  if (feeMatch) push('opposition_fee', feeMatch[1], 'currency', 2);

  if (/within two\s+months/i.test(fullText)) {
    push('opposition_window', '2 months from Journal date (Form T.M-5)', 'string', 2);
  }

  return fields;
}

function shouldStripJournalChrome(line: VisualLine, stripHeaderPattern?: string): boolean {
  const t = line.text.trim();
  if (!t) return true;
  if (/^THE TRADE MARKS JOURNAL\s*\(No\./i.test(t)) return true;
  if (stripHeaderPattern) {
    try {
      const re = new RegExp(stripHeaderPattern, 'i');
      if (re.test(t)) return true;
    } catch {
      // Ignore malformed user regex
    }
  }
  if (/^Applications Accepted and Advertised$/i.test(t)) return true;
  if (/^for inviting Opposition, if any;$/i.test(t)) return true;
  if (/^\(Accepted on or before .*unless otherwise stated\)$/i.test(t)) return true;
  if (/^\d{4}$/.test(t) && line.minX > 420) return true;
  return false;
}

function parseRepeatingRecordSchema(
  dataLines: VisualLine[],
  schema: ExtractionSchemaTemplate,
  normalizeDates: boolean
): ExtractedTable {
  const delimiter = schema.recordDelimiter || 'Advertised under section';
  const delimiterRegex = new RegExp(`^${escapeRegex(delimiter)}`, 'i');

  const labelMatchers: Array<{ fieldName: string; regex: RegExp }> = [];
  for (const f of schema.fields) {
    const labels = f.sourceLabels ?? [];
    for (const lbl of labels) {
      if (!lbl || lbl === '__PAGE_NUMBER__') continue;
      const normalizedLbl = lbl
        .replace(/[’']/g, "[’']?")
        .replace(/\s+/g, '\\s+');
      labelMatchers.push({
        fieldName: f.name,
        regex: new RegExp(`^${normalizedLbl}\\s*(.*)$`, 'i'),
      });
    }
  }
  labelMatchers.sort((a, b) => b.regex.source.length - a.regex.source.length);

  const filtered = dataLines.filter((l) => !shouldStripJournalChrome(l, schema.stripHeaderPattern));

  interface DraftRecord {
    values: Record<string, string>;
    candidateTitle: string;
    pageNumber: number;
  }

  const records: DraftRecord[] = [];
  let current: DraftRecord | null = null;
  let activeField: string | null = null;
  let lastStandaloneLine = '';

  const flushCurrent = () => {
    if (!current) return;
    for (const fieldDef of schema.fields) {
      const raw = (current.values[fieldDef.name] ?? '').replace(/\s+/g, ' ').trim();
      if (fieldDef.name === 'title' && !raw && current.candidateTitle) {
        current.values[fieldDef.name] = current.candidateTitle;
      } else if (fieldDef.type === 'date' && normalizeDates && raw) {
        current.values[fieldDef.name] = normalizeDateString(raw);
      } else {
        current.values[fieldDef.name] = raw;
      }
    }
    if (schema.fields.some((f) => f.name === 'page_number')) {
      current.values['page_number'] = String(current.pageNumber);
    }
    records.push(current);
    current = null;
    activeField = null;
  };

  for (const line of filtered) {
    const text = line.text.trim();
    if (!text) continue;

    if (delimiterRegex.test(text)) {
      if (current && activeField && lastStandaloneLine) {
        const cur: DraftRecord = current;
        const prevVal: string = cur.values[activeField] ?? '';
        if (prevVal.endsWith(lastStandaloneLine)) {
          cur.values[activeField] = prevVal
            .slice(0, prevVal.length - lastStandaloneLine.length)
            .trim();
        }
      }
      flushCurrent();
      current = {
        values: {},
        candidateTitle: lastStandaloneLine,
        pageNumber: line.pageNumber,
      };
      if (schema.fields.some((f) => f.name === 'advertised_under')) {
        current.values['advertised_under'] = text;
      }
      lastStandaloneLine = '';
      continue;
    }

    if (!current) {
      if (text.length <= 60 && !text.includes(':')) {
        lastStandaloneLine = text;
      }
      continue;
    }

    let matchedLabel = false;
    for (const matcher of labelMatchers) {
      const m = text.match(matcher.regex);
      if (m) {
        activeField = matcher.fieldName;
        const valPart = (m[1] ?? '').trim();
        if (valPart) {
          current.values[activeField] = current.values[activeField]
            ? `${current.values[activeField]} ${valPart}`
            : valPart;
        }
        matchedLabel = true;
        lastStandaloneLine = '';
        break;
      }
    }
    if (matchedLabel) continue;

    const isLikelyNextTitle =
      activeField !== null &&
      activeField !== 'goods_or_services' &&
      activeField !== 'applicant_name_address' &&
      text.length <= 50 &&
      !text.includes(':') &&
      line.minX > 140 &&
      /^[A-Z0-9 .+&'-]+$/.test(text);

    if (isLikelyNextTitle && activeField !== null) {
      lastStandaloneLine = text;
      current.values[activeField] = current.values[activeField]
        ? `${current.values[activeField]} ${text}`
        : text;
    } else if (activeField !== null) {
      current.values[activeField] = current.values[activeField]
        ? `${current.values[activeField]} ${text}`
        : text;
      lastStandaloneLine = '';
    }
  }

  flushCurrent();

  const headers = schema.fields.map((f) => f.name);
  const rows = records.map((rec) => ({
    cells: headers.map((h) => rec.values[h] ?? ''),
  }));
  const firstPage = records[0]?.pageNumber ?? (filtered[0]?.pageNumber || 1);
  const lastPage =
    records[records.length - 1]?.pageNumber ??
    (filtered[filtered.length - 1]?.pageNumber || firstPage);

  return {
    title: schema.targetTableName || 'extracted_records',
    formatType: 'multi_page_ledger',
    pageRange: firstPage === lastPage ? `${firstPage}` : `${firstPage}-${lastPage}`,
    headers,
    rows,
  };
}

function splitLineIntoSegments(line: VisualLine): Array<{ x: number; text: string }> {
  if (line.items.length === 0) return [];
  const segments: Array<{ x: number; text: string }> = [];
  let curText = line.items[0].str;
  let curX = line.items[0].x;
  let prevEnd = line.items[0].x + Math.max(line.items[0].width, line.items[0].str.length * 4);

  for (let i = 1; i < line.items.length; i++) {
    const item = line.items[i];
    const gap = item.x - prevEnd;
    if (gap >= 14) {
      if (curText.trim()) segments.push({ x: curX, text: curText.trim() });
      curX = item.x;
      curText = item.str;
    } else {
      if (gap > 1.5 && !curText.endsWith(' ') && !item.str.startsWith(' ')) {
        curText += ' ';
      }
      curText += item.str;
    }
    prevEnd = item.x + Math.max(item.width, item.str.length * 4);
  }
  if (curText.trim()) segments.push({ x: curX, text: curText.trim() });
  return segments;
}

function extractCoordinateTables(lines: VisualLine[]): ExtractedTable[] {
  const blocks: Array<{
    pageStart: number;
    pageEnd: number;
    rows: Array<Array<{ x: number; text: string }>>;
  }> = [];
  let activeBlock: {
    pageStart: number;
    pageEnd: number;
    rows: Array<Array<{ x: number; text: string }>>;
  } | null = null;

  for (const line of lines) {
    const segs = splitLineIntoSegments(line);
    if (segs.length >= 2) {
      if (!activeBlock) {
        activeBlock = { pageStart: line.pageNumber, pageEnd: line.pageNumber, rows: [segs] };
      } else {
        activeBlock.pageEnd = line.pageNumber;
        activeBlock.rows.push(segs);
      }
    } else {
      if (activeBlock && activeBlock.rows.length >= 2) {
        blocks.push(activeBlock);
      }
      activeBlock = null;
    }
  }
  if (activeBlock && activeBlock.rows.length >= 2) {
    blocks.push(activeBlock);
  }

  const tables: ExtractedTable[] = [];
  for (const block of blocks) {
    const allXs = block.rows.flatMap((r) => r.map((s) => s.x)).sort((a, b) => a - b);
    const anchors: number[] = [];
    for (const x of allXs) {
      const matchIdx = anchors.findIndex((a) => Math.abs(a - x) <= 28);
      if (matchIdx === -1) anchors.push(x);
    }
    anchors.sort((a, b) => a - b);
    if (anchors.length < 2 || anchors.length > 20) continue;

    const alignedRows = block.rows.map((segs) => {
      const cells = new Array<string>(anchors.length).fill('');
      for (const seg of segs) {
        let bestIdx = 0;
        let bestDist = Infinity;
        anchors.forEach((a, idx) => {
          const dist = Math.abs(a - seg.x);
          if (dist < bestDist) {
            bestDist = dist;
            bestIdx = idx;
          }
        });
        cells[bestIdx] = cells[bestIdx] ? `${cells[bestIdx]} ${seg.text}` : seg.text;
      }
      return cells;
    });

    const headers = alignedRows[0].map((h, i) => h || `column_${i + 1}`);
    const bodyRows = alignedRows.slice(1).map((cells) => ({ cells }));
    if (bodyRows.length === 0) continue;

    const prevTable = tables[tables.length - 1];
    const sameHeaders =
      prevTable &&
      prevTable.headers.length === headers.length &&
      prevTable.headers.every((h, i) => h.toLowerCase() === headers[i].toLowerCase());
    const range =
      block.pageStart === block.pageEnd
        ? `${block.pageStart}`
        : `${block.pageStart}-${block.pageEnd}`;

    if (sameHeaders) {
      prevTable.rows.push(...bodyRows);
      prevTable.formatType = 'multi_page_ledger';
      const pStart = prevTable.pageRange.split('-')[0];
      const pEnd = range.includes('-') ? range.split('-')[1] : range;
      prevTable.pageRange = pStart === pEnd ? pStart : `${pStart}-${pEnd}`;
    } else {
      tables.push({
        title: `detected_table_${tables.length + 1}`,
        formatType: block.pageStart !== block.pageEnd ? 'multi_page_ledger' : 'borderless_aligned',
        pageRange: range,
        headers,
        rows: bodyRows,
      });
    }
  }

  return tables.slice(0, 30);
}

function inferDataType(value: string): ExtractedField['dataType'] {
  const v = value.trim();
  if (/^\$?\s*[-+]?[\d,]+(?:\.\d{2})?$/.test(v) && v.includes('$')) return 'currency';
  if (/^[-+]?\d+(?:\.\d+)?$/.test(v)) return 'number';
  if (/^\d{4}-\d{2}-\d{2}$|^\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}$/.test(v)) return 'date';
  if (/^(true|false|yes|no)$/i.test(v)) return 'boolean';
  return 'string';
}

function extractKeyValueFields(
  lines: VisualLine[],
  schema: ExtractionSchemaTemplate,
  normalizeDates: boolean
): ExtractedField[] {
  const fields: ExtractedField[] = [];
  const seen = new Set<string>();
  for (const line of lines) {
    const kv = line.text.match(/^([A-Za-z0-9 &/'()#.-]{2,42}?):\s+(.+)$/);
    if (!kv) continue;
    const rawLabel = kv[1].trim();
    const rawVal = kv[2].trim();
    if (!rawVal || rawLabel.length < 2) continue;

    let mappedKey = rawLabel
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '');
    let mappedType = inferDataType(rawVal);

    for (const sf of schema.fields) {
      const hit = (sf.sourceLabels ?? []).some(
        (lbl) => lbl.replace(/:$/, '').trim().toLowerCase() === rawLabel.toLowerCase()
      );
      if (hit || sf.name.toLowerCase() === mappedKey) {
        mappedKey = sf.name;
        mappedType = sf.type;
        break;
      }
    }

    const dedupe = `${mappedKey}::${line.pageNumber}`;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    fields.push({
      key: mappedKey.slice(0, 80),
      value: (mappedType === 'date' && normalizeDates
        ? normalizeDateString(rawVal)
        : rawVal
      ).slice(0, 500),
      dataType: mappedType,
      confidence: 'high',
      pageNumber: line.pageNumber,
    });
    if (fields.length >= 150) break;
  }
  return fields;
}

export async function extractDocumentOffline(
  options: OfflineExtractOptions
): Promise<FolioParseDocumentResult> {
  const {
    file,
    mimeType,
    schema,
    startPage,
    endPage,
    ocrMode,
    enhanceScanContrast,
    normalizeDates,
    onProgress,
  } = options;

  onProgress?.(8, 'Loading document');
  const rawBuffer = await file.arrayBuffer();
  let totalPages = 1;
  const frontLines: VisualLine[] = [];
  const dataLines: VisualLine[] = [];
  const ocrPages: OcrPage[] = [];
  let ocrUsed = false;

  if (mimeType === 'application/pdf') {
    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(rawBuffer) });
    const pdf = await loadingTask.promise;
    totalPages = pdf.numPages;

    const effectiveStart = Math.min(Math.max(1, startPage), totalPages);
    const effectiveEnd = endPage
      ? Math.min(Math.max(effectiveStart, endPage), totalPages)
      : totalPages;

    for (let p = 1; p < effectiveStart; p++) {
      const page = await pdf.getPage(p);
      const textContent = await page.getTextContent();
      const positioned: PositionedItem[] = [];
      for (const item of textContent.items) {
        if ('str' in item) {
          positioned.push({
            x: item.transform[4],
            y: item.transform[5],
            width: item.width,
            str: item.str,
          });
        }
      }
      frontLines.push(...groupItemsIntoLines(p, positioned));
    }

    const totalRange = Math.max(1, effectiveEnd - effectiveStart + 1);
    for (let p = effectiveStart; p <= effectiveEnd; p++) {
      const pct = 15 + Math.round(((p - effectiveStart + 1) / totalRange) * 70);
      onProgress?.(pct, `Parsing page ${p} of ${effectiveEnd}`);

      const page = await pdf.getPage(p);
      const textContent = await page.getTextContent();
      const positioned: PositionedItem[] = [];
      for (const item of textContent.items) {
        if ('str' in item) {
          positioned.push({
            x: item.transform[4],
            y: item.transform[5],
            width: item.width,
            str: item.str,
          });
        }
      }

      let pageLines = groupItemsIntoLines(p, positioned);
      const charCount = pageLines.reduce((acc, l) => acc + l.text.length, 0);

      if (charCount < 25) {
        ocrUsed = true;
        onProgress?.(pct, `Running offline OCR on scanned page ${p}`);
        const viewport = page.getViewport({ scale: ocrMode === 'high_accuracy' ? 2.2 : 1.5 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          await page.render({ canvas, canvasContext: ctx, viewport }).promise;
          const ocrResult = await runOcrOnCanvasOrBlob(canvas, p);
          pageLines = ocrResult.lines;
          ocrPages.push({
            pageNumber: p,
            text: ocrResult.text.slice(0, 6000),
            confidenceNote: `Offline OCR (${ocrResult.confidence}% confidence)`,
          });
        }
      } else {
        ocrPages.push({
          pageNumber: p,
          text: pageLines
            .map((l) => l.text)
            .join('\n')
            .slice(0, 6000),
          confidenceNote: 'Embedded PDF vector text',
        });
      }

      dataLines.push(...pageLines);
    }
  } else {
    ocrUsed = true;
    onProgress?.(35, 'Enhancing scan contrast & running offline OCR');
    const targetFile = enhanceScanContrast ? await preprocessScannedImage(file) : file;
    const ocrResult = await runOcrOnCanvasOrBlob(targetFile, 1);
    dataLines.push(...ocrResult.lines);
    ocrPages.push({
      pageNumber: 1,
      text: ocrResult.text.slice(0, 6000),
      confidenceNote: `Offline OCR (${ocrResult.confidence}% confidence)`,
    });
  }

  onProgress?.(90, 'Mapping extracted records');

  const hasJournalMarkers = dataLines.some((l) => /^Advertised under section/i.test(l.text));
  const effectiveSchema: ExtractionSchemaTemplate =
    schema.recordDelimiter || !hasJournalMarkers
      ? schema
      : {
          ...schema,
          targetTableName: 'trademark_applications',
          recordDelimiter: 'Advertised under section',
          stripHeaderPattern: '^THE TRADE MARKS JOURNAL',
        };

  let fields: ExtractedField[] = [];
  let tables: ExtractedTable[] = [];
  let documentType = 'Document';

  if (effectiveSchema.recordDelimiter && hasJournalMarkers) {
    documentType = 'Trade Marks Journal';
    fields = extractJournalHeaderFields(frontLines.length > 0 ? frontLines : dataLines);
    const mappedTable = parseRepeatingRecordSchema(dataLines, effectiveSchema, normalizeDates);
    if (mappedTable.rows.length > 0) {
      tables = [mappedTable];
    }
  } else {
    fields = extractKeyValueFields(dataLines, effectiveSchema, normalizeDates);
    tables = extractCoordinateTables(dataLines);
  }

  const effectiveStartOut = Math.min(Math.max(1, startPage), totalPages);
  const effectiveEndOut = endPage
    ? Math.min(Math.max(effectiveStartOut, endPage), totalPages)
    : totalPages;
  const totalRows = tables.reduce((sum, t) => sum + t.rows.length, 0);

  onProgress?.(100, 'Completed');

  return {
    id: `fp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    fileName: file.name,
    mimeType,
    fileSizeBytes: file.size,
    pageCount: totalPages,
    startPage: effectiveStartOut,
    endPage: effectiveEndOut,
    schemaPreset: effectiveSchema.name,
    documentType,
    ocrUsed,
    summary: `Pages ${effectiveStartOut}–${effectiveEndOut} of ${totalPages}: ${totalRows} table row(s) across ${tables.length} table(s).`,
    fields: fields.slice(0, 150),
    tables: tables.slice(0, 30),
    ocrPages: ocrPages.slice(0, 50),
  };
}

export function mapFolioParseResultsToJournalCheckRows(
  results: FolioParseDocumentResult[],
  formatDatesDdMmmYy = true
): JournalCheckRow[] {
  const rows: JournalCheckRow[] = [];

  for (const doc of results) {
    for (const table of doc.tables) {
      const lowerHeaders = table.headers.map((h) => h.toLowerCase());
      const idxApp = lowerHeaders.findIndex((h) =>
        ['application_no', 'application no', 'app no', 'tm no', 'trademark'].includes(h)
      );
      const idxTitle = lowerHeaders.findIndex((h) =>
        ['title', 'wordmark', 'trademark title', 'mark'].includes(h)
      );
      const idxClass = lowerHeaders.findIndex((h) => ['class_no', 'class', 'nice_class'].includes(h));
      const idxApplicant = lowerHeaders.findIndex((h) =>
        ['applicant_name_address', 'applicant', 'name and address of applicant'].includes(h)
      );
      const idxAgent = lowerHeaders.findIndex((h) =>
        ['agent_name_address', 'agent', "agent's name and address"].includes(h)
      );
      const idxDate = lowerHeaders.findIndex((h) =>
        ['date_of_filing', 'filing date', 'date', 'document_date'].includes(h)
      );
      const idxPage = lowerHeaders.findIndex((h) =>
        ['page_number', 'page no', 'page'].includes(h)
      );

      table.rows.forEach((tr, rIdx) => {
        const pick = (i: number, fallbackIdx: number) =>
          (tr.cells[i >= 0 ? i : fallbackIdx] || '').trim();

        const rawDate = pick(idxDate, 5);
        let formattedDate = rawDate;
        if (formatDatesDdMmmYy && rawDate) {
          const parsed = parseLooseDate(rawDate);
          if (parsed) formattedDate = formatDdMmmYy(parsed);
        }

        const applicationNo = pick(idxApp, 0);
        const title = pick(idxTitle, 1);
        const classNo = pick(idxClass, 2);
        const applicant = pick(idxApplicant, 3);
        const agent = pick(idxAgent, 4);
        const pageNo = pick(idxPage, 6) || String(doc.startPage || '');

        if (!applicationNo && !title && !applicant) return;

        rows.push({
          id: `jc_fp_${doc.id}_${rIdx}`,
          applicationNo,
          title,
          classNo,
          applicant,
          agent,
          dateOfFiling: formattedDate,
          pageNo,
        });
      });
    }
  }

  return rows;
}
