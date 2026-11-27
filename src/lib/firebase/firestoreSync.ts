import type { User } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
  writeBatch,
  type DocumentReference,
  type Unsubscribe,
} from 'firebase/firestore';
import {
  CaseEntry,
  CaseSheetConfig,
  GeneratedJournalDoc,
  JournalCheckRow,
  JournalConfig,
  PaperSizeConfig,
  RecordRow,
  ReviewRow,
  UniversalSettings,
} from '../../types/journal';
import { DEFAULT_UNIVERSAL_SETTINGS, JournalMonitorState } from '../journal/store';
import { db, handleFirestoreError, OperationType } from './firebaseApp';

const WORKSPACE_ID = 'default';
const MAX_BATCH_OPS = 400;

function clampStr(value: unknown, maxLen: number): string {
  const s = typeof value === 'string' ? value : value == null ? '' : String(value);
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

function clampInt(value: unknown, fallback: number, min?: number, max?: number): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? Math.trunc(value) : fallback;
  let out = n;
  if (typeof min === 'number') out = Math.max(min, out);
  if (typeof max === 'number') out = Math.min(max, out);
  return out;
}

function clampFiniteNum(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function sanitizeFirestoreId(raw: string | undefined | null, fallbackPrefix: string): string {
  const cleaned = String(raw || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (!cleaned) {
    return `${fallbackPrefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  }
  return cleaned.slice(0, 128);
}

function sanitizeStringList(list: unknown, maxItems: number, maxItemLen: number): string[] {
  if (!Array.isArray(list)) return [];
  const out: string[] = [];
  for (let i = 0; i < list.length && out.length < maxItems; i++) {
    const s = clampStr(list[i], maxItemLen).trim();
    if (s) out.push(s);
  }
  return out;
}

function sanitizeCaseSheetConfig(cfg?: CaseSheetConfig): Record<string, unknown> | undefined {
  if (!cfg) return undefined;
  const out: Record<string, unknown> = {
    sheetUrlOrId: clampStr(cfg.sheetUrlOrId, 400),
    sheetName: clampStr(cfg.sheetName, 128),
    keyCol: clampInt(cfg.keyCol, 8, 1, 200),
    caseCol: clampInt(cfg.caseCol, 5, 1, 200),
    clientCol: clampInt(cfg.clientCol, 6, 1, 200),
  };
  if (cfg.prefixCol !== undefined) out.prefixCol = clampInt(cfg.prefixCol, 3, 1, 200);
  if (cfg.clientCodeCol !== undefined) out.clientCodeCol = clampInt(cfg.clientCodeCol, 4, 1, 200);
  if (cfg.appNameCol !== undefined) out.appNameCol = clampInt(cfg.appNameCol, 7, 1, 200);
  if (cfg.caseSeparator !== undefined) out.caseSeparator = clampStr(cfg.caseSeparator, 16);
  if (cfg.lastSyncedAt !== undefined) out.lastSyncedAt = clampStr(cfg.lastSyncedAt, 64);
  return out;
}

function sanitizePaperSize(ps?: PaperSizeConfig): Record<string, unknown> | undefined {
  if (!ps) return undefined;
  const out: Record<string, unknown> = {
    preset: clampStr(ps.preset, 32),
    orientation: clampStr(ps.orientation, 32),
    customWidth: clampFiniteNum(ps.customWidth, 8.5),
    customHeight: clampFiniteNum(ps.customHeight, 14),
    customUnit: clampStr(ps.customUnit, 16),
  };
  if (ps.autoAdjustPrint !== undefined) out.autoAdjustPrint = Boolean(ps.autoAdjustPrint);
  return out;
}

function sanitizeUniversalSettings(us?: UniversalSettings): Record<string, unknown> | undefined {
  if (!us) return undefined;
  return {
    tablePageSize: clampInt(us.tablePageSize, 50, 10, 500),
    enableInlineEdit: Boolean(us.enableInlineEdit),
    themePreset: clampStr(us.themePreset, 64),
    docPrimaryColor: clampStr(us.docPrimaryColor, 32),
    docSecondaryColor: clampStr(us.docSecondaryColor, 32),
    docAccentColor: clampStr(us.docAccentColor, 32),
    uiAccentColor: clampStr(us.uiAccentColor, 32),
    uiDarkColor: clampStr(us.uiDarkColor, 32),
    imageColorMode: clampStr(us.imageColorMode, 32),
  };
}

function buildWorkspaceUpdatePayload(
  userId: string,
  config: JournalConfig
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    journalNo: clampStr(config.journalNo, 64),
    journalDate: clampStr(config.journalDate, 64),
    keywordMatchMode: config.keywordMatchMode === 'contains' ? 'contains' : 'word',
    serialPrefix: clampStr(config.serialPrefix, 32),
    serialPad: clampInt(config.serialPad, 3, 1, 6),
    keywords: sanitizeStringList(config.keywords, 10000, 200),
    tmNumbers: sanitizeStringList(config.tmNumbers, 20000, 64),
  };
  const sheet = sanitizeCaseSheetConfig(config.caseSheetConfig);
  if (sheet) payload.caseSheetConfig = sheet;
  const paper = sanitizePaperSize(config.paperSize);
  if (paper) payload.paperSize = paper;
  const univ = sanitizeUniversalSettings(config.universalSettings);
  if (univ) payload.universalSettings = univ;
  return {
    ...payload,
    ownerId: userId,
    workspaceId: WORKSPACE_ID,
  };
}

function buildCaseEntryPayload(
  userId: string,
  caseId: string,
  c: CaseEntry
): Record<string, unknown> {
  const out: Record<string, unknown> = {
    ownerId: userId,
    caseId,
    tmNumber: clampStr(c.tmNumber, 64),
    caseNo: clampStr(c.caseNo, 160),
    clientName: clampStr(c.clientName, 240),
  };
  if (c.id !== undefined) out.recordId = clampStr(c.id, 64);
  if (c.prefix !== undefined) out.prefix = clampStr(c.prefix, 32);
  if (c.clientCode !== undefined) out.clientCode = clampStr(c.clientCode, 64);
  if (c.rawCaseNo !== undefined) out.rawCaseNo = clampStr(c.rawCaseNo, 128);
  if (c.applicationName !== undefined) out.applicationName = clampStr(c.applicationName, 300);
  if (c.classNo !== undefined) out.classNo = clampStr(c.classNo, 32);
  if (c.status !== undefined) out.status = clampStr(c.status, 64);
  if (c.subStatus !== undefined) out.subStatus = clampStr(c.subStatus, 128);
  if (c.caseType !== undefined) out.caseType = clampStr(c.caseType, 64);
  if (c.agent !== undefined) out.agent = clampStr(c.agent, 240);
  if (c.date !== undefined) out.date = clampStr(c.date, 64);
  if (c.offNote !== undefined) out.offNote = clampStr(c.offNote, 1000);
  if (c.notes !== undefined) out.notes = clampStr(c.notes, 2000);
  if (c.tm5 !== undefined) out.tm5 = clampStr(c.tm5, 16);
  if (c.tm6 !== undefined) out.tm6 = clampStr(c.tm6, 16);
  if (c.tm11 !== undefined) out.tm11 = clampStr(c.tm11, 16);
  if (c.tm16 !== undefined) out.tm16 = clampStr(c.tm16, 16);
  if (c.tm56 !== undefined) out.tm56 = clampStr(c.tm56, 16);
  if (c.journalNumber !== undefined) out.journalNumber = clampStr(c.journalNumber, 64);
  if (c.journalDate !== undefined) out.journalDate = clampStr(c.journalDate, 64);
  if (c.lastModified !== undefined) out.lastModified = clampStr(c.lastModified, 64);
  if (c.imageUrl !== undefined) out.imageUrl = clampStr(c.imageUrl, 1000);
  if (c.sheetRowIndex !== undefined && Number.isFinite(c.sheetRowIndex)) {
    out.sheetRowIndex = Math.trunc(c.sheetRowIndex);
  }
  return out;
}

function buildJournalRowPayload(
  userId: string,
  rowId: string,
  row: JournalCheckRow
): Record<string, unknown> {
  return {
    ownerId: userId,
    rowId,
    applicationNo: clampStr(row.applicationNo, 64),
    title: clampStr(row.title, 500),
    classNo: clampStr(row.classNo, 32),
    applicant: clampStr(row.applicant, 1000),
    agent: clampStr(row.agent, 500),
    dateOfFiling: clampStr(row.dateOfFiling, 64),
    pageNo: clampStr(row.pageNo, 32),
  };
}

function buildReviewRowPayload(
  userId: string,
  reviewId: string,
  row: ReviewRow
): Record<string, unknown> {
  const decision =
    row.decision === 'ISSUE - OPPOSE' || row.decision === 'NO ISSUE - CLEAR'
      ? row.decision
      : 'PENDING REVIEW';
  const status =
    row.status === 'MAILMERGE' || row.status === 'GENERATED' ? row.status : 'REVIEW';

  return {
    ownerId: userId,
    reviewId,
    journalNo: clampStr(row.journalNo, 64),
    journalDate: clampStr(row.journalDate, 64),
    applicationNo: clampStr(row.applicationNo, 64),
    caseNo: clampStr(row.caseNo, 240),
    title: clampStr(row.title, 500),
    classNo: clampStr(row.classNo, 32),
    applicant: clampStr(row.applicant, 1000),
    agent: clampStr(row.agent, 500),
    dateOfFiling: clampStr(row.dateOfFiling, 64),
    matchedTerm: clampStr(row.matchedTerm, 240),
    matchType: row.matchType === 'KEYWORD' ? 'KEYWORD' : 'TM',
    decision,
    status,
    generatedDocId: clampStr(row.generatedDocId, 128),
    generatedPdfReady: Boolean(row.generatedPdfReady),
    generatedAt: clampStr(row.generatedAt, 64),
    pageNo: clampStr(row.pageNo, 32),
  };
}

function buildRecordPayload(
  userId: string,
  recordId: string,
  rec: RecordRow
): Record<string, unknown> {
  return {
    ownerId: userId,
    recordId,
    journalNo: clampStr(rec.journalNo, 64),
    journalDate: clampStr(rec.journalDate, 64),
    tmNo: clampStr(rec.tmNo, 64),
    caseNo: clampStr(rec.caseNo, 240),
    classNo: clampStr(rec.classNo, 32),
    applicant: clampStr(rec.applicant, 1000),
    title: clampStr(rec.title, 500),
    agent: clampStr(rec.agent, 500),
    applicationNo: clampStr(rec.applicationNo, 64),
    dateOfFiling: clampStr(rec.dateOfFiling, 64),
    matchedTerm: clampStr(rec.matchedTerm, 240),
    matchType: rec.matchType === 'KEYWORD' ? 'KEYWORD' : 'TM',
    decision: clampStr(rec.decision, 120),
    remarks: clampStr(rec.remarks, 500),
    docId: clampStr(rec.docId, 128),
    pdfReady: Boolean(rec.pdfReady),
    docCreatedAt: clampStr(rec.createdAt, 64),
    pageNo: clampStr(rec.pageNo, 32),
  };
}

function buildGeneratedDocPayload(
  userId: string,
  docId: string,
  docItem: GeneratedJournalDoc
): Record<string, unknown> {
  const out: Record<string, unknown> = {
    ownerId: userId,
    docId,
    reviewId: docItem.reviewId ? clampStr(docItem.reviewId, 128) : null,
    serialNo: clampStr(docItem.serialNo, 64),
    journalNo: clampStr(docItem.journalNo, 64),
    journalDate: clampStr(docItem.journalDate, 64),
    caseNo: clampStr(docItem.caseNo, 240),
    applicationNo: clampStr(docItem.applicationNo, 64),
    title: clampStr(docItem.title, 500),
    classNo: clampStr(docItem.classNo, 32),
    pageNo: clampStr(docItem.pageNo, 32),
    dateOfFiling: clampStr(docItem.dateOfFiling, 64),
    applicant: clampStr(docItem.applicant, 1000),
    agent: clampStr(docItem.agent, 500),
    publishingDetails: clampStr(docItem.publishingDetails, 2000),
    trademarkField: clampStr(docItem.trademarkField, 300),
    extraLabel: clampStr(docItem.extraLabel, 64),
    extraValue: clampStr(docItem.extraValue, 300),
    imageDataUrl: clampStr(docItem.imageDataUrl, 400000),
    pdfGenerated: Boolean(docItem.pdfGenerated),
    docCreatedAt: clampStr(docItem.createdAt, 64),
    docUpdatedAt: clampStr(docItem.updatedAt, 64),
  };
  if (Array.isArray(docItem.extraRows)) {
    out.extraRows = docItem.extraRows.slice(0, 25).map((r) => ({
      id: clampStr(r.id, 64),
      label: clampStr(r.label, 64),
      value: clampStr(r.value, 300),
    }));
  }
  if (docItem.noteText !== undefined) {
    out.noteText = clampStr(docItem.noteText, 1000);
  }
  if (
    docItem.imageColorMode === 'original' ||
    docItem.imageColorMode === 'theme' ||
    docItem.imageColorMode === 'grayscale'
  ) {
    out.imageColorMode = docItem.imageColorMode;
  }
  return out;
}

function stableCaseDocIds(entries: CaseEntry[]): Array<{ caseId: string; entry: CaseEntry }> {
  const used = new Set<string>();
  return entries.map((entry, idx) => {
    const base = sanitizeFirestoreId(
      entry.id || (entry.tmNumber ? `tm_${entry.tmNumber}` : `case_${idx + 1}`),
      `case_${idx + 1}`
    );
    let candidate = base;
    let suffix = 1;
    while (used.has(candidate)) {
      candidate = `${base.slice(0, 118)}_${suffix++}`;
    }
    used.add(candidate);
    return { caseId: candidate, entry };
  });
}

export interface SyncedSnapshotMaps {
  workspaceJson: string | null;
  cases: Map<string, { json: string; raw: Record<string, unknown> }>;
  journalRows: Map<string, { json: string; raw: Record<string, unknown> }>;
  reviewRows: Map<string, { json: string; raw: Record<string, unknown> }>;
  records: Map<string, { json: string; raw: Record<string, unknown> }>;
  generatedDocs: Map<string, { json: string; raw: Record<string, unknown> }>;
}

export function createEmptySnapshotMaps(): SyncedSnapshotMaps {
  return {
    workspaceJson: null,
    cases: new Map(),
    journalRows: new Map(),
    reviewRows: new Map(),
    records: new Map(),
    generatedDocs: new Map(),
  };
}

export async function ensureUserWorkspaceRoot(user: User): Promise<void> {
  if (!db) return;
  const path = `users/${user.uid}`;
  const userRef = doc(db, 'users', user.uid);
  try {
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      await setDoc(userRef, {
        uid: user.uid,
        displayName: clampStr(user.displayName || 'Workspace Owner', 160),
        activeWorkspaceId: WORKSPACE_ID,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

interface BatchWriteOp {
  type: 'set' | 'update' | 'delete';
  ref: DocumentReference;
  data?: Record<string, unknown>;
  path: string;
}

async function commitOpsInChunks(ops: BatchWriteOp[]): Promise<void> {
  if (!db || ops.length === 0) return;
  for (let i = 0; i < ops.length; i += MAX_BATCH_OPS) {
    const chunk = ops.slice(i, i + MAX_BATCH_OPS);
    const batch = writeBatch(db);
    for (const op of chunk) {
      if (op.type === 'set' && op.data) {
        batch.set(op.ref, op.data);
      } else if (op.type === 'update' && op.data) {
        batch.update(op.ref, op.data);
      } else if (op.type === 'delete') {
        batch.delete(op.ref);
      }
    }
    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, chunk[0]?.path || 'users');
    }
  }
}

export async function syncStateDiffToFirestore(
  userId: string,
  state: JournalMonitorState,
  synced: SyncedSnapshotMaps
): Promise<number> {
  if (!db) return 0;
  const ops: BatchWriteOp[] = [];

  // 1. Workspace Config
  const wsPath = `users/${userId}/workspaces/${WORKSPACE_ID}`;
  const wsRef = doc(db, 'users', userId, 'workspaces', WORKSPACE_ID);
  const wsPayload = buildWorkspaceUpdatePayload(userId, state.config);
  const wsJson = JSON.stringify(wsPayload);
  if (synced.workspaceJson === null) {
    ops.push({
      type: 'set',
      ref: wsRef,
      data: {
        ...wsPayload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      path: wsPath,
    });
    synced.workspaceJson = wsJson;
  } else if (synced.workspaceJson !== wsJson) {
    const updateData = { ...wsPayload };
    delete updateData.ownerId;
    delete updateData.workspaceId;
    ops.push({
      type: 'update',
      ref: wsRef,
      data: {
        ...updateData,
        updatedAt: serverTimestamp(),
      },
      path: wsPath,
    });
    synced.workspaceJson = wsJson;
  }

  // 2. Cases
  const currentCases = stableCaseDocIds(state.config.caseEntries);
  const nextCaseIds = new Set<string>();
  for (const { caseId, entry } of currentCases) {
    nextCaseIds.add(caseId);
    const payload = buildCaseEntryPayload(userId, caseId, entry);
    const json = JSON.stringify(payload);
    const existing = synced.cases.get(caseId);
    const ref = doc(db, 'users', userId, 'cases', caseId);
    const path = `users/${userId}/cases/${caseId}`;
    if (!existing) {
      ops.push({
        type: 'set',
        ref,
        data: { ...payload, createdAt: serverTimestamp(), updatedAt: serverTimestamp() },
        path,
      });
      synced.cases.set(caseId, { json, raw: payload });
    } else if (existing.json !== json) {
      const updateData = { ...payload };
      delete updateData.ownerId;
      delete updateData.caseId;
      ops.push({
        type: 'update',
        ref,
        data: { ...updateData, updatedAt: serverTimestamp() },
        path,
      });
      synced.cases.set(caseId, { json, raw: payload });
    }
  }
  for (const prevId of Array.from(synced.cases.keys())) {
    if (!nextCaseIds.has(prevId)) {
      ops.push({
        type: 'delete',
        ref: doc(db, 'users', userId, 'cases', prevId),
        path: `users/${userId}/cases/${prevId}`,
      });
      synced.cases.delete(prevId);
    }
  }

  // 3. JournalCheck Rows
  const nextJournalIds = new Set<string>();
  for (const row of state.journalRows) {
    const rowId = sanitizeFirestoreId(row.id, 'jc');
    nextJournalIds.add(rowId);
    const payload = buildJournalRowPayload(userId, rowId, row);
    const json = JSON.stringify(payload);
    const existing = synced.journalRows.get(rowId);
    const ref = doc(db, 'users', userId, 'journalRows', rowId);
    const path = `users/${userId}/journalRows/${rowId}`;
    if (!existing) {
      ops.push({
        type: 'set',
        ref,
        data: { ...payload, createdAt: serverTimestamp(), updatedAt: serverTimestamp() },
        path,
      });
      synced.journalRows.set(rowId, { json, raw: payload });
    } else if (existing.json !== json) {
      const updateData = { ...payload };
      delete updateData.ownerId;
      delete updateData.rowId;
      ops.push({
        type: 'update',
        ref,
        data: { ...updateData, updatedAt: serverTimestamp() },
        path,
      });
      synced.journalRows.set(rowId, { json, raw: payload });
    }
  }
  for (const prevId of Array.from(synced.journalRows.keys())) {
    if (!nextJournalIds.has(prevId)) {
      ops.push({
        type: 'delete',
        ref: doc(db, 'users', userId, 'journalRows', prevId),
        path: `users/${userId}/journalRows/${prevId}`,
      });
      synced.journalRows.delete(prevId);
    }
  }

  // 4. Review Queue Rows (respecting terminal generatedDocId lock)
  const nextReviewIds = new Set<string>();
  for (const row of state.reviewRows) {
    const reviewId = sanitizeFirestoreId(row.id, 'rev');
    nextReviewIds.add(reviewId);
    const payload = buildReviewRowPayload(userId, reviewId, row);
    const json = JSON.stringify(payload);
    const existing = synced.reviewRows.get(reviewId);
    const ref = doc(db, 'users', userId, 'reviewRows', reviewId);
    const path = `users/${userId}/reviewRows/${reviewId}`;
    if (!existing) {
      ops.push({
        type: 'set',
        ref,
        data: { ...payload, createdAt: serverTimestamp(), updatedAt: serverTimestamp() },
        path,
      });
      synced.reviewRows.set(reviewId, { json, raw: payload });
    } else if (existing.json !== json) {
      const wasTerminal =
        existing.raw.status === 'GENERATED' && Boolean(existing.raw.generatedDocId);
      if (wasTerminal) {
        ops.push({
          type: 'update',
          ref,
          data: {
            generatedPdfReady: Boolean(payload.generatedPdfReady),
            caseNo: payload.caseNo,
            decision: payload.decision,
            updatedAt: serverTimestamp(),
          },
          path,
        });
        const mergedRaw = {
          ...existing.raw,
          generatedPdfReady: Boolean(payload.generatedPdfReady),
          caseNo: payload.caseNo,
          decision: payload.decision,
        };
        synced.reviewRows.set(reviewId, { json: JSON.stringify(mergedRaw), raw: mergedRaw });
      } else {
        const updateData = { ...payload };
        delete updateData.ownerId;
        delete updateData.reviewId;
        ops.push({
          type: 'update',
          ref,
          data: { ...updateData, updatedAt: serverTimestamp() },
          path,
        });
        synced.reviewRows.set(reviewId, { json, raw: payload });
      }
    }
  }
  for (const prevId of Array.from(synced.reviewRows.keys())) {
    if (!nextReviewIds.has(prevId)) {
      ops.push({
        type: 'delete',
        ref: doc(db, 'users', userId, 'reviewRows', prevId),
        path: `users/${userId}/reviewRows/${prevId}`,
      });
      synced.reviewRows.delete(prevId);
    }
  }

  // 5. Records
  const nextRecordIds = new Set<string>();
  for (const rec of state.records) {
    const recordId = sanitizeFirestoreId(rec.id, 'rec');
    nextRecordIds.add(recordId);
    const payload = buildRecordPayload(userId, recordId, rec);
    const json = JSON.stringify(payload);
    const existing = synced.records.get(recordId);
    const ref = doc(db, 'users', userId, 'records', recordId);
    const path = `users/${userId}/records/${recordId}`;
    if (!existing) {
      ops.push({
        type: 'set',
        ref,
        data: { ...payload, createdAt: serverTimestamp(), updatedAt: serverTimestamp() },
        path,
      });
      synced.records.set(recordId, { json, raw: payload });
    } else if (existing.json !== json) {
      const updateData = { ...payload };
      delete updateData.ownerId;
      delete updateData.recordId;
      delete updateData.docId;
      delete updateData.docCreatedAt;
      ops.push({
        type: 'update',
        ref,
        data: { ...updateData, updatedAt: serverTimestamp() },
        path,
      });
      synced.records.set(recordId, { json, raw: payload });
    }
  }
  for (const prevId of Array.from(synced.records.keys())) {
    if (!nextRecordIds.has(prevId)) {
      ops.push({
        type: 'delete',
        ref: doc(db, 'users', userId, 'records', prevId),
        path: `users/${userId}/records/${prevId}`,
      });
      synced.records.delete(prevId);
    }
  }

  // 6. Generated Docs
  const nextDocIds = new Set<string>();
  for (const docItem of state.generatedDocs) {
    const docId = sanitizeFirestoreId(docItem.id, 'gdoc');
    nextDocIds.add(docId);
    const payload = buildGeneratedDocPayload(userId, docId, docItem);
    const json = JSON.stringify(payload);
    const existing = synced.generatedDocs.get(docId);
    const ref = doc(db, 'users', userId, 'generatedDocs', docId);
    const path = `users/${userId}/generatedDocs/${docId}`;
    if (!existing) {
      ops.push({
        type: 'set',
        ref,
        data: { ...payload, createdAt: serverTimestamp(), updatedAt: serverTimestamp() },
        path,
      });
      synced.generatedDocs.set(docId, { json, raw: payload });
    } else if (existing.json !== json) {
      const updateData = { ...payload };
      delete updateData.ownerId;
      delete updateData.docId;
      delete updateData.docCreatedAt;
      ops.push({
        type: 'update',
        ref,
        data: { ...updateData, updatedAt: serverTimestamp() },
        path,
      });
      synced.generatedDocs.set(docId, { json, raw: payload });
    }
  }
  for (const prevId of Array.from(synced.generatedDocs.keys())) {
    if (!nextDocIds.has(prevId)) {
      ops.push({
        type: 'delete',
        ref: doc(db, 'users', userId, 'generatedDocs', prevId),
        path: `users/${userId}/generatedDocs/${prevId}`,
      });
      synced.generatedDocs.delete(prevId);
    }
  }

  await commitOpsInChunks(ops);
  return ops.length;
}

function sortByTimestampDesc(a: Record<string, unknown>, b: Record<string, unknown>): number {
  const ta = a.createdAt instanceof Timestamp ? a.createdAt.toMillis() : 0;
  const tb = b.createdAt instanceof Timestamp ? b.createdAt.toMillis() : 0;
  return tb - ta;
}

export interface RemoteWorkspaceCallbacks {
  onWorkspaceReady: (existsOnCloud: boolean, state: JournalMonitorState | null) => void;
  onRemoteUpdate: (state: JournalMonitorState) => void;
  onSyncError: (error: unknown) => void;
}

export function subscribeUserWorkspace(
  userId: string,
  synced: SyncedSnapshotMaps,
  getLocalFallbackState: () => JournalMonitorState,
  callbacks: RemoteWorkspaceCallbacks
): Unsubscribe {
  if (!db) return () => {};

  let wsLoaded = false;
  let casesLoaded = false;
  let journalLoaded = false;
  let reviewLoaded = false;
  let recordsLoaded = false;
  let docsLoaded = false;
  let initialNotified = false;

  let cloudWorkspaceExists = false;
  let remoteConfigPartial: Partial<JournalConfig> | null = null;
  let remoteCases: CaseEntry[] = [];
  let remoteJournalRows: JournalCheckRow[] = [];
  let remoteReviewRows: ReviewRow[] = [];
  let remoteRecords: RecordRow[] = [];
  let remoteGeneratedDocs: GeneratedJournalDoc[] = [];

  const buildCombinedState = (): JournalMonitorState => {
    const base = getLocalFallbackState();
    return {
      config: {
        ...base.config,
        ...(remoteConfigPartial || {}),
        caseEntries: remoteCases,
        universalSettings: {
          ...DEFAULT_UNIVERSAL_SETTINGS,
          ...(base.config.universalSettings || {}),
          ...(remoteConfigPartial?.universalSettings || {}),
        },
      },
      journalRows: remoteJournalRows,
      reviewRows: remoteReviewRows,
      records: remoteRecords,
      generatedDocs: remoteGeneratedDocs,
    };
  };

  const maybeNotify = () => {
    if (
      !wsLoaded ||
      !casesLoaded ||
      !journalLoaded ||
      !reviewLoaded ||
      !recordsLoaded ||
      !docsLoaded
    ) {
      return;
    }
    if (!initialNotified) {
      initialNotified = true;
      callbacks.onWorkspaceReady(
        cloudWorkspaceExists,
        cloudWorkspaceExists ? buildCombinedState() : null
      );
      return;
    }
    if (cloudWorkspaceExists) {
      callbacks.onRemoteUpdate(buildCombinedState());
    }
  };

  const wsPath = `users/${userId}/workspaces/${WORKSPACE_ID}`;
  const unsubWs = onSnapshot(
    doc(db, 'users', userId, 'workspaces', WORKSPACE_ID),
    (snap) => {
      wsLoaded = true;
      cloudWorkspaceExists = snap.exists();
      if (snap.exists()) {
        const d = snap.data();
        remoteConfigPartial = {
          journalNo: typeof d.journalNo === 'string' ? d.journalNo : '909',
          journalDate: typeof d.journalDate === 'string' ? d.journalDate : '26-Nov-2026',
          keywordMatchMode: d.keywordMatchMode === 'contains' ? 'contains' : 'word',
          serialPrefix: typeof d.serialPrefix === 'string' ? d.serialPrefix : 'PB-',
          serialPad: typeof d.serialPad === 'number' ? d.serialPad : 3,
          keywords: Array.isArray(d.keywords) ? (d.keywords as string[]) : [],
          tmNumbers: Array.isArray(d.tmNumbers) ? (d.tmNumbers as string[]) : [],
          caseSheetConfig: d.caseSheetConfig as CaseSheetConfig | undefined,
          paperSize: d.paperSize as PaperSizeConfig | undefined,
          universalSettings: d.universalSettings as UniversalSettings | undefined,
        };
        const cleanPayload = buildWorkspaceUpdatePayload(userId, {
          ...getLocalFallbackState().config,
          ...remoteConfigPartial,
          caseEntries: [],
        });
        synced.workspaceJson = JSON.stringify(cleanPayload);
      } else {
        synced.workspaceJson = null;
        remoteConfigPartial = null;
      }
      maybeNotify();
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, wsPath);
      } catch (wrapped) {
        callbacks.onSyncError(wrapped);
      }
    }
  );

  const casesPath = `users/${userId}/cases`;
  const unsubCases = onSnapshot(
    query(collection(db, 'users', userId, 'cases'), where('ownerId', '==', userId)),
    (snap) => {
      casesLoaded = true;
      synced.cases.clear();
      const rawDocs: Array<{ caseId: string; raw: Record<string, unknown> }> = [];
      snap.forEach((docSnap) => {
        const d = docSnap.data();
        rawDocs.push({ caseId: docSnap.id, raw: d });
      });
      rawDocs.sort((a, b) => sortByTimestampDesc(a.raw, b.raw));
      remoteCases = rawDocs.map(({ caseId, raw }) => {
        const entry: CaseEntry = {
          id: typeof raw.recordId === 'string' ? raw.recordId : undefined,
          tmNumber: clampStr(raw.tmNumber, 64),
          caseNo: clampStr(raw.caseNo, 160),
          clientName: clampStr(raw.clientName, 240),
          prefix: typeof raw.prefix === 'string' ? raw.prefix : undefined,
          clientCode: typeof raw.clientCode === 'string' ? raw.clientCode : undefined,
          rawCaseNo: typeof raw.rawCaseNo === 'string' ? raw.rawCaseNo : undefined,
          applicationName:
            typeof raw.applicationName === 'string' ? raw.applicationName : undefined,
          classNo: typeof raw.classNo === 'string' ? raw.classNo : undefined,
          status: typeof raw.status === 'string' ? raw.status : undefined,
          subStatus: typeof raw.subStatus === 'string' ? raw.subStatus : undefined,
          caseType: typeof raw.caseType === 'string' ? raw.caseType : undefined,
          agent: typeof raw.agent === 'string' ? raw.agent : undefined,
          date: typeof raw.date === 'string' ? raw.date : undefined,
          offNote: typeof raw.offNote === 'string' ? raw.offNote : undefined,
          notes: typeof raw.notes === 'string' ? raw.notes : undefined,
          tm5: typeof raw.tm5 === 'string' ? raw.tm5 : undefined,
          tm6: typeof raw.tm6 === 'string' ? raw.tm6 : undefined,
          tm11: typeof raw.tm11 === 'string' ? raw.tm11 : undefined,
          tm16: typeof raw.tm16 === 'string' ? raw.tm16 : undefined,
          tm56: typeof raw.tm56 === 'string' ? raw.tm56 : undefined,
          journalNumber: typeof raw.journalNumber === 'string' ? raw.journalNumber : undefined,
          journalDate: typeof raw.journalDate === 'string' ? raw.journalDate : undefined,
          lastModified: typeof raw.lastModified === 'string' ? raw.lastModified : undefined,
          imageUrl: typeof raw.imageUrl === 'string' ? raw.imageUrl : undefined,
          sheetRowIndex: typeof raw.sheetRowIndex === 'number' ? raw.sheetRowIndex : undefined,
        };
        const payload = buildCaseEntryPayload(userId, caseId, entry);
        synced.cases.set(caseId, { json: JSON.stringify(payload), raw: payload });
        return entry;
      });
      maybeNotify();
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, casesPath);
      } catch (wrapped) {
        callbacks.onSyncError(wrapped);
      }
    }
  );

  const journalPath = `users/${userId}/journalRows`;
  const unsubJournal = onSnapshot(
    query(collection(db, 'users', userId, 'journalRows'), where('ownerId', '==', userId)),
    (snap) => {
      journalLoaded = true;
      synced.journalRows.clear();
      const rawDocs: Array<{ rowId: string; raw: Record<string, unknown> }> = [];
      snap.forEach((docSnap) => {
        rawDocs.push({ rowId: docSnap.id, raw: docSnap.data() });
      });
      remoteJournalRows = rawDocs.map(({ rowId, raw }) => {
        const row: JournalCheckRow = {
          id: rowId,
          applicationNo: clampStr(raw.applicationNo, 64),
          title: clampStr(raw.title, 500),
          classNo: clampStr(raw.classNo, 32),
          applicant: clampStr(raw.applicant, 1000),
          agent: clampStr(raw.agent, 500),
          dateOfFiling: clampStr(raw.dateOfFiling, 64),
          pageNo: clampStr(raw.pageNo, 32),
        };
        const payload = buildJournalRowPayload(userId, rowId, row);
        synced.journalRows.set(rowId, { json: JSON.stringify(payload), raw: payload });
        return row;
      });
      maybeNotify();
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, journalPath);
      } catch (wrapped) {
        callbacks.onSyncError(wrapped);
      }
    }
  );

  const reviewPath = `users/${userId}/reviewRows`;
  const unsubReview = onSnapshot(
    query(collection(db, 'users', userId, 'reviewRows'), where('ownerId', '==', userId)),
    (snap) => {
      reviewLoaded = true;
      synced.reviewRows.clear();
      const rawDocs: Array<{ reviewId: string; raw: Record<string, unknown> }> = [];
      snap.forEach((docSnap) => {
        rawDocs.push({ reviewId: docSnap.id, raw: docSnap.data() });
      });
      rawDocs.sort((a, b) => sortByTimestampDesc(a.raw, b.raw));
      remoteReviewRows = rawDocs.map(({ reviewId, raw }) => {
        const row: ReviewRow = {
          id: reviewId,
          journalNo: clampStr(raw.journalNo, 64),
          journalDate: clampStr(raw.journalDate, 64),
          applicationNo: clampStr(raw.applicationNo, 64),
          caseNo: clampStr(raw.caseNo, 240),
          title: clampStr(raw.title, 500),
          classNo: clampStr(raw.classNo, 32),
          applicant: clampStr(raw.applicant, 1000),
          agent: clampStr(raw.agent, 500),
          dateOfFiling: clampStr(raw.dateOfFiling, 64),
          matchedTerm: clampStr(raw.matchedTerm, 240),
          matchType: raw.matchType === 'KEYWORD' ? 'KEYWORD' : 'TM',
          decision:
            raw.decision === 'ISSUE - OPPOSE' || raw.decision === 'NO ISSUE - CLEAR'
              ? raw.decision
              : 'PENDING REVIEW',
          status:
            raw.status === 'MAILMERGE' || raw.status === 'GENERATED' ? raw.status : 'REVIEW',
          generatedDocId: clampStr(raw.generatedDocId, 128),
          generatedPdfReady: Boolean(raw.generatedPdfReady),
          generatedAt: clampStr(raw.generatedAt, 64),
          pageNo: clampStr(raw.pageNo, 32),
        };
        const payload = buildReviewRowPayload(userId, reviewId, row);
        synced.reviewRows.set(reviewId, { json: JSON.stringify(payload), raw: payload });
        return row;
      });
      maybeNotify();
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, reviewPath);
      } catch (wrapped) {
        callbacks.onSyncError(wrapped);
      }
    }
  );

  const recordsPath = `users/${userId}/records`;
  const unsubRecords = onSnapshot(
    query(collection(db, 'users', userId, 'records'), where('ownerId', '==', userId)),
    (snap) => {
      recordsLoaded = true;
      synced.records.clear();
      const rawDocs: Array<{ recordId: string; raw: Record<string, unknown> }> = [];
      snap.forEach((docSnap) => {
        rawDocs.push({ recordId: docSnap.id, raw: docSnap.data() });
      });
      rawDocs.sort((a, b) => sortByTimestampDesc(a.raw, b.raw));
      remoteRecords = rawDocs.map(({ recordId, raw }) => {
        const rec: RecordRow = {
          id: recordId,
          journalNo: clampStr(raw.journalNo, 64),
          journalDate: clampStr(raw.journalDate, 64),
          tmNo: clampStr(raw.tmNo, 64),
          caseNo: clampStr(raw.caseNo, 240),
          classNo: clampStr(raw.classNo, 32),
          applicant: clampStr(raw.applicant, 1000),
          title: clampStr(raw.title, 500),
          agent: clampStr(raw.agent, 500),
          applicationNo: clampStr(raw.applicationNo, 64),
          dateOfFiling: clampStr(raw.dateOfFiling, 64),
          matchedTerm: clampStr(raw.matchedTerm, 240),
          matchType: raw.matchType === 'KEYWORD' ? 'KEYWORD' : 'TM',
          decision: clampStr(raw.decision, 120),
          remarks: clampStr(raw.remarks, 500),
          docId: clampStr(raw.docId, 128),
          pdfReady: Boolean(raw.pdfReady),
          createdAt: clampStr(raw.docCreatedAt, 64),
          pageNo: clampStr(raw.pageNo, 32),
        };
        const payload = buildRecordPayload(userId, recordId, rec);
        synced.records.set(recordId, { json: JSON.stringify(payload), raw: payload });
        return rec;
      });
      maybeNotify();
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, recordsPath);
      } catch (wrapped) {
        callbacks.onSyncError(wrapped);
      }
    }
  );

  const docsPath = `users/${userId}/generatedDocs`;
  const unsubDocs = onSnapshot(
    query(collection(db, 'users', userId, 'generatedDocs'), where('ownerId', '==', userId)),
    (snap) => {
      docsLoaded = true;
      synced.generatedDocs.clear();
      const rawDocs: Array<{ docId: string; raw: Record<string, unknown> }> = [];
      snap.forEach((docSnap) => {
        rawDocs.push({ docId: docSnap.id, raw: docSnap.data() });
      });
      rawDocs.sort((a, b) => sortByTimestampDesc(a.raw, b.raw));
      remoteGeneratedDocs = rawDocs.map(({ docId, raw }) => {
        const docItem: GeneratedJournalDoc = {
          id: docId,
          reviewId: typeof raw.reviewId === 'string' ? raw.reviewId : null,
          serialNo: clampStr(raw.serialNo, 64),
          journalNo: clampStr(raw.journalNo, 64),
          journalDate: clampStr(raw.journalDate, 64),
          caseNo: clampStr(raw.caseNo, 240),
          applicationNo: clampStr(raw.applicationNo, 64),
          title: clampStr(raw.title, 500),
          classNo: clampStr(raw.classNo, 32),
          pageNo: clampStr(raw.pageNo, 32),
          dateOfFiling: clampStr(raw.dateOfFiling, 64),
          applicant: clampStr(raw.applicant, 1000),
          agent: clampStr(raw.agent, 500),
          publishingDetails: clampStr(raw.publishingDetails, 2000),
          trademarkField: clampStr(raw.trademarkField, 300),
          extraLabel: clampStr(raw.extraLabel, 64),
          extraValue: clampStr(raw.extraValue, 300),
          extraRows: Array.isArray(raw.extraRows)
            ? (raw.extraRows as GeneratedJournalDoc['extraRows'])
            : undefined,
          noteText: typeof raw.noteText === 'string' ? raw.noteText : undefined,
          imageColorMode:
            raw.imageColorMode === 'original' ||
            raw.imageColorMode === 'theme' ||
            raw.imageColorMode === 'grayscale'
              ? raw.imageColorMode
              : undefined,
          imageDataUrl: clampStr(raw.imageDataUrl, 400000),
          pdfGenerated: Boolean(raw.pdfGenerated),
          createdAt: clampStr(raw.docCreatedAt, 64),
          updatedAt: clampStr(raw.docUpdatedAt, 64),
        };
        const payload = buildGeneratedDocPayload(userId, docId, docItem);
        synced.generatedDocs.set(docId, { json: JSON.stringify(payload), raw: payload });
        return docItem;
      });
      maybeNotify();
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, docsPath);
      } catch (wrapped) {
        callbacks.onSyncError(wrapped);
      }
    }
  );

  return () => {
    unsubWs();
    unsubCases();
    unsubJournal();
    unsubReview();
    unsubRecords();
    unsubDocs();
  };
}
