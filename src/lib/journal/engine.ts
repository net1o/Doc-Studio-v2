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

export function parseDelimitedJournalInput(rawText: string): JournalCheckRow[] {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];

  const delimiter = lines[0].includes('\t') ? '\t' : ',';
  const splitLine = (line: string): string[] => {
    if (delimiter === '\t') return line.split('\t').map((c) => c.trim());
    const cells: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        cells.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    cells.push(current.trim());
    return cells;
  };

  const firstCells = splitLine(lines[0]).map((c) => c.toLowerCase());
  const looksLikeHeader =
    firstCells.some((c) => c.includes('application')) ||
    firstCells.some((c) => c.includes('title'));

  const startIdx = looksLikeHeader ? 1 : 0;
  const rows: JournalCheckRow[] = [];

  for (let i = startIdx; i < lines.length; i++) {
    const cols = splitLine(lines[i]);
    if (cols.every((c) => !c)) continue;
    rows.push({
      id: `jc_${Date.now().toString(36)}_${i}_${Math.random().toString(36).slice(2, 5)}`,
      applicationNo: cols[0] || '',
      title: cols[1] || '',
      classNo: cols[2] || '',
      applicant: cols[3] || '',
      agent: cols[4] || '',
      dateOfFiling: cols[5] || '',
      pageNo: cols[6] || '',
    });
  }

  return rows;
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
