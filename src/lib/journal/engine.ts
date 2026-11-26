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

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  duplicates: string[];
  unique: string[];
}

/**
 * Global duplicate guard comparing incoming TM numbers against existing state
 * before insertion across Analyzer, Watchlist modals, and Database views.
 */
export function checkDuplicate(
  incomingTm: string | string[],
  existingTms: string[]
): DuplicateCheckResult {
  const existingSet = new Set(
    existingTms.map((tm) => String(tm || '').trim().toLowerCase()).filter(Boolean)
  );
  const incomingList = Array.isArray(incomingTm) ? incomingTm : [incomingTm];
  const seenBatch = new Set<string>();
  const duplicates: string[] = [];
  const unique: string[] = [];

  for (const raw of incomingList) {
    const cleaned = String(raw || '').trim();
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (existingSet.has(key) || seenBatch.has(key)) {
      duplicates.push(cleaned);
    } else {
      seenBatch.add(key);
      unique.push(cleaned);
    }
  }

  return {
    isDuplicate: duplicates.length > 0,
    duplicates,
    unique,
  };
}

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

export interface WatchlistImportResult {
  keywords: string[];
  tmNumbers: string[];
  skippedHeaders: number;
  skippedDuplicates: number;
  invalidTmTokens: string[];
}

export function parseWatchlistImport(
  rawText: string,
  target: 'auto' | 'keywords_only' | 'tm_only' = 'auto'
): WatchlistImportResult {
  const trimmed = rawText.replace(/^\uFEFF/, '').trim();
  if (!trimmed) {
    return {
      keywords: [],
      tmNumbers: [],
      skippedHeaders: 0,
      skippedDuplicates: 0,
      invalidTmTokens: [],
    };
  }

  const firstLine = trimmed.split(/\r?\n/)[0] || '';
  const tabCount = (firstLine.match(/\t/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;
  const delimiter: '\t' | ',' = tabCount >= commaCount && tabCount > 0 ? '\t' : ',';

  const matrix =
    tabCount > 0 || commaCount > 0
      ? parseDelimitedMatrix(trimmed, delimiter)
      : trimmed.split(/\r?\n/).map((line) => [line]);

  const keywords: string[] = [];
  const keywordLowerSet = new Set<string>();
  const tmNumbers: string[] = [];
  const tmSet = new Set<string>();
  const invalidTmTokens: string[] = [];
  let skippedHeaders = 0;
  let skippedDuplicates = 0;

  const addKeyword = (rawVal: string) => {
    const cleaned = rawVal.trim();
    if (!cleaned) return;
    const lower = cleaned.toLowerCase();
    if (keywordLowerSet.has(lower)) {
      skippedDuplicates++;
      return;
    }
    keywordLowerSet.add(lower);
    keywords.push(cleaned);
  };

  const addTm = (token: string) => {
    if (tmSet.has(token)) {
      skippedDuplicates++;
      return;
    }
    tmSet.add(token);
    tmNumbers.push(token);
  };

  const isHeaderToken = (val: string) => {
    const low = val.toLowerCase().trim();
    return (
      low === 'keywords' ||
      low === 'keyword' ||
      low === 'tm numbers' ||
      low === 'tm number' ||
      low === 'tm numbers (6-digit)' ||
      low === 'tm no' ||
      low === 'tm/cpr number' ||
      low === 'application no'
    );
  };

  for (const row of matrix) {
    if (target === 'tm_only') {
      for (const cell of row) {
        const tokens = cell.split(/[\s,;]+/).map((t) => t.trim()).filter(Boolean);
        for (const token of tokens) {
          if (isHeaderToken(token)) {
            skippedHeaders++;
            continue;
          }
          if (/^\d{6}$/.test(token)) {
            addTm(token);
          } else {
            invalidTmTokens.push(token);
          }
        }
      }
      continue;
    }

    if (target === 'keywords_only') {
      for (const cell of row) {
        const cleaned = cell.trim().replace(/,+$/, '').trim();
        if (!cleaned) continue;
        if (isHeaderToken(cleaned)) {
          skippedHeaders++;
          continue;
        }
        addKeyword(cleaned);
      }
      continue;
    }

    // Auto mode: supports 2-column Excel paste (Keywords \t TM Numbers (6-digit)) or mixed 1-column
    if (row.length >= 2) {
      const col0 = (row[0] || '').trim().replace(/,+$/, '').trim();
      const col1 = (row[1] || '').trim();

      if (isHeaderToken(col0) || isHeaderToken(col1)) {
        skippedHeaders++;
        continue;
      }

      if (col0) {
        if (/^\d{6}$/.test(col0)) {
          addTm(col0);
        } else {
          addKeyword(col0);
        }
      }

      if (col1) {
        const tokens = col1.split(/[\s,;]+/).map((t) => t.trim()).filter(Boolean);
        for (const token of tokens) {
          if (/^\d{6}$/.test(token)) {
            addTm(token);
          } else {
            invalidTmTokens.push(token);
          }
        }
      }

      for (let extra = 2; extra < row.length; extra++) {
        const cell = (row[extra] || '').trim();
        if (!cell) continue;
        if (/^\d{6}$/.test(cell)) addTm(cell);
      }
    } else {
      const single = (row[0] || '').trim().replace(/,+$/, '').trim();
      if (!single) continue;
      if (isHeaderToken(single)) {
        skippedHeaders++;
        continue;
      }
      if (/^\d{6}$/.test(single)) {
        addTm(single);
      } else {
        addKeyword(single);
      }
    }
  }

  return {
    keywords,
    tmNumbers,
    skippedHeaders,
    skippedDuplicates,
    invalidTmTokens,
  };
}

export function mergeUniqueKeywords(
  existing: string[],
  incoming: string[],
  prependNew = true
): { merged: string[]; added: number; skippedDuplicates: number } {
  const seen = new Set(existing.map((k) => k.trim().toLowerCase()).filter(Boolean));
  const addedList: string[] = [];
  let skippedDuplicates = 0;

  for (const raw of incoming) {
    const cleaned = raw.trim();
    if (!cleaned) continue;
    const lower = cleaned.toLowerCase();
    if (seen.has(lower)) {
      skippedDuplicates++;
      continue;
    }
    seen.add(lower);
    addedList.push(cleaned);
  }

  return {
    merged: prependNew ? [...addedList, ...existing] : [...existing, ...addedList],
    added: addedList.length,
    skippedDuplicates,
  };
}

export function mergeUniqueTmNumbers(
  existing: string[],
  incoming: string[],
  prependNew = true
): { merged: string[]; added: number; skippedDuplicates: number } {
  const seen = new Set(existing.map((t) => t.trim()).filter((t) => /^\d{6}$/.test(t)));
  const addedList: string[] = [];
  let skippedDuplicates = 0;

  for (const raw of incoming) {
    const cleaned = raw.trim();
    if (!/^\d{6}$/.test(cleaned)) continue;
    if (seen.has(cleaned)) {
      skippedDuplicates++;
      continue;
    }
    seen.add(cleaned);
    addedList.push(cleaned);
  }

  return {
    merged: prependNew ? [...addedList, ...existing] : [...existing, ...addedList],
    added: addedList.length,
    skippedDuplicates,
  };
}

export function getJournalRowDedupeKey(row: JournalCheckRow): string {
  const appNo = row.applicationNo.trim();
  if (appNo) return `app:${appNo.toLowerCase()}`;
  return `meta:${row.title.trim().toLowerCase()}|${row.classNo.trim().toLowerCase()}|${row.dateOfFiling.trim().toLowerCase()}`;
}

export function deduplicateJournalCheckRows(
  incoming: JournalCheckRow[],
  existing: JournalCheckRow[] = []
): { uniqueRows: JournalCheckRow[]; skippedDuplicates: number } {
  const seen = new Set<string>(existing.map(getJournalRowDedupeKey));
  const uniqueRows: JournalCheckRow[] = [];
  let skippedDuplicates = 0;

  for (const row of incoming) {
    const key = getJournalRowDedupeKey(row);
    if (seen.has(key)) {
      skippedDuplicates++;
      continue;
    }
    seen.add(key);
    uniqueRows.push(row);
  }

  return { uniqueRows, skippedDuplicates };
}

export function formatCompositeCaseNo(
  prefix?: string,
  clientCode?: string,
  rawCaseNo?: string,
  separator = '-'
): string {
  const parts = [prefix, clientCode, rawCaseNo]
    .map((p) => cleanInlineWhitespace(p || ''))
    .filter(Boolean);
  return parts.join(separator);
}

export interface CaseLookupImportOptions {
  mappingMode?: 'auto' | 'sheet_col8_345' | 'date_start_22col' | 'three_col' | 'custom';
  keyCol?: number;        // 1-based (default 8 = TM/CPR NUMBER)
  prefixCol?: number;     // 1-based (default 3 = TYPE / Prefix)
  clientCodeCol?: number; // 1-based (default 4 = CLIENT CODE)
  caseCol?: number;       // 1-based (default 5 = CASE NUMBER)
  clientCol?: number;     // 1-based (default 6 = CLIENT NAME)
  appNameCol?: number;    // 1-based (default 7 = APPLICATION NAME)
  caseSeparator?: string; // default '-'
}

export interface CaseLookupImportResult {
  entries: CaseEntry[];
  detectedLayout: string;
  skippedRows: number;
  skippedDuplicates: number;
}

export function buildGoogleSheetCsvUrl(sheetUrlOrId: string, sheetName?: string): string {
  const raw = sheetUrlOrId.trim();
  if (!raw) return '';

  if (/[?&](output=csv|format=csv|tqx=out:csv)/i.test(raw)) {
    return raw;
  }

  const idMatch = raw.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  const sheetId = idMatch ? idMatch[1] : /^[a-zA-Z0-9-_]{20,}$/.test(raw) ? raw : '';

  if (!sheetId) {
    return raw;
  }

  const gidMatch = raw.match(/[?#&]gid=(\d+)/);
  const cleanSheetName = (sheetName || '').trim();

  if (cleanSheetName) {
    return `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(
      cleanSheetName
    )}`;
  }

  if (gidMatch) {
    return `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&gid=${gidMatch[1]}`;
  }

  return `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv`;
}

export function parseCaseLookupInput(
  rawText: string,
  options: CaseLookupImportOptions = {}
): CaseLookupImportResult {
  const trimmed = rawText.replace(/^\uFEFF/, '').trim();
  if (!trimmed) {
    return { entries: [], detectedLayout: 'empty', skippedRows: 0, skippedDuplicates: 0 };
  }

  const firstLine = trimmed.split(/\r?\n/)[0] || '';
  const tabCount = (firstLine.match(/\t/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;
  const delimiter: '\t' | ',' = tabCount > commaCount ? '\t' : ',';

  const matrix = parseDelimitedMatrix(trimmed, delimiter);
  if (matrix.length === 0) {
    return { entries: [], detectedLayout: 'empty', skippedRows: 0, skippedDuplicates: 0 };
  }

  const sep = options.caseSeparator || '-';
  const mode = options.mappingMode || 'auto';

  let keyIdx = Math.max(0, (options.keyCol || 8) - 1);
  let prefixIdx = options.prefixCol ? options.prefixCol - 1 : 2;
  let clientCodeIdx = options.clientCodeCol ? options.clientCodeCol - 1 : 3;
  let caseIdx = Math.max(0, (options.caseCol || 5) - 1);
  let clientIdx = options.clientCol ? options.clientCol - 1 : 5;
  let appNameIdx = options.appNameCol ? options.appNameCol - 1 : 6;

  let dateIdx = -1;
  let classIdx = -1;
  let statusIdx = -1;
  let subStatusIdx = -1;
  let caseTypeIdx = -1;
  let agentIdx = -1;

  let startRow = 0;
  let detectedLayout = 'Sheet Col 8 (TM) + Case Cols 3-4-5';

  const headerNorm = matrix[0].map((c) => c.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim());
  const looksLikeHeader =
    headerNorm.some(
      (h) =>
        h.includes('tm') ||
        h.includes('cpr') ||
        h.includes('case number') ||
        h.includes('client code') ||
        h === 'type'
    ) && !headerNorm.some((h) => /^\d{6}$/.test(h));

  if (mode === 'three_col') {
    keyIdx = 0;
    prefixIdx = -1;
    clientCodeIdx = -1;
    caseIdx = 1;
    clientIdx = 2;
    appNameIdx = -1;
    startRow = looksLikeHeader ? 1 : 0;
    detectedLayout = '3-Column (TM No, Case No, Client)';
  } else if (mode === 'sheet_col8_345') {
    keyIdx = 7;
    prefixIdx = 2;
    clientCodeIdx = 3;
    caseIdx = 4;
    clientIdx = 5;
    appNameIdx = 6;
    dateIdx = 1;
    classIdx = 8;
    statusIdx = 9;
    subStatusIdx = 10;
    caseTypeIdx = 11;
    agentIdx = 12;
    startRow = looksLikeHeader ? 1 : 0;
    detectedLayout = 'Sheet Col 8 (TM/CPR) + Case Cols 3-4-5 (A-32-4)';
  } else if (mode === 'date_start_22col') {
    dateIdx = 0;
    prefixIdx = 1;
    clientCodeIdx = 2;
    caseIdx = 3;
    clientIdx = 4;
    appNameIdx = 5;
    keyIdx = 6;
    classIdx = 7;
    statusIdx = 8;
    subStatusIdx = 9;
    caseTypeIdx = 10;
    agentIdx = 11;
    startRow = looksLikeHeader ? 1 : 0;
    detectedLayout = '22-Col DATE-Start Export (TM Col 7 + Case Cols 2-3-4)';
  } else if (mode === 'custom') {
    startRow = looksLikeHeader ? 1 : 0;
    detectedLayout = `Custom (TM Col ${keyIdx + 1} · Case Cols ${[
      prefixIdx >= 0 ? prefixIdx + 1 : null,
      clientCodeIdx >= 0 ? clientCodeIdx + 1 : null,
      caseIdx + 1,
    ]
      .filter(Boolean)
      .join('-')})`;
  } else {
    // Auto-detect
    if (looksLikeHeader) {
      startRow = 1;
      const foundKey = headerNorm.findIndex(
        (h) => h.includes('tm cpr') || h.includes('tm no') || h.includes('cpr') || h === 'tm'
      );
      const foundPrefix = headerNorm.findIndex((h) => h === 'type' || h === 'prefix');
      const foundClientCode = headerNorm.findIndex((h) => h.includes('client code'));
      const foundCase = headerNorm.findIndex((h) => h.includes('case number') || h === 'case no' || h === 'case');
      const foundClient = headerNorm.findIndex((h) => h.includes('client name') || h === 'client');
      const foundAppName = headerNorm.findIndex((h) => h.includes('application name') || h === 'title');
      const foundDate = headerNorm.findIndex((h) => h === 'date');
      const foundClass = headerNorm.findIndex((h) => h === 'class');
      const foundStatus = headerNorm.findIndex((h) => h === 'status');
      const foundSubStatus = headerNorm.findIndex((h) => h.includes('sub status'));
      const foundCaseType = headerNorm.findIndex((h) => h.includes('case type'));
      const foundAgent = headerNorm.findIndex((h) => h === 'agent');

      if (foundKey >= 0 && foundCase >= 0) {
        keyIdx = foundKey;
        prefixIdx = foundPrefix;
        clientCodeIdx = foundClientCode;
        caseIdx = foundCase;
        clientIdx = foundClient;
        appNameIdx = foundAppName;
        dateIdx = foundDate;
        classIdx = foundClass;
        statusIdx = foundStatus;
        subStatusIdx = foundSubStatus;
        caseTypeIdx = foundCaseType;
        agentIdx = foundAgent;
        detectedLayout = `Header-matched (TM Col ${keyIdx + 1} · Case ${
          prefixIdx >= 0 && clientCodeIdx >= 0
            ? `Cols ${prefixIdx + 1}-${clientCodeIdx + 1}-${caseIdx + 1}`
            : `Col ${caseIdx + 1}`
        })`;
      } else if (matrix[0].length >= 8) {
        keyIdx = 7;
        prefixIdx = 2;
        clientCodeIdx = 3;
        caseIdx = 4;
        clientIdx = 5;
        appNameIdx = 6;
        detectedLayout = 'Sheet Col 8 (TM/CPR) + Case Cols 3-4-5';
      } else {
        keyIdx = 0;
        prefixIdx = -1;
        clientCodeIdx = -1;
        caseIdx = 1;
        clientIdx = 2;
        appNameIdx = -1;
        detectedLayout = '3-Column (TM No, Case No, Client)';
      }
    } else {
      const sampleRow = matrix[0];
      const looksDateStart22 =
        sampleRow.length >= 7 &&
        /\d{1,2}[-/][A-Za-z0-9]+[-/]\d{2,4}/.test(sampleRow[0] || '') &&
        /^\d{5,7}$/.test((sampleRow[6] || '').trim());

      if (looksDateStart22) {
        dateIdx = 0;
        prefixIdx = 1;
        clientCodeIdx = 2;
        caseIdx = 3;
        clientIdx = 4;
        appNameIdx = 5;
        keyIdx = 6;
        classIdx = 7;
        statusIdx = 8;
        subStatusIdx = 9;
        caseTypeIdx = 10;
        agentIdx = 11;
        detectedLayout = '22-Col DATE-Start Export (TM Col 7 + Case Cols 2-3-4)';
      } else if (sampleRow.length >= 8) {
        keyIdx = 7;
        prefixIdx = 2;
        clientCodeIdx = 3;
        caseIdx = 4;
        clientIdx = 5;
        appNameIdx = 6;
        dateIdx = 1;
        classIdx = 8;
        statusIdx = 9;
        subStatusIdx = 10;
        caseTypeIdx = 11;
        agentIdx = 12;
        detectedLayout = 'Sheet Col 8 (TM/CPR) + Case Cols 3-4-5';
      } else {
        keyIdx = 0;
        prefixIdx = -1;
        clientCodeIdx = -1;
        caseIdx = 1;
        clientIdx = 2;
        appNameIdx = -1;
        detectedLayout = '3-Column (TM No, Case No, Client)';
      }
    }
  }

  const seen = new Set<string>();
  const entries: CaseEntry[] = [];
  let skippedRows = 0;
  let skippedDuplicates = 0;

  for (let i = startRow; i < matrix.length; i++) {
    const cols = matrix[i];
    const tmNumber = cleanInlineWhitespace(cols[keyIdx] || '');
    const prefix = prefixIdx >= 0 ? cleanInlineWhitespace(cols[prefixIdx] || '') : '';
    const clientCode = clientCodeIdx >= 0 ? cleanInlineWhitespace(cols[clientCodeIdx] || '') : '';
    const rawCaseNo = cleanInlineWhitespace(cols[caseIdx] || '');

    const formattedCaseNo =
      prefixIdx >= 0 || clientCodeIdx >= 0
        ? formatCompositeCaseNo(prefix, clientCode, rawCaseNo, sep)
        : rawCaseNo;

    const clientName = clientIdx >= 0 ? cleanInlineWhitespace(cols[clientIdx] || '') : '';
    const applicationName = appNameIdx >= 0 ? cleanInlineWhitespace(cols[appNameIdx] || '') : '';

    if (!tmNumber || (!formattedCaseNo && !clientName && !applicationName)) {
      skippedRows++;
      continue;
    }

    if (seen.has(tmNumber)) {
      skippedDuplicates++;
      continue;
    }
    seen.add(tmNumber);

    entries.push({
      tmNumber,
      caseNo: formattedCaseNo || 'NOT FOUND',
      clientName,
      prefix: prefix || undefined,
      clientCode: clientCode || undefined,
      rawCaseNo: rawCaseNo || undefined,
      applicationName: applicationName || undefined,
      classNo: classIdx >= 0 ? cleanInlineWhitespace(cols[classIdx] || '') || undefined : undefined,
      status: statusIdx >= 0 ? cleanInlineWhitespace(cols[statusIdx] || '') || undefined : undefined,
      subStatus:
        subStatusIdx >= 0 ? cleanInlineWhitespace(cols[subStatusIdx] || '') || undefined : undefined,
      caseType:
        caseTypeIdx >= 0 ? cleanInlineWhitespace(cols[caseTypeIdx] || '') || undefined : undefined,
      agent: agentIdx >= 0 ? cleanInlineWhitespace(cols[agentIdx] || '') || undefined : undefined,
      date: dateIdx >= 0 ? cleanInlineWhitespace(cols[dateIdx] || '') || undefined : undefined,
    });
  }

  return { entries, detectedLayout, skippedRows, skippedDuplicates };
}

export function mergeDatabaseEntries(
  existing: CaseEntry[],
  incoming: CaseEntry[],
  duplicatePolicy: 'skip' | 'update' = 'skip'
): { merged: CaseEntry[]; added: number; skippedDuplicates: number; updated: number } {
  const byTm = new Map<string, CaseEntry>();
  for (const item of existing) {
    const key = item.tmNumber.trim();
    if (key && !byTm.has(key)) byTm.set(key, item);
  }

  let added = 0;
  let skippedDuplicates = 0;
  let updated = 0;
  const newOnes: CaseEntry[] = [];

  for (const item of incoming) {
    const key = item.tmNumber.trim();
    if (!key) continue;
    if (byTm.has(key)) {
      if (duplicatePolicy === 'update') {
        byTm.set(key, item);
        updated++;
      } else {
        skippedDuplicates++;
      }
    } else {
      byTm.set(key, item);
      newOnes.push(item);
      added++;
    }
  }

  if (duplicatePolicy === 'skip') {
    return {
      merged: [...newOnes, ...existing],
      added,
      skippedDuplicates,
      updated: 0,
    };
  }

  // When updating, keep existing order updated + prepend newly added entries
  const existingUpdated = existing.map((e) => byTm.get(e.tmNumber.trim()) || e);
  return {
    merged: [...newOnes, ...existingUpdated],
    added,
    skippedDuplicates: 0,
    updated,
  };
}

export function refreshReviewCaseNumbers(
  reviewRows: ReviewRow[],
  caseEntries: CaseEntry[]
): { rows: ReviewRow[]; updatedCount: number } {
  const caseMap = buildCaseMap(caseEntries);
  let updatedCount = 0;
  const rows = reviewRows.map((row) => {
    const mapped = caseMap[row.applicationNo.trim()];
    if (mapped && mapped !== row.caseNo) {
      updatedCount++;
      return { ...row, caseNo: mapped };
    }
    return row;
  });
  return { rows, updatedCount };
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
