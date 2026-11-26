export type KeywordMatchMode = 'word' | 'contains';
export type MatchType = 'TM' | 'KEYWORD';
export type ReviewDecision = 'PENDING REVIEW' | 'ISSUE - OPPOSE' | 'NO ISSUE - CLEAR';
export type ReviewStatus = 'REVIEW' | 'MAILMERGE' | 'GENERATED';
export type AppTab =
  | 'analyzer'
  | 'journalcheck'
  | 'review'
  | 'generator'
  | 'database'
  | 'records'
  | 'settings'
  | 'backup';

export interface CaseEntry {
  tmNumber: string;
  caseNo: string;
  clientName: string;
  prefix?: string;
  clientCode?: string;
  rawCaseNo?: string;
  applicationName?: string;
  classNo?: string;
  status?: string;
  subStatus?: string;
  caseType?: string;
  agent?: string;
  date?: string;
}

export interface CaseSheetConfig {
  sheetUrlOrId: string;
  sheetName: string;
  keyCol: number;
  prefixCol?: number;
  clientCodeCol?: number;
  caseCol: number;
  clientCol: number;
  appNameCol?: number;
  caseSeparator?: string;
  lastSyncedAt?: string;
}

export type PaperSizePreset =
  | 'legal'
  | 'letter'
  | 'a4'
  | 'a5'
  | 'a3'
  | 'tabloid'
  | 'executive'
  | 'custom';

export type PaperUnit = 'in' | 'mm';
export type PaperOrientation = 'portrait' | 'landscape';

export interface PaperSizeConfig {
  preset: PaperSizePreset;
  orientation: PaperOrientation;
  customWidth: number;
  customHeight: number;
  customUnit: PaperUnit;
}

export interface JournalConfig {
  journalNo: string;
  journalDate: string;
  keywordMatchMode: KeywordMatchMode;
  serialPrefix: string;
  serialPad: number;
  keywords: string[];
  tmNumbers: string[];
  caseEntries: CaseEntry[];
  caseSheetConfig?: CaseSheetConfig;
  paperSize?: PaperSizeConfig;
}

export interface JournalCheckRow {
  id: string;
  applicationNo: string;
  title: string;
  classNo: string;
  applicant: string;
  agent: string;
  dateOfFiling: string;
  pageNo: string;
}

export interface ReviewRow {
  id: string;
  journalNo: string;
  journalDate: string;
  applicationNo: string;
  caseNo: string;
  title: string;
  classNo: string;
  applicant: string;
  agent: string;
  dateOfFiling: string;
  matchedTerm: string;
  matchType: MatchType;
  decision: ReviewDecision;
  status: ReviewStatus;
  generatedDocId: string;
  generatedPdfReady: boolean;
  generatedAt: string;
  pageNo: string;
}

export interface RecordRow {
  id: string;
  journalNo: string;
  journalDate: string;
  tmNo: string;
  caseNo: string;
  classNo: string;
  applicant: string;
  title: string;
  agent: string;
  applicationNo: string;
  dateOfFiling: string;
  matchedTerm: string;
  matchType: MatchType;
  decision: string;
  remarks: string;
  docId: string;
  pdfReady: boolean;
  createdAt: string;
  pageNo: string;
}

export interface GeneratedJournalDoc {
  id: string;
  reviewId: string | null;
  serialNo: string;
  journalNo: string;
  journalDate: string;
  caseNo: string;
  applicationNo: string;
  title: string;
  classNo: string;
  pageNo: string;
  dateOfFiling: string;
  applicant: string;
  agent: string;
  publishingDetails: string;
  trademarkField: string;
  extraLabel: string;
  extraValue: string;
  imageDataUrl: string;
  pdfGenerated: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface JournalBreakdown {
  total: number;
  issue: number;
  docs: number;
}

export interface JournalStats {
  total: number;
  tmMatches: number;
  keywordMatches: number;
  pending: number;
  issue: number;
  clear: number;
  docsGenerated: number;
  pdfsGenerated: number;
  byJournal: Record<string, JournalBreakdown>;
}
