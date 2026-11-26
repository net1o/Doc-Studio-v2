export type KeywordMatchMode = 'word' | 'contains';
export type MatchType = 'TM' | 'KEYWORD';
export type ReviewDecision = 'PENDING REVIEW' | 'ISSUE - OPPOSE' | 'NO ISSUE - CLEAR';
export type ReviewStatus = 'REVIEW' | 'MAILMERGE' | 'GENERATED';
export type AppTab =
  | 'analyzer'
  | 'journalcheck'
  | 'review'
  | 'generator'
  | 'records'
  | 'backup';

export interface CaseEntry {
  tmNumber: string;
  caseNo: string;
  clientName: string;
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
