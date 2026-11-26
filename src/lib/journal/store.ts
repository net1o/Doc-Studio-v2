import {
  GeneratedJournalDoc,
  JournalCheckRow,
  JournalConfig,
  RecordRow,
  ReviewRow,
} from '../../types/journal';

const STORAGE_KEY = 'journal_monitor_docgen_v2_1';

export interface JournalMonitorState {
  config: JournalConfig;
  journalRows: JournalCheckRow[];
  reviewRows: ReviewRow[];
  records: RecordRow[];
  generatedDocs: GeneratedJournalDoc[];
}

function makeSeedState(): JournalMonitorState {
  const config: JournalConfig = {
    journalNo: '909',
    journalDate: '26-Nov-2026',
    keywordMatchMode: 'word',
    serialPrefix: 'PB-',
    serialPad: 3,
    keywords: [
      'ASTRON',
      'NEXAVOLT',
      'KINETIC',
      'AL-NOOR',
      'VERDANT',
      'CRESTLINE',
    ],
    tmNumbers: ['548291', '548314', '549002', '549188'],
    caseEntries: [
      { tmNumber: '548291', caseNo: 'PB-1042', clientName: 'Astron Engineering Pvt Ltd' },
      { tmNumber: '548314', caseNo: 'PB-1088', clientName: 'Al-Noor Textiles' },
      { tmNumber: '549002', caseNo: 'PB-1104', clientName: 'Kinetic Power Systems' },
      { tmNumber: '549188', caseNo: 'PB-1129', clientName: 'Verdant Foods' },
    ],
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
      return seed;
    }
    const parsed = JSON.parse(raw) as JournalMonitorState;
    if (!parsed || !parsed.config || !Array.isArray(parsed.journalRows)) {
      return makeSeedState();
    }
    return parsed;
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
  return seed;
}
