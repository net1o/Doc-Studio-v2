import {
  GeneratedJournalDoc,
  JournalCheckRow,
  JournalConfig,
  RecordRow,
  ReviewRow,
} from '../../types/journal';

import {
  DEFAULT_APPS_SCRIPT_CASE_SHEET_ID,
  DEFAULT_APPS_SCRIPT_CASE_SHEET_NAME,
  USER_WATCHLIST_KEYWORDS,
  USER_WATCHLIST_TM_NUMBERS,
} from './watchlistSeed';

const STORAGE_KEY = 'journal_monitor_docgen_v2_1';
const WATCHLIST_MIGRATION_KEY = 'journal_monitor_watchlist_seed_v1';
const DB_SEED_MIGRATION_KEY = 'journal_monitor_db_seed_v3';

export interface JournalMonitorState {
  config: JournalConfig;
  journalRows: JournalCheckRow[];
  reviewRows: ReviewRow[];
  records: RecordRow[];
  generatedDocs: GeneratedJournalDoc[];
}

function dedupeStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const v = raw.trim();
    if (!v || seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

function makeSeedState(): JournalMonitorState {
  const config: JournalConfig = {
    journalNo: '909',
    journalDate: '26-Nov-2026',
    keywordMatchMode: 'word',
    serialPrefix: 'PB-',
    serialPad: 3,
    keywords: dedupeStrings(USER_WATCHLIST_KEYWORDS),
    tmNumbers: dedupeStrings(USER_WATCHLIST_TM_NUMBERS),
    caseEntries: [
      {
        id: 'REC-2403',
        date: '26-Oct-26',
        prefix: 'X',
        clientCode: 'ASSIGHN',
        rawCaseNo: 'SULMAN',
        caseNo: 'X-ASSIGHN-SULMAN',
        clientName: '',
        applicationName: 'ASSIGHN TO SULMAN LIST',
        tmNumber: '868677',
        classNo: '-',
        status: 'STAGE 2',
        subStatus: 'ASSIGNED',
        caseType: 'TM',
        agent: 'SULEMAN',
        tm5: 'FALSE',
        tm6: 'FALSE',
        tm11: 'FALSE',
        tm16: 'FALSE',
        tm56: 'FALSE',
      },
      {
        id: 'REC-2395',
        date: '26-Oct-26',
        prefix: 'X',
        clientCode: 'ASSIGHN',
        rawCaseNo: 'SULMAN',
        caseNo: 'X-ASSIGHN-SULMAN',
        clientName: '',
        applicationName: 'ASSIGHN TO SULMAN LIST',
        tmNumber: '871539',
        classNo: '-',
        status: 'STAGE 2',
        subStatus: 'ASSIGNED',
        caseType: 'TM',
        agent: 'SULEMAN',
        tm5: 'FALSE',
        tm6: 'FALSE',
        tm11: 'FALSE',
        tm16: 'FALSE',
        tm56: 'FALSE',
      },
      {
        id: 'REC-2379',
        date: '26-Oct-26',
        prefix: 'X',
        clientCode: 'ASSIGHN',
        rawCaseNo: 'SULMAN',
        caseNo: 'X-ASSIGHN-SULMAN',
        clientName: '',
        applicationName: 'ASSIGHN TO SULMAN LIST',
        tmNumber: '835736',
        classNo: '-',
        status: 'STAGE 2',
        subStatus: 'ASSIGNED',
        caseType: 'TM',
        agent: 'SULEMAN',
        tm5: 'FALSE',
        tm6: 'FALSE',
        tm11: 'FALSE',
        tm16: 'FALSE',
        tm56: 'FALSE',
      },
      {
        tmNumber: '590630',
        caseNo: 'A-32-4',
        prefix: 'A',
        clientCode: '32',
        rawCaseNo: '4',
        clientName: '',
        applicationName: 'ITL',
        classNo: '3',
        status: 'STAGE 3',
        subStatus: 'D-NOTE SUBMITTED',
        caseType: 'TM',
        date: '10-Mar-22',
        tm5: 'FALSE',
        tm6: 'FALSE',
        tm11: 'TRUE',
        tm16: 'FALSE',
        tm56: 'FALSE',
        lastModified: '10-Mar-22 12:00 AM',
      },
      {
        tmNumber: '583969',
        caseNo: 'X-307-1',
        prefix: 'X',
        clientCode: '307',
        rawCaseNo: '1',
        clientName: '',
        applicationName: 'ORAKAL',
        classNo: '16',
        status: 'STAGE 3',
        subStatus: 'D-NOTE SUBMITTED',
        caseType: 'TM',
        date: '11-Apr-22',
        tm5: 'FALSE',
        tm6: 'FALSE',
        tm11: 'TRUE',
        tm16: 'FALSE',
        tm56: 'FALSE',
        lastModified: '11-Apr-22 12:00 AM',
      },
      {
        tmNumber: '583970',
        caseNo: 'X-307-2',
        prefix: 'X',
        clientCode: '307',
        rawCaseNo: '2',
        clientName: '',
        applicationName: 'DELTA STAR',
        classNo: '16',
        status: 'STAGE 3',
        subStatus: 'D-NOTE SUBMITTED',
        caseType: 'TM',
        date: '11-Apr-22',
        tm5: 'FALSE',
        tm6: 'FALSE',
        tm11: 'TRUE',
        tm16: 'FALSE',
        tm56: 'FALSE',
        lastModified: '11-Apr-22 12:00 AM',
      },
      {
        tmNumber: '582722',
        caseNo: 'A-005-2',
        prefix: 'A',
        clientCode: '005',
        rawCaseNo: '2',
        clientName: '',
        applicationName: 'NAEEM INFEX',
        classNo: '9',
        status: 'STAGE 3',
        subStatus: 'D-NOTE SUBMITTED',
        caseType: 'TM',
        date: '21-Apr-22',
        tm5: 'FALSE',
        tm6: 'FALSE',
        tm11: 'TRUE',
        tm16: 'FALSE',
        tm56: 'FALSE',
        lastModified: '21-Apr-22 12:00 AM',
      },
      { tmNumber: '548291', caseNo: 'PB-1042', clientName: 'Astron Engineering Pvt Ltd', caseType: 'TM' },
      { tmNumber: '548314', caseNo: 'PB-1088', clientName: 'Al-Noor Textiles', caseType: 'TM' },
      { tmNumber: '549002', caseNo: 'PB-1104', clientName: 'Kinetic Power Systems', caseType: 'TM' },
      { tmNumber: '549188', caseNo: 'PB-1129', clientName: 'Verdant Foods', caseType: 'TM' },
    ],
    caseSheetConfig: {
      sheetUrlOrId: DEFAULT_APPS_SCRIPT_CASE_SHEET_ID,
      sheetName: DEFAULT_APPS_SCRIPT_CASE_SHEET_NAME,
      keyCol: 8,
      prefixCol: 3,
      clientCodeCol: 4,
      caseCol: 5,
      clientCol: 6,
      appNameCol: 7,
      caseSeparator: '-',
    },
  };

  const journalRows: JournalCheckRow[] = [
    {
      id: 'jc_1',
      applicationNo: '548291',
      title: 'ASTRON VOLT',
      classNo: '9',
      applicant: 'Horizon Electrical Works, Plot 14 Industrial Area, Lahore',
      agent: 'Siddiqui & Co. IP Attorneys, Islamabad',
      dateOfFiling: '14-Oct-25',
      pageNo: '42',
    },
    {
      id: 'jc_2',
      applicationNo: '551904',
      title: 'KINETIC FLOW',
      classNo: '7',
      applicant: 'Metro Machinery Traders, SITE Phase II, Karachi',
      agent: 'Crescent Law Chambers, Karachi',
      dateOfFiling: '03-Nov-25',
      pageNo: '87',
    },
    {
      id: 'jc_3',
      applicationNo: '548314',
      title: 'AL-NOOR ROYAL',
      classNo: '24',
      applicant: 'Al-Noor Looms International, Faisalabad',
      agent: 'Raza IP Associates, Lahore',
      dateOfFiling: '19/09/2025',
      pageNo: '115',
    },
    {
      id: 'jc_4',
      applicationNo: '552410',
      title: 'NEXAVOLT PRO',
      classNo: '11',
      applicant: 'Beacon Lighting Industries, Gujranwala',
      agent: 'Self / Direct Filing',
      dateOfFiling: '22-Aug-25',
      pageNo: '134',
    },
    {
      id: 'jc_5',
      applicationNo: '553012',
      title: 'BLUE HARBOR',
      classNo: '35',
      applicant: 'Harbor Retail Group, Clifton Block 4, Karachi',
      agent: 'Direct Filing',
      dateOfFiling: '01-Oct-25',
      pageNo: '168',
    },
    {
      id: 'jc_6',
      applicationNo: '549002',
      title: 'KINETIC ENERGY',
      classNo: '42',
      applicant: 'Prime Grid Labs, Blue Area, Islamabad',
      agent: 'Haroon & Partners, Islamabad',
      dateOfFiling: '11-Sep-25',
      pageNo: '204',
    },
  ];

  const reviewRows: ReviewRow[] = [
    {
      id: 'rev_seed_1',
      journalNo: '909',
      journalDate: '26-Nov-2026',
      applicationNo: '548291',
      caseNo: 'PB-1042 - Astron Engineering Pvt Ltd',
      title: 'ASTRON VOLT',
      classNo: '9',
      applicant: 'Horizon Electrical Works, Plot 14 Industrial Area, Lahore',
      agent: 'Siddiqui & Co. IP Attorneys, Islamabad',
      dateOfFiling: '14-Oct-25',
      matchedTerm: '548291',
      matchType: 'TM',
      decision: 'ISSUE - OPPOSE',
      status: 'GENERATED',
      generatedDocId: 'gdoc_seed_1',
      generatedPdfReady: true,
      generatedAt: '2026-11-26T09:30:00.000Z',
      pageNo: '42',
    },
    {
      id: 'rev_seed_2',
      journalNo: '909',
      journalDate: '26-Nov-2026',
      applicationNo: '551904',
      caseNo: 'NOT FOUND',
      title: 'KINETIC FLOW',
      classNo: '7',
      applicant: 'Metro Machinery Traders, SITE Phase II, Karachi',
      agent: 'Crescent Law Chambers, Karachi',
      dateOfFiling: '03-Nov-25',
      matchedTerm: 'KINETIC',
      matchType: 'KEYWORD',
      decision: 'ISSUE - OPPOSE',
      status: 'MAILMERGE',
      generatedDocId: '',
      generatedPdfReady: false,
      generatedAt: '',
      pageNo: '87',
    },
    {
      id: 'rev_seed_3',
      journalNo: '909',
      journalDate: '26-Nov-2026',
      applicationNo: '548314',
      caseNo: 'PB-1088 - Al-Noor Textiles',
      title: 'AL-NOOR ROYAL',
      classNo: '24',
      applicant: 'Al-Noor Looms International, Faisalabad',
      agent: 'Raza IP Associates, Lahore',
      dateOfFiling: '19-Sep-25',
      matchedTerm: '548314',
      matchType: 'TM',
      decision: 'PENDING REVIEW',
      status: 'REVIEW',
      generatedDocId: '',
      generatedPdfReady: false,
      generatedAt: '',
      pageNo: '115',
    },
  ];

  const generatedDocs: GeneratedJournalDoc[] = [
    {
      id: 'gdoc_seed_1',
      reviewId: 'rev_seed_1',
      serialNo: 'PB-001',
      journalNo: '909',
      journalDate: '26-Nov-2026',
      caseNo: 'PB-1042 - Astron Engineering Pvt Ltd',
      applicationNo: '548291',
      title: 'ASTRON VOLT',
      classNo: '9',
      pageNo: '42',
      dateOfFiling: '14-Oct-25',
      applicant: 'Horizon Electrical Works, Plot 14 Industrial Area, Lahore',
      agent: 'Siddiqui & Co. IP Attorneys, Islamabad',
      publishingDetails: 'Serial: PB-001\nCase No: PB-1042\nPage No: 42 | Filing: 14-Oct-25',
      trademarkField: '548291',
      extraLabel: 'PAGE NO',
      extraValue: '42 (Case PB-1042)',
      imageDataUrl: '',
      pdfGenerated: true,
      createdAt: '2026-11-26T09:30:00.000Z',
      updatedAt: '2026-11-26T09:30:00.000Z',
    },
  ];

  const records: RecordRow[] = [
    {
      id: 'rec_seed_1',
      journalNo: '909',
      journalDate: '26-Nov-2026',
      tmNo: '548291',
      caseNo: 'PB-1042 - Astron Engineering Pvt Ltd',
      classNo: '9',
      applicant: 'Horizon Electrical Works, Plot 14 Industrial Area, Lahore',
      title: 'ASTRON VOLT',
      agent: 'Siddiqui & Co. IP Attorneys, Islamabad',
      applicationNo: '548291',
      dateOfFiling: '14-Oct-25',
      matchedTerm: '548291',
      matchType: 'TM',
      decision: 'ISSUE - OPPOSE',
      remarks: 'Serial PB-001 · Journal 909 Legal 8.5x14',
      docId: 'gdoc_seed_1',
      pdfReady: true,
      createdAt: '2026-11-26T09:30:00.000Z',
      pageNo: '42',
    },
  ];

  return {
    config,
    journalRows,
    reviewRows,
    records,
    generatedDocs,
  };
}

export function loadJournalState(): JournalMonitorState {
  if (typeof window === 'undefined') return makeSeedState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const seed = makeSeedState();
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
      window.localStorage.setItem(WATCHLIST_MIGRATION_KEY, '1');
      return seed;
    }
    const parsed = JSON.parse(raw) as JournalMonitorState;
    if (!parsed || !parsed.config || !Array.isArray(parsed.journalRows)) {
      const seed = makeSeedState();
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
      window.localStorage.setItem(WATCHLIST_MIGRATION_KEY, '1');
      return seed;
    }

    let next = parsed;
    if (window.localStorage.getItem(WATCHLIST_MIGRATION_KEY) !== '1') {
      const seeded = makeSeedState();
      next = {
        ...parsed,
        config: {
          ...parsed.config,
          keywords: dedupeStrings([...seeded.config.keywords, ...(parsed.config.keywords || [])]),
          tmNumbers: dedupeStrings([...seeded.config.tmNumbers, ...(parsed.config.tmNumbers || [])]),
          caseSheetConfig: parsed.config.caseSheetConfig || seeded.config.caseSheetConfig,
        },
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      window.localStorage.setItem(WATCHLIST_MIGRATION_KEY, '1');
    } else if (!parsed.config.caseSheetConfig) {
      const seeded = makeSeedState();
      next = {
        ...parsed,
        config: {
          ...parsed.config,
          caseSheetConfig: seeded.config.caseSheetConfig,
        },
      };
    }

    if (window.localStorage.getItem(DB_SEED_MIGRATION_KEY) !== '1') {
      const seeded = makeSeedState();
      const existingByTm = new Map<string, typeof seeded.config.caseEntries[number]>();
      for (const item of seeded.config.caseEntries) {
        existingByTm.set(item.tmNumber, item);
      }
      for (const item of next.config.caseEntries || []) {
        existingByTm.set(item.tmNumber, item);
      }
      next = {
        ...next,
        config: {
          ...next.config,
          caseEntries: Array.from(existingByTm.values()),
          caseSheetConfig: {
            ...seeded.config.caseSheetConfig!,
            ...(next.config.caseSheetConfig || {}),
            prefixCol: next.config.caseSheetConfig?.prefixCol ?? 3,
            clientCodeCol: next.config.caseSheetConfig?.clientCodeCol ?? 4,
            caseCol:
              next.config.caseSheetConfig?.caseCol && next.config.caseSheetConfig.caseCol !== 3
                ? next.config.caseSheetConfig.caseCol
                : 5,
            caseSeparator: next.config.caseSheetConfig?.caseSeparator || '-',
          },
        },
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      window.localStorage.setItem(DB_SEED_MIGRATION_KEY, '1');
    }

    return next;
  } catch {
    return makeSeedState();
  }
}

export function saveJournalState(state: JournalMonitorState): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Non-blocking storage fallback
  }
}

export function resetJournalState(): JournalMonitorState {
  const seed = makeSeedState();
  saveJournalState(seed);
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(WATCHLIST_MIGRATION_KEY, '1');
      window.localStorage.setItem(DB_SEED_MIGRATION_KEY, '1');
    } catch {
      // Non-blocking
    }
  }
  return seed;
}
