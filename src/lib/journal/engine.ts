import {
  CaseEntry,
  JournalBreakdown,
  JournalCheckRow,
  JournalConfig,
  JournalStats,
  KeywordMatchMode,
  ReviewRow,
} from '../../types/journal';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function escapeRegExp(str: string): string {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function buildWordBoundaryRegex(keywordLower: string): RegExp {
  const escaped = escapeRegExp(keywordLower);
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i');
}

export function findKeywordHit(
  keywords: string[],
  haystacks: string[],
  mode: KeywordMatchMode
): string {
  for (const rawKw of keywords) {
    const kw = rawKw.trim();
    if (!kw) continue;
    const kwLower = kw.toLowerCase();
    const re = mode === 'word' ? buildWordBoundaryRegex(kwLower) : null;

    for (const h of haystacks) {
      const text = String(h || '').toLowerCase();
      if (!text) continue;
      if (mode === 'contains') {
        if (text.includes(kwLower)) return kw;
      } else if (re && re.test(text)) {
        return kw;
      }
    }
  }
  return '';
}

export function buildCaseMap(entries: CaseEntry[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const item of entries) {
    const key = item.tmNumber.trim();
    if (!key) continue;
    const combined = [item.caseNo.trim(), item.clientName.trim()]
      .filter(Boolean)
      .join(' - ');
    if (!map[key]) {
      map[key] = combined || 'NOT FOUND';
    }
  }
  return map;
}

export function parseLooseDate(value: string): Date | null {
  const s = String(value || '').trim();
  if (!s) return null;

  const m = s.match(/^\s*(\d{1,2})[-/]([A-Za-z]{3}|\d{1,2})[-/](\d{2}|\d{4})\s*$/);
  if (m) {
    const dd = parseInt(m[1], 10);
    const mid = m[2];
    const yyRaw = m[3];
    let mm: number | null = null;

    if (/^\d+$/.test(mid)) {
      mm = parseInt(mid, 10);
    } else {
      const idx = MONTHS.findIndex((mon) => mon.toLowerCase() === mid.toLowerCase());
      mm = idx >= 0 ? idx + 1 : null;
    }
    if (!mm || mm < 1 || mm > 12) return null;

    let yyyy: number;
    if (yyRaw.length === 4) {
      yyyy = parseInt(yyRaw, 10);
    } else {
      const yy = parseInt(yyRaw, 10);
      yyyy = yy <= 49 ? 2000 + yy : 1900 + yy;
    }
    const dt = new Date(yyyy, mm - 1, dd);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }

  const native = new Date(s);
  return Number.isNaN(native.getTime()) ? null : native;
}

export function formatDdMmmYy(date: Date): string {
  const dd = String(date.getDate()).padStart(2, '0');
  const mmm = MONTHS[date.getMonth()];
  const yy = String(date.getFullYear()).slice(-2);
  return `${dd}-${mmm}-${yy}`;
}

export function formatDdMmmYyyy(date: Date): string {
  const dd = String(date.getDate()).padStart(2, '0');
  const mmm = MONTHS[date.getMonth()];
  const yyyy = date.getFullYear();
  return `${dd}-${mmm}-${yyyy}`;
}

export function normalizeJournalCheckDates(rows: JournalCheckRow[]): {
  rows: JournalCheckRow[];
  changed: number;
  failed: number;
} {
  let changed = 0;
  let failed = 0;
  const next = rows.map((row) => {
    const parsed = parseLooseDate(row.dateOfFiling);
    if (!parsed) {
      if (row.dateOfFiling.trim()) failed++;
      return row;
    }
    const formatted = formatDdMmmYy(parsed);
    if (formatted !== row.dateOfFiling) changed++;
    return { ...row, dateOfFiling: formatted };
  });
  return { rows: next, changed, failed };
}

export function runJournalScan(
  config: JournalConfig,
  journalRows: JournalCheckRow[],
  existingReviewRows: ReviewRow[]
): {
  newRows: ReviewRow[];
  skippedDuplicate: number;
  totalScanned: number;
} {
  const journalNo = config.journalNo.trim();
  const tmSet = new Set(
    config.tmNumbers.map((s) => s.trim()).filter((s) => /^\d{6}$/.test(s))
  );
  const keywords = config.keywords.map((k) => k.trim()).filter(Boolean);
  const caseMap = buildCaseMap(config.caseEntries);

  const existingKeys = new Set<string>();
  for (const r of existingReviewRows) {
    existingKeys.add(
      `${r.journalNo.trim()}|${r.applicationNo.trim()}|${r.matchType}|${r.matchedTerm.trim()}`
    );
  }

  const newRows: ReviewRow[] = [];
  let skippedDuplicate = 0;

  for (let i = 0; i < journalRows.length; i++) {
    const row = journalRows[i];
    const appNo = row.applicationNo.trim();
    const title = row.title.trim();
    const applicant = row.applicant.trim();
    const agent = row.agent.trim();

    if (!appNo && !title && !applicant && !agent) continue;

    let matchType: 'TM' | 'KEYWORD' | '' = '';
    let matchedTerm = '';

    if (tmSet.has(appNo)) {
      matchType = 'TM';
      matchedTerm = appNo;
    } else {
      const hit = findKeywordHit(
        keywords,
        [appNo, title, row.classNo, applicant, agent, row.dateOfFiling, row.pageNo],
        config.keywordMatchMode
      );
      if (hit) {
        matchType = 'KEYWORD';
        matchedTerm = hit;
      }
    }

    if (!matchType) continue;

    const uniqueKey = `${journalNo}|${appNo}|${matchType}|${matchedTerm}`;
    if (existingKeys.has(uniqueKey)) {
      skippedDuplicate++;
      continue;
    }
    existingKeys.add(uniqueKey);

    const parsedDate = parseLooseDate(row.dateOfFiling);
    const filingDate = parsedDate ? formatDdMmmYy(parsedDate) : row.dateOfFiling;
    const caseNo = caseMap[appNo] || 'NOT FOUND';

    newRows.push({
      id: `rev_${Date.now().toString(36)}_${i}_${Math.random().toString(36).slice(2, 5)}`,
      journalNo,
      journalDate: config.journalDate,
      applicationNo: appNo,
      caseNo,
      title,
      classNo: row.classNo.trim(),
      applicant,
      agent,
      dateOfFiling: filingDate,
      matchedTerm,
      matchType,
      decision: 'PENDING REVIEW',
      status: 'REVIEW',
      generatedDocId: '',
      generatedPdfReady: false,
      generatedAt: '',
      pageNo: row.pageNo.trim(),
    });
  }

  return {
    newRows,
    skippedDuplicate,
    totalScanned: journalRows.length,
  };
}

export function computeReviewStats(
  reviewRows: ReviewRow[],
  filterJournalNo?: string
): JournalStats {
  const byJournal: Record<string, JournalBreakdown> = {};
  let total = 0;
  let tmMatches = 0;
  let keywordMatches = 0;
  let pending = 0;
  let issue = 0;
  let clear = 0;
  let docsGenerated = 0;
  let pdfsGenerated = 0;

  for (const row of reviewRows) {
    const jn = row.journalNo.trim() || 'Unknown';
    if (!byJournal[jn]) byJournal[jn] = { total: 0, issue: 0, docs: 0 };
    byJournal[jn].total++;
    if (row.decision === 'ISSUE - OPPOSE') byJournal[jn].issue++;
    if (row.generatedDocId) byJournal[jn].docs++;

    if (filterJournalNo && jn !== filterJournalNo.trim()) continue;

    total++;
    if (row.matchType === 'TM') tmMatches++;
    else if (row.matchType === 'KEYWORD') keywordMatches++;

    if (row.decision === 'ISSUE - OPPOSE') issue++;
    else if (row.decision === 'NO ISSUE - CLEAR') clear++;
    else pending++;

    if (row.generatedDocId) docsGenerated++;
    if (row.generatedPdfReady) pdfsGenerated++;
  }

  return {
    total,
    tmMatches,
    keywordMatches,
    pending,
    issue,
    clear,
    docsGenerated,
    pdfsGenerated,
    byJournal,
  };
}

export const JOURNAL_IMPORT_COLUMNS = [
  'Application No',
  'Title',
  'Class',
  'Applicant Name and Address',
  'Agent Name and Address',
  'Date of Filing',
  'Page No',
] as const;

export interface JournalImportOptions {
  normalizeDates?: boolean;
  extractEmbeddedPageNo?: boolean;
}

export interface ConvertJournalTextResult {
  rows: JournalCheckRow[];
  totalSegments: number;
  processedCount: number;
  skippedEmpty: number;
  elapsedMs: number;
}

const JOURNAL_HEADER_ARTIFACT_RE =
  /THE\s+TRADE\s+MARKS?\s+JOURNAL\s*\(\s*No\.?\s*\d+[^)]*\)\s*(\d+)?/gi;

function cleanInlineWhitespace(value: string): string {
  return String(value || '')
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function applyPostProcessing(
  row: JournalCheckRow,
  options: JournalImportOptions
): JournalCheckRow {
  let applicant = cleanInlineWhitespace(row.applicant);
  let agent = cleanInlineWhitespace(row.agent);
  let pageNo = cleanInlineWhitespace(row.pageNo);
  const title = cleanInlineWhitespace(row.title);
  let dateOfFiling = cleanInlineWhitespace(row.dateOfFiling);

  if (options.extractEmbeddedPageNo) {
    const extractFromField = (field: string): string => {
      return field
        .replace(JOURNAL_HEADER_ARTIFACT_RE, (_full, pg) => {
          if (pg && !pageNo) {
            pageNo = String(pg).trim();
          }
          return ' ';
        })
        .replace(/\s{2,}/g, ' ')
        .trim();
    };
    applicant = extractFromField(applicant);
    agent = extractFromField(agent);
  }

  if (options.normalizeDates && dateOfFiling) {
    const parsed = parseLooseDate(dateOfFiling);
    if (parsed) {
      dateOfFiling = formatDdMmmYy(parsed);
    }
  }

  return {
    ...row,
    applicationNo: cleanInlineWhitespace(row.applicationNo),
    title,
    classNo: cleanInlineWhitespace(row.classNo),
    applicant,
    agent,
    dateOfFiling,
    pageNo,
  };
}

function parseDelimitedMatrix(rawText: string, delimiter: ',' | '\t'): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;

  const text = rawText.replace(/^\uFEFF/, '');

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (delimiter === ',') {
      if (ch === '"') {
        if (inQuotes && text[i + 1] === '"') {
          currentCell += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }

      if (ch === ',' && !inQuotes) {
        currentRow.push(currentCell);
        currentCell = '';
        continue;
      }
    } else {
      if (ch === '"' && !inQuotes && currentCell === '') {
        inQuotes = true;
        continue;
      }
      if (ch === '"' && inQuotes) {
        if (text[i + 1] === '"') {
          currentCell += '"';
          i++;
          continue;
        }
        if (
          text[i + 1] === '\t' ||
          text[i + 1] === '\r' ||
          text[i + 1] === '\n' ||
          i + 1 === text.length
        ) {
          inQuotes = false;
          continue;
        }
      }
      if (ch === '\t' && !inQuotes) {
        currentRow.push(currentCell);
        currentCell = '';
        continue;
      }
    }

    if ((ch === '\r' || ch === '\n') && !inQuotes) {
      if (ch === '\r' && text[i + 1] === '\n') {
        i++;
      }
      currentRow.push(currentCell);
      if (currentRow.some((cell) => cell.trim() !== '')) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentCell = '';
      continue;
    }

    currentCell += ch;
  }

  currentRow.push(currentCell);
  if (currentRow.some((cell) => cell.trim() !== '')) {
    rows.push(currentRow);
  }

  return rows;
}

function resolveColumnMapping(headerCells: string[]): Record<keyof Omit<JournalCheckRow, 'id'>, number> | null {
  const normalized = headerCells.map((c) => c.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim());
  const looksLikeHeader =
    normalized.some((c) => c.includes('application') || c === 'app no' || c === 'tm no') &&
    normalized.some((c) => c.includes('title') || c.includes('class'));

  if (!looksLikeHeader) return null;

  const findIdx = (matchers: ((h: string) => boolean)[], fallback: number): number => {
    for (const matcher of matchers) {
      const idx = normalized.findIndex(matcher);
      if (idx >= 0) return idx;
    }
    return fallback;
  };

  return {
    applicationNo: findIdx([(h) => h.includes('application'), (h) => h === 'app no', (h) => h.includes('tm no')], 0),
    title: findIdx([(h) => h.includes('title'), (h) => h.includes('mark')], 1),
    classNo: findIdx([(h) => h === 'class' || h.includes('class')], 2),
    applicant: findIdx([(h) => h.includes('applicant')], 3),
    agent: findIdx([(h) => h.includes('agent')], 4),
    dateOfFiling: findIdx([(h) => h.includes('filing') || h.includes('date')], 5),
    pageNo: findIdx([(h) => h.includes('page')], 6),
  };
}

export function detectJournalInputFormat(rawText: string): 'journal_text' | 'csv_tsv' {
  const sample = rawText.slice(0, 6000);
  if (
    /Advertised\s+under\s+section\s+28\(1\)/i.test(sample) ||
    (/Application\s+No:\s*\d+/i.test(sample) && /Name\s+and\s+address\s+of\s+Applicant:/i.test(sample))
  ) {
    return 'journal_text';
  }
  return 'csv_tsv';
}

export function parseDelimitedJournalInput(
  rawText: string,
  options: JournalImportOptions = { normalizeDates: true, extractEmbeddedPageNo: true }
): JournalCheckRow[] {
  const trimmed = rawText.trim();
  if (!trimmed) return [];

  const firstLine = trimmed.split(/\r?\n/)[0] || '';
  const tabCount = (firstLine.match(/\t/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;
  const delimiter: '\t' | ',' = tabCount > commaCount ? '\t' : ',';

  const matrix = parseDelimitedMatrix(rawText, delimiter);
  if (matrix.length === 0) return [];

  const mapping = resolveColumnMapping(matrix[0]);
  const startIdx = mapping ? 1 : 0;
  const rows: JournalCheckRow[] = [];

  for (let i = startIdx; i < matrix.length; i++) {
    const cols = matrix[i];
    if (cols.every((c) => !c.trim())) continue;

    const rawRow: JournalCheckRow = {
      id: `jc_${Date.now().toString(36)}_${i}_${Math.random().toString(36).slice(2, 5)}`,
      applicationNo: cols[mapping ? mapping.applicationNo : 0] || '',
      title: cols[mapping ? mapping.title : 1] || '',
      classNo: cols[mapping ? mapping.classNo : 2] || '',
      applicant: cols[mapping ? mapping.applicant : 3] || '',
      agent: cols[mapping ? mapping.agent : 4] || '',
      dateOfFiling: cols[mapping ? mapping.dateOfFiling : 5] || '',
      pageNo: cols[mapping ? mapping.pageNo : 6] || '',
    };

    const processed = applyPostProcessing(rawRow, options);
    if (
      !processed.applicationNo &&
      !processed.title &&
      !processed.applicant &&
      !processed.agent
    ) {
      continue;
    }
    rows.push(processed);
  }

  return rows;
}

/**
 * Browser port of the Excel VBA macro ConvertJournal2():
 * Splits PDF-extracted text on "Advertised under section 28(1) of Trade Mark Ordinance 2001."
 * and extracts Application No, Title, Class, Applicant Name & Address, Agent Name & Address,
 * Date of Filing, and embedded Page No.
 */
export function parseRawJournalTextConvertJournal2(
  rawText: string,
  options: JournalImportOptions = { normalizeDates: true, extractEmbeddedPageNo: true }
): ConvertJournalTextResult {
  const start = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const normalizedText = rawText.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  const splitRegex = /Advertised\s+under\s+section\s+28\(1\)\s+of\s+Trade\s+Mark\s+Ordinance\s+2001\.?/i;
  const segments = normalizedText.split(splitRegex);
  const totalSegments = Math.max(0, segments.length - 1);

  const rows: JournalCheckRow[] = [];
  let skippedEmpty = 0;

  // VBA starts at index 1 (skipping preamble before first Advertisement marker) unless no marker was found
  const startIndex = segments.length > 1 ? 1 : 0;

  for (let i = startIndex; i < segments.length; i++) {
    const recordText = segments[i];
    if (!recordText || !recordText.trim()) {
      skippedEmpty++;
      continue;
    }

    const appNoMatch = recordText.match(/Application\s+No:\s*(\d+)/i);
    const appNo = appNoMatch ? appNoMatch[1].trim() : '';

    let title = '';
    const titleMulti = recordText.match(/Title\s+([\s\S]+?)(?=\n\s*Class:)/i);
    if (titleMulti) {
      title = titleMulti[1];
    } else {
      const titleSingle = recordText.match(/Title\s+([^\n]+)/i);
      if (titleSingle) title = titleSingle[1];
    }

    const classMatch = recordText.match(/Class:\s*(\d+)/i);
    const classNo = classMatch ? classMatch[1].trim() : '';

    const applicantMatch = recordText.match(
      /Name\s+and\s+address\s+of\s+Applicant:\s*([\s\S]+?)(?=\n\s*(?:Agent|Date|Description)|$)/i
    );
    const applicant = applicantMatch ? applicantMatch[1] : '';

    const agentMatch = recordText.match(
      /Agent[’']?s?\s+name\s+And\s+address:\s*([\s\S]+?)(?=\n\s*(?:Description|Date)|$)/i
    );
    const agent = agentMatch ? agentMatch[1] : '';

    const filingMatch = recordText.match(
      /Date\s+of\s+filing:\s*(\d{1,2}[/-](?:\d{1,2}|[A-Za-z]{3})[/-]\d{2,4})/i
    );
    const dateOfFiling = filingMatch ? filingMatch[1].trim() : '';

    const pageMatch =
      recordText.match(/THE\s+TRADE\s+MARKS?\s+JOURNAL\s*\(\s*No\.?\s*\d+[^)]*\)\s*(\d+)/i) ||
      recordText.match(/\bPage\s*(?:No\.?)?:?\s*(\d+)\b/i);
    const pageNo = pageMatch ? pageMatch[1].trim() : '';

    if (!appNo && !title.trim() && !applicant.trim()) {
      skippedEmpty++;
      continue;
    }

    const processed = applyPostProcessing(
      {
        id: `jc_vba_${Date.now().toString(36)}_${i}_${Math.random().toString(36).slice(2, 5)}`,
        applicationNo: appNo,
        title,
        classNo,
        applicant,
        agent,
        dateOfFiling,
        pageNo,
      },
      options
    );

    rows.push(processed);
  }

  const end = typeof performance !== 'undefined' ? performance.now() : Date.now();
  return {
    rows,
    totalSegments,
    processedCount: rows.length,
    skippedEmpty,
    elapsedMs: Math.max(1, Math.round(end - start)),
  };
}

export function exportRowsToCsv(headers: string[], matrix: (string | number | boolean)[][]): string {
  const allRows = [headers, ...matrix];
  return allRows
    .map((row) =>
      row
        .map((val) => {
          const s = val === null || val === undefined ? '' : String(val);
          const escaped = s.replace(/"/g, '""');
          return /[",\n]/.test(escaped) ? `"${escaped}"` : escaped;
        })
        .join(',')
    )
    .join('\n');
}

export function triggerFileDownload(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
