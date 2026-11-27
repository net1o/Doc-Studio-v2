import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CloudUpload,
  Database,
  Download,
  FileSpreadsheet,
  FolderSearch,
  Globe,
  Plus,
  RefreshCw,
  Search,
  ShieldPlus,
  Trash2,
  X,
} from 'lucide-react';
import { CaseEntry, CaseSheetConfig, JournalConfig, UniversalSettings } from '../types/journal';
import { BrandexButtonIcon } from './BrandexButtonIcon';
import { GoogleSignInButton } from './GoogleSignInButton';
import {
  analyzeCaseEntries,
  CANONICAL_STAGES,
  checkDuplicate,
  deriveStageAndSubStatusCatalog,
  exportRowsToCsv,
  fetchGoogleSheetCsvSmart,
  formatCompositeCaseNo,
  formatDdMmmYy,
  fromHtmlDateInputValue,
  getCaseEntryKey,
  mergeDatabaseEntries,
  mergeUniqueTmNumbers,
  NICE_CLASS_NUMBERS,
  parseCaseLookupInput,
  parseLooseDate,
  sanitizeTmCprValue,
  toHtmlDateInputValue,
  triggerFileDownload,
} from '../lib/journal/engine';
import {
  getGoogleAccessToken,
  getSpreadsheetMetadata,
  GoogleDriveSpreadsheetItem,
  GoogleSheetTabInfo,
  initGoogleAuthListener,
  listUserSpreadsheets,
  readGoogleSheetViaApi,
  signInWithGoogleWorkspace,
  signOutGoogleWorkspace,
  writeCaseEntriesToGoogleSheet,
} from '../lib/google/googleSheetsClient';
import {
  DEFAULT_APPS_SCRIPT_CASE_SHEET_ID,
  DEFAULT_APPS_SCRIPT_CASE_SHEET_NAME,
} from '../lib/journal/watchlistSeed';
import {
  DeleteAllConfirmModal,
  TableControlsBar,
  TableSortInlinePanel,
} from './TableControlsBar';

interface DatabaseViewProps {
  config: JournalConfig;
  pageSize?: number;
  defaultEditMode?: boolean;
  themeSettings?: UniversalSettings;
  onUpdateConfig: (next: JournalConfig) => void;
  onRefreshReviewCases: (entries: CaseEntry[]) => void;
  onNotify: (message: string) => void;
}

const SAMPLE_DATABASE_CSV = `"ID","DATE","TYPE","CLIENT CODE","CASE NUMBER","CLIENT NAME","APPLICATION NAME","TM/CPR NUMBER","CLASS","STATUS","SUB STATUS","CASE TYPE","AGENT","OFF NOTE","NOTES","TM5","TM6","TM11","TM16","TM56","JOURNAL NUMBER","JOURNAL DATE","LAST MODIFIED","IMAGE"
"REC-2379","26-Oct-26","X","ASSIGHN","SULMAN","","ASSIGHN TO SULMAN LIST","835736","-","STAGE 2","ASSIGNED","TM","SULEMAN","","","FALSE","FALSE","FALSE","FALSE","FALSE","","","",""
"REC-2403","26-Oct-26","X","ASSIGHN","SULMAN","","ASSIGHN TO SULMAN LIST","868677","-","STAGE 2","ASSIGNED","TM","SULEMAN","","","FALSE","FALSE","FALSE","FALSE","FALSE","","","",""
"REC-2395","26-Oct-26","X","ASSIGHN","SULMAN","","ASSIGHN TO SULMAN LIST","871539","-","STAGE 2","ASSIGNED","TM","SULEMAN","","","FALSE","FALSE","FALSE","FALSE","FALSE","","","",""`;

type SortKey =
  | 'id'
  | 'date'
  | 'prefix'
  | 'clientCode'
  | 'rawCaseNo'
  | 'caseNo'
  | 'clientName'
  | 'applicationName'
  | 'tmNumber'
  | 'classNo'
  | 'status'
  | 'subStatus'
  | 'caseType'
  | 'agent'
  | 'journalNumber'
  | 'lastModified';

function parseRecIdNumeric(id?: string): number {
  const m = String(id || '').match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

function getStageBadgeClass(status?: string): string {
  const s = (status || '').trim().toUpperCase();
  if (s === 'STAGE 1') return 'bg-slate-100 text-slate-800 border-slate-300';
  if (s === 'STAGE 2') return 'bg-amber-50 text-amber-900 border-amber-300';
  if (s === 'STAGE 3') return 'bg-sky-50 text-sky-900 border-sky-300';
  if (s === 'STAGE 4') return 'bg-emerald-50 text-emerald-900 border-emerald-300';
  return 'bg-[#f8f9fb] text-[#111111] border-[#cbd0da]';
}

function getStageBarColor(status: string): string {
  const s = status.trim().toUpperCase();
  if (s === 'STAGE 1') return '#4b5563';
  if (s === 'STAGE 2') return '#eab308';
  if (s === 'STAGE 3') return '#0284c7';
  if (s === 'STAGE 4') return '#16a34a';
  return '#111111';
}

export function DatabaseView({
  config,
  pageSize = 50,
  defaultEditMode = false,
  themeSettings,
  onUpdateConfig,
  onRefreshReviewCases,
  onNotify,
}: DatabaseViewProps) {
  const sheetCfg = config.caseSheetConfig;
  const separator = sheetCfg?.caseSeparator || '-';
  const safePageSize = Math.max(1, pageSize || 50);

  const [showImporter, setShowImporter] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(true);
  const [showMoreAddFields, setShowMoreAddFields] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [codeCaseFilter, setCodeCaseFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [journalFilter, setJournalFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [sortFilterOpen, setSortFilterOpen] = useState(false);
  const [editMode, setEditMode] = useState(defaultEditMode);
  const [currentPage, setCurrentPage] = useState(1);
  const [importPreviewPage, setImportPreviewPage] = useState(1);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(() => new Set());
  const [confirmDialog, setConfirmDialog] = useState<null | 'delete_all' | 'delete_selected'>(null);

  // Bulk Stage + Sub Status state
  const [bulkStage, setBulkStage] = useState<string>('STAGE 2');
  const [bulkSubStatus, setBulkSubStatus] = useState<string>('');

  // Google Workspace Auth & Sheets Sync State
  const [googleUser, setGoogleUser] = useState<User | null>(null);
  const [hasAccessToken, setHasAccessToken] = useState<boolean>(() => Boolean(getGoogleAccessToken()));
  const [authLoading, setAuthLoading] = useState(false);
  const [drivePickerOpen, setDrivePickerOpen] = useState(false);
  const [driveSpreadsheets, setDriveSpreadsheets] = useState<GoogleDriveSpreadsheetItem[]>([]);
  const [driveLoading, setDriveLoading] = useState(false);
  const [availableTabs, setAvailableTabs] = useState<GoogleSheetTabInfo[]>([]);
  const [connectedSheetTitle, setConnectedSheetTitle] = useState<string>('');
  const [pushingSheet, setPushingSheet] = useState(false);
  const [confirmPushOpen, setConfirmPushOpen] = useState(false);
  const [liveSyncSeconds, setLiveSyncSeconds] = useState<0 | 30 | 60>(0);

  // Add Single Case Record fields
  const [newId, setNewId] = useState('');
  const [newDate, setNewDate] = useState(() => formatDdMmmYy(new Date()));
  const [newPrefix, setNewPrefix] = useState('');
  const [newClientCode, setNewClientCode] = useState('');
  const [newRawCaseNo, setNewRawCaseNo] = useState('');
  const [newClientName, setNewClientName] = useState('');
  const [newAppName, setNewAppName] = useState('');
  const [newTm, setNewTm] = useState('');
  const [newClassNo, setNewClassNo] = useState('');
  const [newStatus, setNewStatus] = useState('STAGE 2');
  const [newSubStatus, setNewSubStatus] = useState('');
  const [newCaseType, setNewCaseType] = useState('TM');
  const [newAgent, setNewAgent] = useState('');
  const [newOffNote, setNewOffNote] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [newTm5, setNewTm5] = useState(false);
  const [newTm6, setNewTm6] = useState(false);
  const [newTm11, setNewTm11] = useState(false);
  const [newTm16, setNewTm16] = useState(false);
  const [newTm56, setNewTm56] = useState(false);
  const [newJournalNo, setNewJournalNo] = useState('');
  const [newJournalDate, setNewJournalDate] = useState('');
  const [newLastModified, setNewLastModified] = useState('');
  const [newImageUrl, setNewImageUrl] = useState('');

  // Importer / Sheet Config State
  const [sheetUrlOrId, setSheetUrlOrId] = useState(
    sheetCfg?.sheetUrlOrId || DEFAULT_APPS_SCRIPT_CASE_SHEET_ID
  );
  const [sheetName, setSheetName] = useState(
    sheetCfg?.sheetName || DEFAULT_APPS_SCRIPT_CASE_SHEET_NAME
  );
  const [mappingMode, setMappingMode] = useState<
    'auto' | 'sheet_col8_345' | 'date_start_22col' | 'three_col' | 'custom'
  >('auto');
  const [keyCol, setKeyCol] = useState(sheetCfg?.keyCol || 8);
  const [prefixCol, setPrefixCol] = useState(sheetCfg?.prefixCol || 3);
  const [clientCodeCol, setClientCodeCol] = useState(sheetCfg?.clientCodeCol || 4);
  const [caseCol, setCaseCol] = useState(sheetCfg?.caseCol || 5);
  const [clientCol, setClientCol] = useState(sheetCfg?.clientCol || 6);
  const [appNameCol, setAppNameCol] = useState(sheetCfg?.appNameCol || 7);

  const [rawImport, setRawImport] = useState('');
  const [sourceLabel, setSourceLabel] = useState('');
  const [fetchingSheet, setFetchingSheet] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [singleAddError, setSingleAddError] = useState<string | null>(null);
  const [duplicatePolicy, setDuplicatePolicy] = useState<'skip' | 'update'>('update');
  const [refreshReviewOnImport, setRefreshReviewOnImport] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsub = initGoogleAuthListener((user, token) => {
      setGoogleUser(user);
      setHasAccessToken(Boolean(token));
    });
    return unsub;
  }, []);

  const dbAnalysis = useMemo(
    () => analyzeCaseEntries(config.caseEntries, config.tmNumbers),
    [config.caseEntries, config.tmNumbers]
  );

  const stageCatalog = useMemo(
    () => deriveStageAndSubStatusCatalog(config.caseEntries),
    [config.caseEntries]
  );

  // Extended live chart metrics (Stage 1-4, Sub-Statuses, Nice Classes, Watchlist Overlap)
  const liveChartStats = useMemo(() => {
    const stageCounts = new Map<string, number>();
    for (const s of CANONICAL_STAGES) {
      stageCounts.set(s, 0);
    }
    const subCounts = new Map<string, number>();
    const classCounts = new Map<string, number>();

    for (const c of config.caseEntries) {
      const st = (c.status || '').trim().toUpperCase() || 'UNASSIGNED';
      stageCounts.set(st, (stageCounts.get(st) || 0) + 1);

      const sub = (c.subStatus || '').trim().toUpperCase();
      if (sub) subCounts.set(sub, (subCounts.get(sub) || 0) + 1);

      const cls = (c.classNo || '').trim();
      if (cls && cls !== '-') {
        classCounts.set(cls, (classCounts.get(cls) || 0) + 1);
      }
    }

    const stages = Array.from(stageCounts.entries()).map(([label, count]) => ({ label, count }));
    const topSubStatuses = Array.from(subCounts.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
    const topClasses = Array.from(classCounts.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    return { stages, topSubStatuses, topClasses };
  }, [config.caseEntries]);

  const journalOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of config.caseEntries) {
      const jn = (c.journalNumber || '').trim();
      if (jn) counts.set(jn, (counts.get(jn) || 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([journalNumber, count]) => ({ journalNumber, count }))
      .sort((a, b) => b.journalNumber.localeCompare(a.journalNumber, undefined, { numeric: true }));
  }, [config.caseEntries]);

  const statusOptions = useMemo(() => {
    const set = new Set<string>(stageCatalog.stages);
    for (const c of config.caseEntries) {
      if (c.status?.trim()) set.add(c.status.trim().toUpperCase());
    }
    return Array.from(set);
  }, [stageCatalog.stages, config.caseEntries]);

  const getSubStatusOptionsForStage = useCallback(
    (stage: string, currentVal?: string) => {
      const key = (stage || '').trim().toUpperCase();
      const stageSpecific = stageCatalog.subStatusesByStage[key] || [];
      const set = new Set<string>(stageSpecific);
      for (const s of stageCatalog.allSubStatuses) {
        set.add(s);
      }
      if (currentVal && currentVal.trim()) {
        set.add(currentVal.trim().toUpperCase());
      }
      return {
        stageSpecific,
        all: Array.from(set),
      };
    },
    [stageCatalog]
  );

  const parsedImport = useMemo(
    () =>
      parseCaseLookupInput(rawImport, {
        mappingMode,
        keyCol,
        prefixCol,
        clientCodeCol,
        caseCol,
        clientCol,
        appNameCol,
        caseSeparator: separator,
        preserveDuplicateTms: true,
      }),
    [rawImport, mappingMode, keyCol, prefixCol, clientCodeCol, caseCol, clientCol, appNameCol, separator]
  );

  const importDuplicateCheck = useMemo(
    () =>
      checkDuplicate(
        parsedImport.entries.map((entry) => entry.tmNumber).filter(Boolean),
        config.caseEntries.map((c) => c.tmNumber).filter(Boolean)
      ),
    [parsedImport.entries, config.caseEntries]
  );

  const importMergePreview = useMemo(
    () => mergeDatabaseEntries(config.caseEntries, parsedImport.entries, duplicatePolicy),
    [config.caseEntries, parsedImport.entries, duplicatePolicy]
  );

  const importPreviewTotalPages = Math.max(
    1,
    Math.ceil(parsedImport.entries.length / safePageSize)
  );
  const safeImportPreviewPage = Math.min(importPreviewPage, importPreviewTotalPages);
  const importPreviewSlice = useMemo(() => {
    const start = (safeImportPreviewPage - 1) * safePageSize;
    return parsedImport.entries.slice(start, start + safePageSize);
  }, [parsedImport.entries, safeImportPreviewPage, safePageSize]);

  const filteredEntries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const ccQ = codeCaseFilter.trim().toLowerCase();
    return config.caseEntries.filter((c) => {
      if (
        statusFilter !== 'ALL' &&
        (c.status || '').trim().toUpperCase() !== statusFilter.toUpperCase()
      ) {
        return false;
      }
      if (journalFilter !== 'ALL' && (c.journalNumber || '').trim() !== journalFilter) {
        return false;
      }
      if (ccQ) {
        const matchesClientCodeOrCase =
          (c.clientCode || '').toLowerCase().includes(ccQ) ||
          (c.rawCaseNo || '').toLowerCase().includes(ccQ) ||
          c.caseNo.toLowerCase().includes(ccQ) ||
          (c.prefix || '').toLowerCase().includes(ccQ) ||
          (c.id || '').toLowerCase().includes(ccQ);
        if (!matchesClientCodeOrCase) return false;
      }
      if (!q) return true;
      return (
        (c.id || '').toLowerCase().includes(q) ||
        c.tmNumber.toLowerCase().includes(q) ||
        c.caseNo.toLowerCase().includes(q) ||
        (c.clientCode || '').toLowerCase().includes(q) ||
        (c.applicationName || '').toLowerCase().includes(q) ||
        c.clientName.toLowerCase().includes(q) ||
        (c.status || '').toLowerCase().includes(q) ||
        (c.subStatus || '').toLowerCase().includes(q) ||
        (c.agent || '').toLowerCase().includes(q) ||
        (c.journalNumber || '').toLowerCase().includes(q)
      );
    });
  }, [config.caseEntries, searchQuery, codeCaseFilter, statusFilter, journalFilter]);

  const sortedEntries = useMemo(() => {
    const copy = [...filteredEntries];
    const dir = sortDir === 'asc' ? 1 : -1;

    copy.sort((a, b) => {
      if (sortBy === 'date') {
        const da = parseLooseDate(a.date || '')?.getTime() ?? -1;
        const db = parseLooseDate(b.date || '')?.getTime() ?? -1;
        if (da !== db) return (da - db) * dir;
        const idA = parseRecIdNumeric(a.id);
        const idB = parseRecIdNumeric(b.id);
        if (idA !== idB) return (idA - idB) * dir;
        return a.tmNumber.localeCompare(b.tmNumber, undefined, { numeric: true }) * dir;
      }
      if (sortBy === 'id') {
        const idA = parseRecIdNumeric(a.id);
        const idB = parseRecIdNumeric(b.id);
        if (idA !== idB) return (idA - idB) * dir;
        return (a.id || '').localeCompare(b.id || '', undefined, { numeric: true }) * dir;
      }
      if (sortBy === 'classNo' || sortBy === 'tmNumber' || sortBy === 'journalNumber') {
        const va = String(a[sortBy] || '').trim();
        const vb = String(b[sortBy] || '').trim();
        const na = Number(va);
        const nb = Number(vb);
        if (!Number.isNaN(na) && !Number.isNaN(nb) && va !== '' && vb !== '') {
          return (na - nb) * dir;
        }
        return va.localeCompare(vb, undefined, { numeric: true, sensitivity: 'base' }) * dir;
      }
      const va = String(a[sortBy] || '').trim();
      const vb = String(b[sortBy] || '').trim();
      return va.localeCompare(vb, undefined, { numeric: true, sensitivity: 'base' }) * dir;
    });
    return copy;
  }, [filteredEntries, sortBy, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sortedEntries.length / safePageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const visibleEntries = useMemo(() => {
    const start = (safePage - 1) * safePageSize;
    return sortedEntries.slice(start, start + safePageSize);
  }, [sortedEntries, safePage, safePageSize]);

  const allVisibleSelected =
    visibleEntries.length > 0 &&
    visibleEntries.every((c, idx) =>
      selectedKeys.has(getCaseEntryKey(c, (safePage - 1) * safePageSize + idx))
    );

  const handleToggleSort = (col: SortKey) => {
    if (sortBy === col) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(col);
      setSortDir(col === 'date' || col === 'id' ? 'desc' : 'asc');
    }
    setCurrentPage(1);
  };

  const handleUpdateEntryByKey = (targetKey: string, patch: Partial<CaseEntry>) => {
    const nextEntries = config.caseEntries.map((entry, idx) => {
      if (getCaseEntryKey(entry, idx) !== targetKey) return entry;
      const sanitizedPatch: Partial<CaseEntry> = { ...patch };
      if ('tmNumber' in sanitizedPatch && sanitizedPatch.tmNumber !== undefined) {
        sanitizedPatch.tmNumber = sanitizeTmCprValue(sanitizedPatch.tmNumber);
      }
      const updated: CaseEntry = {
        ...entry,
        ...sanitizedPatch,
        lastModified: formatDdMmmYy(new Date()),
      };
      if ('prefix' in patch || 'clientCode' in patch || 'rawCaseNo' in patch) {
        const recomputed = formatCompositeCaseNo(
          updated.prefix,
          updated.clientCode,
          updated.rawCaseNo,
          separator
        );
        if (recomputed) updated.caseNo = recomputed;
      }
      return updated;
    });
    onUpdateConfig({ ...config, caseEntries: nextEntries });
  };

  const handleBulkApplyStage = () => {
    if (selectedKeys.size === 0) return;
    const todayStr = formatDdMmmYy(new Date());
    const nextEntries = config.caseEntries.map((entry, idx) => {
      const k = getCaseEntryKey(entry, idx);
      if (!selectedKeys.has(k)) return entry;
      return {
        ...entry,
        status: bulkStage || entry.status,
        subStatus: bulkSubStatus || entry.subStatus,
        lastModified: todayStr,
      };
    });
    onUpdateConfig({ ...config, caseEntries: nextEntries });
    onNotify(
      `Updated Stage${bulkSubStatus ? ' & Sub-Status' : ''} for ${selectedKeys.size} selected record(s).`
    );
  };

  const handleToggleSelectRow = (rowKey: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(rowKey)) next.delete(rowKey);
      else next.add(rowKey);
      return next;
    });
  };

  const handleToggleSelectAllVisible = () => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        visibleEntries.forEach((c, idx) =>
          next.delete(getCaseEntryKey(c, (safePage - 1) * safePageSize + idx))
        );
      } else {
        visibleEntries.forEach((c, idx) =>
          next.add(getCaseEntryKey(c, (safePage - 1) * safePageSize + idx))
        );
      }
      return next;
    });
  };

  const handleDeleteSelected = () => {
    if (selectedKeys.size === 0) return;
    const removedCount = selectedKeys.size;
    onUpdateConfig({
      ...config,
      caseEntries: config.caseEntries.filter(
        (c, idx) => !selectedKeys.has(getCaseEntryKey(c, idx))
      ),
    });
    setSelectedKeys(new Set());
    setConfirmDialog(null);
    onNotify(`Deleted ${removedCount} selected record(s).`);
  };

  const handleDeleteAllRecords = () => {
    const total = config.caseEntries.length;
    onUpdateConfig({
      ...config,
      caseEntries: [],
    });
    setSelectedKeys(new Set());
    setConfirmDialog(null);
    setCurrentPage(1);
    onNotify(`Deleted all ${total} database record(s).`);
  };

  const handleRemoveEntry = (rowKey: string) => {
    onUpdateConfig({
      ...config,
      caseEntries: config.caseEntries.filter(
        (c, idx) => getCaseEntryKey(c, idx) !== rowKey
      ),
    });
    setSelectedKeys((prev) => {
      if (!prev.has(rowKey)) return prev;
      const next = new Set(prev);
      next.delete(rowKey);
      return next;
    });
  };

  const handleAddSingleRecord = (e: React.FormEvent) => {
    e.preventDefault();
    const tm = sanitizeTmCprValue(newTm).trim();
    const composite =
      formatCompositeCaseNo(newPrefix, newClientCode, newRawCaseNo, separator) || 'NOT FOUND';
    if (!tm && !newClientName.trim() && !newAppName.trim()) {
      setSingleAddError('Enter TM/CPR Number or Application/Client details.');
      return;
    }

    if (tm) {
      const dupCheck = checkDuplicate(
        tm,
        config.caseEntries.map((c) => c.tmNumber)
      );
      if (dupCheck.isDuplicate) {
        const duplicate = config.caseEntries.find((c) => c.tmNumber.trim() === tm);
        setSingleAddError(
          `TM ${tm} already exists (Case ${duplicate?.caseNo || 'existing'}).`
        );
        return;
      }
    }
    setSingleAddError(null);

    const maxRecNum = config.caseEntries.reduce(
      (max, item) => Math.max(max, parseRecIdNumeric(item.id)),
      2400
    );
    const resolvedId = newId.trim() || `REC-${maxRecNum + 1}`;
    const resolvedDate = newDate.trim() || formatDdMmmYy(new Date());

    const entry: CaseEntry = {
      id: resolvedId,
      date: resolvedDate,
      prefix: newPrefix.trim() || undefined,
      clientCode: newClientCode.trim() || undefined,
      rawCaseNo: newRawCaseNo.trim() || undefined,
      caseNo: composite,
      clientName: newClientName.trim(),
      applicationName: newAppName.trim() || undefined,
      tmNumber: tm,
      classNo: newClassNo.trim() || undefined,
      status: newStatus.trim() || undefined,
      subStatus: newSubStatus.trim() || undefined,
      caseType: newCaseType.trim() || undefined,
      agent: newAgent.trim() || undefined,
      offNote: newOffNote.trim() || undefined,
      notes: newNotes.trim() || undefined,
      tm5: newTm5 ? 'TRUE' : 'FALSE',
      tm6: newTm6 ? 'TRUE' : 'FALSE',
      tm11: newTm11 ? 'TRUE' : 'FALSE',
      tm16: newTm16 ? 'TRUE' : 'FALSE',
      tm56: newTm56 ? 'TRUE' : 'FALSE',
      journalNumber: newJournalNo.trim() || undefined,
      journalDate: newJournalDate.trim() || undefined,
      lastModified: newLastModified.trim() || resolvedDate,
      imageUrl: newImageUrl.trim() || undefined,
    };

    onUpdateConfig({ ...config, caseEntries: [entry, ...config.caseEntries] });
    setNewId('');
    setNewTm('');
    setNewPrefix('');
    setNewClientCode('');
    setNewRawCaseNo('');
    setNewAppName('');
    setNewClientName('');
    setNewClassNo('');
    setNewSubStatus('');
    setNewAgent('');
    setNewOffNote('');
    setNewNotes('');
    setNewTm5(false);
    setNewTm6(false);
    setNewTm11(false);
    setNewTm16(false);
    setNewTm56(false);
    setNewJournalNo('');
    setNewJournalDate('');
    setNewLastModified('');
    setNewImageUrl('');
    onNotify(`Added ${resolvedId} (${tm || composite}).`);
  };

  // Google Sign-In & Drive Picker
  const handleGoogleSignIn = async () => {
    setAuthLoading(true);
    setImportError(null);
    try {
      const { user, accessToken } = await signInWithGoogleWorkspace();
      setGoogleUser(user);
      setHasAccessToken(Boolean(accessToken));
      onNotify(`Connected Google account (${user.email || 'Authorized'}).`);
      if (accessToken && sheetUrlOrId.trim()) {
        try {
          const meta = await getSpreadsheetMetadata(sheetUrlOrId);
          setAvailableTabs(meta.sheets);
          setConnectedSheetTitle(meta.title);
        } catch {
          // ignore initial metadata lookup error
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Google Sign-In cancelled or blocked.';
      setImportError(msg);
      onNotify(msg);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleGoogleSignOut = async () => {
    await signOutGoogleWorkspace();
    setGoogleUser(null);
    setHasAccessToken(false);
    setLiveSyncSeconds(0);
    onNotify('Disconnected Google Sheets account.');
  };

  const handleOpenDrivePicker = async () => {
    if (!hasAccessToken) {
      onNotify('Sign in with Google first to browse your Drive spreadsheets.');
      return;
    }
    setDrivePickerOpen(true);
    setDriveLoading(true);
    try {
      const files = await listUserSpreadsheets();
      setDriveSpreadsheets(files);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Failed to list Drive spreadsheets.');
    } finally {
      setDriveLoading(false);
    }
  };

  const handleSelectDriveSpreadsheet = async (item: GoogleDriveSpreadsheetItem) => {
    setSheetUrlOrId(item.id);
    setConnectedSheetTitle(item.name);
    setDrivePickerOpen(false);
    try {
      const meta = await getSpreadsheetMetadata(item.id);
      setAvailableTabs(meta.sheets);
      if (meta.sheets.length > 0) {
        const preferred =
          meta.sheets.find((t) => t.title.toUpperCase() === 'DATABASE') || meta.sheets[0];
        setSheetName(preferred.title);
      }
      onNotify(`Selected "${item.name}". Click Sync Google Sheet to pull records.`);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Selected sheet, ready to sync.');
    }
  };

  const handleFetchGoogleSheet = useCallback(
    async (autoApply = false, silent = false) => {
      if (!sheetUrlOrId.trim()) {
        if (!silent) setImportError('Enter a Google Sheet URL, Sheet ID, or Published CSV link.');
        return;
      }

      setFetchingSheet(true);
      if (!silent) setImportError(null);
      if (!autoApply && !silent) setShowImporter(true);

      try {
        // Prefer Google Sheets API v4 when authenticated with OAuth token
        if (hasAccessToken && getGoogleAccessToken()) {
          const apiRes = await readGoogleSheetViaApi(sheetUrlOrId, sheetName, {
            mappingMode,
            keyCol,
            prefixCol,
            clientCodeCol,
            caseCol,
            clientCol,
            appNameCol,
            caseSeparator: separator,
            preserveDuplicateTms: true,
          });
          setAvailableTabs(apiRes.availableTabs);
          setConnectedSheetTitle(apiRes.spreadsheetTitle);
          setSheetName(apiRes.sheetTitle);

          if (autoApply) {
            const merged = mergeDatabaseEntries(config.caseEntries, apiRes.entries, 'update');
            const nextSheetCfg: CaseSheetConfig = {
              sheetUrlOrId: sheetUrlOrId.trim(),
              sheetName: apiRes.sheetTitle,
              keyCol,
              prefixCol,
              clientCodeCol,
              caseCol,
              clientCol,
              appNameCol,
              caseSeparator: separator,
              lastSyncedAt: new Date().toISOString(),
            };
            onUpdateConfig({
              ...config,
              caseEntries: merged.merged,
              caseSheetConfig: nextSheetCfg,
            });
            onRefreshReviewCases(merged.merged);
            if (!silent) {
              setShowAnalysis(true);
              setCurrentPage(1);
              onNotify(
                `Google Sheets API synced (${apiRes.spreadsheetTitle} · ${apiRes.sheetTitle}): ${apiRes.entries.length} rows (${merged.added} new, ${merged.updated} updated).`
              );
            }
          } else {
            const csvText = exportRowsToCsv(
              [
                'ID', 'DATE', 'TYPE', 'CLIENT CODE', 'CASE NUMBER', 'CLIENT NAME',
                'APPLICATION NAME', 'TM/CPR NUMBER', 'CLASS', 'STATUS', 'SUB STATUS',
                'CASE TYPE', 'AGENT', 'OFF NOTE', 'NOTES', 'TM5', 'TM6', 'TM11',
                'TM16', 'TM56', 'JOURNAL NUMBER', 'JOURNAL DATE', 'LAST MODIFIED', 'IMAGE',
              ],
              apiRes.entries.map((c) => [
                c.id || '', c.date || '', c.prefix || '', c.clientCode || '',
                c.rawCaseNo || '', c.clientName, c.applicationName || '', c.tmNumber,
                c.classNo || '', c.status || '', c.subStatus || '', c.caseType || '',
                c.agent || '', c.offNote || '', c.notes || '', c.tm5 || 'FALSE',
                c.tm6 || 'FALSE', c.tm11 || 'FALSE', c.tm16 || 'FALSE', c.tm56 || 'FALSE',
                c.journalNumber || '', c.journalDate || '', c.lastModified || '', c.imageUrl || '',
              ])
            );
            setRawImport(csvText);
            setImportPreviewPage(1);
            setSourceLabel(`Google API (${apiRes.spreadsheetTitle} · ${apiRes.sheetTitle})`);
          }
          return;
        }

        // Public CSV fallback when user hasn't signed into Google OAuth
        const { text } = await fetchGoogleSheetCsvSmart(sheetUrlOrId, sheetName);

        if (autoApply) {
          const parsed = parseCaseLookupInput(text, {
            mappingMode,
            keyCol,
            prefixCol,
            clientCodeCol,
            caseCol,
            clientCol,
            appNameCol,
            caseSeparator: separator,
            preserveDuplicateTms: true,
          });
          if (parsed.entries.length === 0) {
            if (!silent) {
              setShowImporter(true);
              setRawImport(text);
              setImportPreviewPage(1);
              setImportError('Sheet fetched, but no matching rows were detected. Adjust mapping below.');
            }
            return;
          }
          const merged = mergeDatabaseEntries(config.caseEntries, parsed.entries, 'update');
          const nextSheetCfg: CaseSheetConfig = {
            sheetUrlOrId: sheetUrlOrId.trim(),
            sheetName: sheetName.trim(),
            keyCol,
            prefixCol,
            clientCodeCol,
            caseCol,
            clientCol,
            appNameCol,
            caseSeparator: separator,
            lastSyncedAt: new Date().toISOString(),
          };
          onUpdateConfig({
            ...config,
            caseEntries: merged.merged,
            caseSheetConfig: nextSheetCfg,
          });
          onRefreshReviewCases(merged.merged);
          if (!silent) {
            setShowAnalysis(true);
            setCurrentPage(1);
            onNotify(
              `Synced (${sheetName || 'DATABASE'}): ${parsed.totalCsvRows} CSV rows → ${parsed.entries.length} indexed (${merged.added} new, ${merged.updated} updated).`
            );
          }
        } else {
          setRawImport(text);
          setImportPreviewPage(1);
          setSourceLabel(`Google Sheet (${sheetName || 'DATABASE'})`);
        }
      } catch (err) {
        if (!silent) {
          setShowImporter(true);
          const msg = err instanceof Error ? err.message : '';
          if (msg === 'NEEDS_GOOGLE_AUTH') {
            setHasAccessToken(false);
            setImportError('Google session expired. Click Sign in with Google to reconnect.');
          } else if (msg === 'GOOGLE_LOGIN_HTML') {
            setImportError(
              'Sheet is private. Click "Sign in with Google" above to read/write private sheets securely, or paste CSV rows below.'
            );
          } else {
            setImportError(
              msg || 'Unable to fetch Google Sheet CSV directly. Sign in with Google or paste CSV rows below.'
            );
          }
        }
      } finally {
        setFetchingSheet(false);
      }
    },
    [
      sheetUrlOrId,
      sheetName,
      hasAccessToken,
      mappingMode,
      keyCol,
      prefixCol,
      clientCodeCol,
      caseCol,
      clientCol,
      appNameCol,
      separator,
      config,
      onUpdateConfig,
      onRefreshReviewCases,
      onNotify,
    ]
  );

  // Live Auto-Sync Interval (pauses safely when user enters Edit Mode)
  useEffect(() => {
    if (liveSyncSeconds <= 0 || editMode) return;
    const timer = window.setInterval(() => {
      handleFetchGoogleSheet(true, true);
    }, liveSyncSeconds * 1000);
    return () => window.clearInterval(timer);
  }, [liveSyncSeconds, editMode, handleFetchGoogleSheet]);

  const handleConfirmPushToGoogleSheet = async () => {
    if (!hasAccessToken || !getGoogleAccessToken()) {
      setConfirmPushOpen(false);
      onNotify('Sign in with Google first to update your Google Sheet.');
      return;
    }
    setPushingSheet(true);
    try {
      const result = await writeCaseEntriesToGoogleSheet(
        sheetUrlOrId,
        sheetName,
        config.caseEntries
      );
      setConnectedSheetTitle(result.spreadsheetTitle);
      onUpdateConfig({
        ...config,
        caseSheetConfig: {
          sheetUrlOrId: sheetUrlOrId.trim(),
          sheetName: result.sheetTitle,
          keyCol,
          prefixCol,
          clientCodeCol,
          caseCol,
          clientCol,
          appNameCol,
          caseSeparator: separator,
          lastSyncedAt: new Date().toISOString(),
        },
      });
      setConfirmPushOpen(false);
      onNotify(
        `Updated Google Sheet "${result.spreadsheetTitle}" (${result.sheetTitle}) with ${result.updatedRows} record(s).`
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update Google Sheet.';
      if (msg === 'NEEDS_GOOGLE_AUTH') {
        setHasAccessToken(false);
      }
      onNotify(msg);
    } finally {
      setPushingSheet(false);
    }
  };

  const handleApplyImport = (mode: 'merge' | 'replace') => {
    if (parsedImport.entries.length === 0) return;
    let nextEntries: CaseEntry[];
    let summaryMsg = '';

    if (mode === 'replace') {
      nextEntries = parsedImport.entries;
      summaryMsg = `Database replaced with ${nextEntries.length} record(s) from ${parsedImport.totalCsvRows} CSV rows.`;
    } else {
      const result = mergeDatabaseEntries(config.caseEntries, parsedImport.entries, duplicatePolicy);
      nextEntries = result.merged;
      summaryMsg =
        duplicatePolicy === 'skip'
          ? `Merged: ${result.added} added, ${result.skippedDuplicates} duplicate skipped.`
          : `Merged: ${result.added} added, ${result.updated} updated.`;
    }

    const nextSheetCfg: CaseSheetConfig = {
      sheetUrlOrId: sheetUrlOrId.trim(),
      sheetName: sheetName.trim(),
      keyCol,
      prefixCol,
      clientCodeCol,
      caseCol,
      clientCol,
      appNameCol,
      caseSeparator: separator,
      lastSyncedAt: new Date().toISOString(),
    };

    onUpdateConfig({
      ...config,
      caseEntries: nextEntries,
      caseSheetConfig: nextSheetCfg,
    });

    if (refreshReviewOnImport) {
      onRefreshReviewCases(nextEntries);
    }
    setRawImport('');
    setShowImporter(false);
    setCurrentPage(1);
    onNotify(summaryMsg);
  };

  const handleSyncMissingTmsToWatchlist = () => {
    if (dbAnalysis.missingFromWatchlistTms.length === 0) {
      onNotify('All 6-digit TM Numbers from Cases Database are already in Watchlist.');
      return;
    }
    const { merged, added } = mergeUniqueTmNumbers(
      config.tmNumbers,
      dbAnalysis.missingFromWatchlistTms,
      true
    );
    onUpdateConfig({ ...config, tmNumbers: merged });
    onNotify(`Synced ${added} TM number(s) to Watchlist.`);
  };

  const handleExportCsv = () => {
    const csv = exportRowsToCsv(
      [
        'ID', 'DATE', 'TYPE', 'CLIENT CODE', 'CASE NUMBER', 'CLIENT NAME',
        'APPLICATION NAME', 'TM/CPR NUMBER', 'CLASS', 'STATUS', 'SUB STATUS',
        'CASE TYPE', 'AGENT', 'OFF NOTE', 'NOTES', 'TM5', 'TM6', 'TM11',
        'TM16', 'TM56', 'JOURNAL NUMBER', 'JOURNAL DATE', 'LAST MODIFIED', 'IMAGE',
      ],
      sortedEntries.map((c) => [
        c.id || '', c.date || '', c.prefix || '', c.clientCode || '',
        c.rawCaseNo || '', c.clientName, c.applicationName || '', c.tmNumber,
        c.classNo || '', c.status || '', c.subStatus || '', c.caseType || '',
        c.agent || '', c.offNote || '', c.notes || '', c.tm5 || '',
        c.tm6 || '', c.tm11 || '', c.tm16 || '', c.tm56 || '',
        c.journalNumber || '', c.journalDate || '', c.lastModified || '', c.imageUrl || '',
      ])
    );
    const suffix = journalFilter !== 'ALL' ? `_Journal_${journalFilter}` : '';
    triggerFileDownload(csv, `Cases_Database${suffix}.csv`, 'text/csv;charset=utf-8');
  };

  const previewNewCaseNo = formatCompositeCaseNo(newPrefix, newClientCode, newRawCaseNo, separator);

  const sortableColumns: { key: SortKey; label: string; align?: 'center' }[] = [
    { key: 'id', label: 'ID' },
    { key: 'date', label: 'DATE' },
    { key: 'prefix', label: 'TYPE' },
    { key: 'clientCode', label: 'CLIENT CODE' },
    { key: 'rawCaseNo', label: 'CASE NUMBER' },
    { key: 'caseNo', label: 'FORMATTED' },
    { key: 'clientName', label: 'CLIENT NAME' },
    { key: 'applicationName', label: 'APPLICATION NAME' },
    { key: 'tmNumber', label: 'TM/CPR NUMBER' },
    { key: 'classNo', label: 'CLASS', align: 'center' },
    { key: 'status', label: 'STATUS' },
    { key: 'subStatus', label: 'SUB STATUS' },
    { key: 'caseType', label: 'CASE TYPE' },
    { key: 'agent', label: 'AGENT' },
  ];

  const activeFilterCount =
    (searchQuery.trim() ? 1 : 0) +
    (codeCaseFilter.trim() ? 1 : 0) +
    (statusFilter !== 'ALL' ? 1 : 0) +
    (journalFilter !== 'ALL' ? 1 : 0);

  const addSubCatalog = getSubStatusOptionsForStage(newStatus, newSubStatus);
  const bulkSubCatalog = getSubStatusOptionsForStage(bulkStage, bulkSubStatus);

  // SVG Donut Watchlist Coverage calculations
  const totalUniqueTms = Math.max(1, dbAnalysis.uniqueTmCount);
  const coveragePct = Math.round((dbAnalysis.matchedWatchlistCount / totalUniqueTms) * 100);
  const donutCircumference = 2 * Math.PI * 30;
  const donutDash = (coveragePct / 100) * donutCircumference;

  return (
    <div className="space-y-6">
      {/* Header Toolbar */}
      <div className="bg-white border border-[#e2e4ea] p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2.5">
            <BrandexButtonIcon
              name="database"
              size={34}
              colorMode={themeSettings?.imageColorMode}
            />
            <h2 className="text-xl font-extrabold tracking-tight text-[#111111]">
              Cases Database
            </h2>
            <span className="bg-[#ffee00] text-[#111111] px-2.5 py-0.5 text-xs font-extrabold tabular-nums">
              {config.caseEntries.length} Records
            </span>
            <span className="bg-[#f6f7f9] border border-[#cbd0da] text-[#111111] px-2 py-0.5 text-[11px] font-bold">
              {connectedSheetTitle ? `${connectedSheetTitle} · ` : ''}
              {sheetName || 'DATABASE'}
            </span>
            {liveSyncSeconds > 0 && (
              <span className="bg-emerald-50 border border-emerald-300 text-emerald-900 px-2 py-0.5 text-[11px] font-bold inline-flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                Live {liveSyncSeconds}s
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <GoogleSignInButton
              user={googleUser}
              hasAccessToken={hasAccessToken}
              loading={authLoading}
              onSignIn={handleGoogleSignIn}
              onSignOut={handleGoogleSignOut}
              compact
            />

            {googleUser && hasAccessToken && (
              <button
                type="button"
                onClick={handleOpenDrivePicker}
                className="h-[36px] px-3 border border-[#cbd0da] bg-[#f8f9fb] hover:border-[#111111] hover:bg-white text-xs font-bold text-[#111111] inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <FolderSearch className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Drive Sheets</span>
              </button>
            )}

            <button
              type="button"
              disabled={fetchingSheet}
              onClick={() => handleFetchGoogleSheet(true)}
              className="builty-btn h-[36px] pl-3 pr-3 gap-2 text-xs whitespace-nowrap"
            >
              <BrandexButtonIcon
                name="databaseMapping"
                variant="square"
                size={18}
                colorMode={themeSettings?.imageColorMode}
              />
              <span>{fetchingSheet ? 'Syncing…' : 'Pull Sheet'}</span>
            </button>

            <button
              type="button"
              disabled={pushingSheet || config.caseEntries.length === 0}
              onClick={() => {
                if (!hasAccessToken) {
                  handleGoogleSignIn();
                } else {
                  setConfirmPushOpen(true);
                }
              }}
              className="h-[36px] px-3 border border-[#111111] bg-[#111111] text-[#ffee00] hover:bg-[#222222] disabled:opacity-40 text-xs font-extrabold inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <CloudUpload className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{pushingSheet ? 'Pushing…' : 'Push to Sheet'}</span>
            </button>

            <select
              aria-label="Live Google Sheet auto-sync interval"
              value={liveSyncSeconds}
              onChange={(e) => setLiveSyncSeconds(Number(e.target.value) as 0 | 30 | 60)}
              className="h-[36px] px-2 border border-[#cbd0da] bg-[#f8f9fb] text-xs font-bold text-[#111111]"
            >
              <option value={0}>Live Sync: Off</option>
              <option value={30}>Live Sync: 30s</option>
              <option value={60}>Live Sync: 60s</option>
            </select>
          </div>
        </div>

        {/* Secondary Actions Row */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-[#eceef2]">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowImporter((prev) => !prev)}
              className="h-[34px] px-3 border border-[#111111] bg-white hover:bg-[#fffef0] text-xs font-bold text-[#111111] inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <Database className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{showImporter ? 'Hide Sheet / CSV Setup' : 'Sheet Setup / Import CSV'}</span>
            </button>

            <button
              type="button"
              data-sfx="filter"
              data-active={showAnalysis}
              onClick={() => setShowAnalysis((prev) => !prev)}
              className={`builty-filter-btn h-[34px] px-2.5 border text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap ${
                showAnalysis
                  ? 'border-[#111111] bg-[#fffef0] text-[#111111]'
                  : 'border-[#cbd0da] bg-[#f8f9fb] text-[#555a66] hover:text-[#111111]'
              }`}
            >
              <BrandexButtonIcon
                name="analysis"
                variant="square"
                size={18}
                colorMode={themeSettings?.imageColorMode}
              />
              <span>Live Charts &amp; Stats</span>
            </button>

            <button
              type="button"
              onClick={() => onRefreshReviewCases(config.caseEntries)}
              className="h-[34px] px-2.5 border border-[#cbd0da] bg-[#f8f9fb] hover:border-[#111111] hover:bg-white text-xs font-bold text-[#111111] inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Refresh Cases</span>
            </button>

            <button
              type="button"
              onClick={handleExportCsv}
              className="h-[34px] px-3 border border-[#cbd0da] bg-white hover:border-[#111111] text-xs font-bold text-[#111111] inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Export {journalFilter !== 'ALL' ? `Jrn ${journalFilter}` : 'CSV'}</span>
            </button>
          </div>

          {selectedKeys.size > 0 && (
            <div className="flex flex-wrap items-center gap-2 bg-[#fffef0] border border-[#111111] px-2.5 py-1">
              <span className="text-[11px] font-extrabold text-[#111111] tabular-nums">
                {selectedKeys.size} Selected:
              </span>
              <select
                aria-label="Bulk stage select"
                value={bulkStage}
                onChange={(e) => {
                  setBulkStage(e.target.value);
                  setBulkSubStatus('');
                }}
                className="bg-white border border-[#cbd0da] px-2 py-1 text-[11px] font-bold text-[#111111]"
              >
                {statusOptions.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
              <select
                aria-label="Bulk sub status select"
                value={bulkSubStatus}
                onChange={(e) => setBulkSubStatus(e.target.value)}
                className="bg-white border border-[#cbd0da] px-2 py-1 text-[11px] font-semibold text-[#111111]"
              >
                <option value="">Keep / Select Sub Status…</option>
                {bulkSubCatalog.all.map((sub) => (
                  <option key={sub} value={sub}>
                    {sub}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleBulkApplyStage}
                className="h-[26px] px-2.5 bg-[#ffee00] hover:bg-[#e6d600] text-[#111111] text-[11px] font-extrabold"
              >
                Apply Stage
              </button>
              <button
                type="button"
                onClick={() => setConfirmDialog('delete_selected')}
                className="h-[26px] px-2.5 bg-red-600 hover:bg-red-700 text-white text-[11px] font-bold inline-flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" aria-hidden="true" />
                <span>Delete</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Live Charts & Graphs Card */}
      {showAnalysis && (
        <section
          aria-label="Cases Database Live Charts and Summary"
          className="bg-white border border-[#e2e4ea] p-5 space-y-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#eceef2] pb-3">
            <div>
              <h3 className="text-sm font-extrabold text-[#111111]">
                Live Database Analytics &amp; Charts
              </h3>
              <p className="text-xs text-[#555a66]">
                Latest Record Date:{' '}
                <span className="font-mono font-bold text-[#111111]">
                  {dbAnalysis.latestDate || '—'}
                </span>
                {sheetCfg?.lastSyncedAt && (
                  <> · Sheet Synced {new Date(sheetCfg.lastSyncedAt).toLocaleString()}</>
                )}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {statusFilter !== 'ALL' && (
                <button
                  type="button"
                  onClick={() => {
                    setStatusFilter('ALL');
                    setCurrentPage(1);
                  }}
                  className="h-[32px] px-2.5 border border-[#111111] bg-[#ffee00] text-[#111111] text-xs font-extrabold inline-flex items-center gap-1"
                >
                  <span>Stage Filter: {statusFilter}</span>
                  <X className="w-3 h-3" aria-hidden="true" />
                </button>
              )}

              {dbAnalysis.missingFromWatchlistTms.length > 0 && (
                <button
                  type="button"
                  onClick={handleSyncMissingTmsToWatchlist}
                  className="h-[32px] px-3 bg-[#ffee00] hover:bg-[#e6d600] text-[#111111] text-xs font-extrabold inline-flex items-center gap-1.5"
                >
                  <ShieldPlus className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Add {dbAnalysis.missingFromWatchlistTms.length} Unwatched TMs</span>
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {/* Chart 1: Cases by Stage 1-4 (Clickable Filter Bars) */}
            <div className="bg-[#f8f9fb] border border-[#e2e4ea] p-4 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-extrabold text-[#111111] uppercase tracking-wider">
                  Stages (Click to Filter)
                </span>
                <span className="font-mono font-bold text-[#555a66] tabular-nums">
                  {dbAnalysis.totalRecords} total
                </span>
              </div>
              <div className="space-y-2">
                {liveChartStats.stages.map((st) => {
                  const pct =
                    dbAnalysis.totalRecords > 0
                      ? Math.round((st.count / dbAnalysis.totalRecords) * 100)
                      : 0;
                  const active = statusFilter.toUpperCase() === st.label.toUpperCase();
                  return (
                    <button
                      key={st.label}
                      type="button"
                      onClick={() => {
                        setStatusFilter(active ? 'ALL' : st.label);
                        setCurrentPage(1);
                      }}
                      className={`w-full text-left p-1 transition-colors ${
                        active ? 'bg-[#fffef0] ring-1 ring-[#111111]' : 'hover:bg-white'
                      }`}
                    >
                      <div className="flex justify-between text-[11px] font-bold text-[#111111] tabular-nums mb-0.5">
                        <span className="truncate">{st.label}</span>
                        <span className="font-mono">
                          {st.count} ({pct}%)
                        </span>
                      </div>
                      <div className="h-2 bg-[#e2e4ea] overflow-hidden">
                        <div
                          className="h-full transition-all duration-300"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: getStageBarColor(st.label),
                          }}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Chart 2: Top Sub-Statuses */}
            <div className="bg-[#f8f9fb] border border-[#e2e4ea] p-4 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-extrabold text-[#111111] uppercase tracking-wider">
                  Top Sub-Statuses
                </span>
                <span className="font-mono font-bold text-[#555a66] tabular-nums">
                  {stageCatalog.allSubStatuses.length} active
                </span>
              </div>
              <div className="space-y-1.5">
                {liveChartStats.topSubStatuses.length === 0 ? (
                  <p className="text-xs text-[#555a66] py-6 text-center">No sub-status data yet.</p>
                ) : (
                  liveChartStats.topSubStatuses.map((sub) => {
                    const maxSub = Math.max(1, liveChartStats.topSubStatuses[0]?.count || 1);
                    const widthPct = Math.round((sub.count / maxSub) * 100);
                    return (
                      <div key={sub.label} className="space-y-0.5">
                        <div className="flex justify-between text-[11px] font-semibold text-[#111111] tabular-nums">
                          <span className="truncate max-w-[160px]" title={sub.label}>
                            {sub.label}
                          </span>
                          <span className="font-mono font-bold">{sub.count}</span>
                        </div>
                        <div className="h-1.5 bg-[#e2e4ea]">
                          <div
                            className="h-full bg-[#111111] transition-all duration-300"
                            style={{ width: `${widthPct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Chart 3: Watchlist Donut + TM Flags SVG */}
            <div className="bg-[#f8f9fb] border border-[#e2e4ea] p-4 flex flex-col justify-between gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-[#111111] uppercase tracking-wider">
                  Watchlist &amp; TM Flags
                </span>
                <span className="text-[11px] font-mono font-bold text-[#555a66]">
                  {dbAnalysis.uniqueTmCount} TMs
                </span>
              </div>

              <div className="flex items-center gap-3">
                <svg width="76" height="76" viewBox="0 0 76 76" className="shrink-0" aria-label="Watchlist coverage chart">
                  <circle cx="38" cy="38" r="30" fill="none" stroke="#e2e4ea" strokeWidth="8" />
                  <circle
                    cx="38"
                    cy="38"
                    r="30"
                    fill="none"
                    stroke="#111111"
                    strokeWidth="8"
                    strokeDasharray={`${donutDash} ${donutCircumference}`}
                    strokeDashoffset="0"
                    transform="rotate(-90 38 38)"
                  />
                  <text
                    x="38"
                    y="42"
                    textAnchor="middle"
                    fontSize="13"
                    fontWeight="800"
                    fill="#111111"
                  >
                    {coveragePct}%
                  </text>
                </svg>

                <div className="text-[11px] space-y-1 tabular-nums">
                  <div className="font-bold text-[#111111]">
                    Watched: <span className="font-mono">{dbAnalysis.matchedWatchlistCount}</span>
                  </div>
                  <div className="text-[#555a66]">
                    Unwatched:{' '}
                    <span className="font-mono font-bold text-[#111111]">
                      {dbAnalysis.missingFromWatchlistTms.length}
                    </span>
                  </div>
                </div>
              </div>

              {/* TM5..56 Vertical Bar Mini Chart */}
              <div className="grid grid-cols-5 gap-1.5 pt-2 border-t border-[#e2e4ea] text-center tabular-nums">
                {[
                  { label: 'TM5', val: dbAnalysis.tmFlagCounts.tm5 },
                  { label: 'TM6', val: dbAnalysis.tmFlagCounts.tm6 },
                  { label: 'TM11', val: dbAnalysis.tmFlagCounts.tm11 },
                  { label: 'TM16', val: dbAnalysis.tmFlagCounts.tm16 },
                  { label: 'TM56', val: dbAnalysis.tmFlagCounts.tm56 },
                ].map((f) => {
                  const maxF = Math.max(
                    1,
                    dbAnalysis.tmFlagCounts.tm5,
                    dbAnalysis.tmFlagCounts.tm6,
                    dbAnalysis.tmFlagCounts.tm11,
                    dbAnalysis.tmFlagCounts.tm16,
                    dbAnalysis.tmFlagCounts.tm56
                  );
                  const barH = Math.max(4, Math.round((f.val / maxF) * 24));
                  return (
                    <div key={f.label} className="flex flex-col items-center">
                      <div className="h-[26px] w-full flex items-end justify-center">
                        <div
                          className="w-4 bg-[#ffee00] border border-[#111111]"
                          style={{ height: `${barH}px` }}
                        />
                      </div>
                      <span className="text-[9.5px] font-mono font-bold text-[#111111] mt-0.5">
                        {f.val}
                      </span>
                      <span className="text-[9px] font-bold text-[#555a66]">{f.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Chart 4: Top Nice Classes (1-45) */}
            <div className="bg-[#f8f9fb] border border-[#e2e4ea] p-4 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-extrabold text-[#111111] uppercase tracking-wider">
                  Top Classes (1–45)
                </span>
                <span className="font-mono font-bold text-[#555a66]">
                  {dbAnalysis.topAgents[0]?.label || '—'}
                </span>
              </div>
              {liveChartStats.topClasses.length === 0 ? (
                <p className="text-xs text-[#555a66] py-6 text-center">No Nice Class data yet.</p>
              ) : (
                <div className="grid grid-cols-4 gap-2 pt-1 tabular-nums">
                  {liveChartStats.topClasses.map((cl) => (
                    <div
                      key={cl.label}
                      className="bg-white border border-[#e2e4ea] px-2 py-1.5 text-center"
                    >
                      <div className="text-[10px] font-bold text-[#555a66]">CLS {cl.label}</div>
                      <div className="text-xs font-mono font-extrabold text-[#111111]">
                        {cl.count}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Expandable Database Importer & Sheet Setup */}
      {showImporter && (
        <section
          aria-label="Google Sheet Connection and CSV Importer"
          className="bg-white border border-[#d4d7e0] shadow-sm"
        >
          <div className="px-6 py-4 bg-[#111111] text-white flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <BrandexButtonIcon
                name="databaseMapping"
                variant="square"
                size={24}
                colorMode={themeSettings?.imageColorMode}
              />
              <h3 className="text-sm font-extrabold">Google Sheets Sync &amp; CSV Importer</h3>
            </div>
            <button
              type="button"
              onClick={() => {
                setRawImport(SAMPLE_DATABASE_CSV);
                setSourceLabel('Sample rows');
                setImportPreviewPage(1);
                setImportError(null);
              }}
              className="h-[32px] px-3 bg-[#ffee00] text-[#111111] text-xs font-bold hover:bg-[#e6d600]"
            >
              Load Sample Rows
            </button>
          </div>

          <div className="p-6 space-y-5">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-end">
              <div className="lg:col-span-6">
                <label htmlFor="db-sheet-url" className="block text-xs font-bold text-[#111111] mb-1">
                  Google Sheet URL, ID, or CSV Link
                </label>
                <input
                  id="db-sheet-url"
                  type="text"
                  value={sheetUrlOrId}
                  onChange={(e) => setSheetUrlOrId(e.target.value)}
                  className="w-full bg-[#f8f9fb] border border-[#cbd0da] px-3 py-2 text-xs font-mono text-[#111111] focus:bg-white focus:outline-none focus:border-[#111111]"
                />
              </div>
              <div className="lg:col-span-3">
                <label htmlFor="db-sheet-name" className="block text-xs font-bold text-[#111111] mb-1">
                  Sheet Tab Name
                </label>
                {availableTabs.length > 0 ? (
                  <select
                    id="db-sheet-name"
                    value={sheetName}
                    onChange={(e) => setSheetName(e.target.value)}
                    className="w-full bg-[#f8f9fb] border border-[#cbd0da] px-3 py-2 text-xs font-bold text-[#111111]"
                  >
                    {availableTabs.map((t) => (
                      <option key={t.sheetId} value={t.title}>
                        {t.title}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    id="db-sheet-name"
                    type="text"
                    value={sheetName}
                    onChange={(e) => setSheetName(e.target.value)}
                    className="w-full bg-[#f8f9fb] border border-[#cbd0da] px-3 py-2 text-xs text-[#111111] focus:bg-white focus:outline-none focus:border-[#111111]"
                  />
                )}
              </div>
              <div className="lg:col-span-3">
                <button
                  type="button"
                  onClick={() => handleFetchGoogleSheet(false)}
                  disabled={fetchingSheet}
                  className="builty-btn h-[36px] w-full pl-4 pr-3 gap-2 text-xs"
                >
                  <Globe className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{fetchingSheet ? 'Fetching…' : 'Preview Sheet Rows'}</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end border-t border-b border-[#eceef2] py-3">
              <div className="md:col-span-6">
                <label htmlFor="db-mapping-preset" className="block text-xs font-bold text-[#111111] mb-1">
                  Column Mapping
                </label>
                <select
                  id="db-mapping-preset"
                  value={mappingMode}
                  onChange={(e) =>
                    setMappingMode(
                      e.target.value as
                        | 'auto'
                        | 'sheet_col8_345'
                        | 'date_start_22col'
                        | 'three_col'
                        | 'custom'
                    )
                  }
                  className="w-full bg-[#f8f9fb] border border-[#cbd0da] px-3 py-2 text-xs font-semibold text-[#111111]"
                >
                  <option value="auto">Auto-detect Headers</option>
                  <option value="sheet_col8_345">Standard Sheet (TM Col 8 · Case Cols 3-4-5)</option>
                  <option value="date_start_22col">DATE-Start Export (TM Col 7 · Case Cols 2-3-4)</option>
                  <option value="three_col">Simple 3-Column (TM, Case, Client)</option>
                  <option value="custom">Custom Column Numbers</option>
                </select>
              </div>

              <div className="md:col-span-6 flex items-center justify-end gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.tsv,.txt"
                  className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      const text = await f.text();
                      setRawImport(text);
                      setSourceLabel(f.name);
                      setImportPreviewPage(1);
                      setImportError(null);
                      e.target.value = '';
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="h-[36px] px-3.5 border border-[#cbd0da] bg-white hover:border-[#111111] text-xs font-bold text-[#111111] inline-flex items-center gap-1.5"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Upload CSV / TSV</span>
                </button>
                {sourceLabel && (
                  <span className="text-xs font-semibold text-[#555a66]">{sourceLabel}</span>
                )}
              </div>

              {mappingMode === 'custom' && (
                <div className="md:col-span-12 grid grid-cols-2 sm:grid-cols-6 gap-2.5 pt-2">
                  {[
                    { label: 'TM/CPR Col #', val: keyCol, set: setKeyCol },
                    { label: 'Prefix Col #', val: prefixCol, set: setPrefixCol },
                    { label: 'Client Code Col #', val: clientCodeCol, set: setClientCodeCol },
                    { label: 'Case No Col #', val: caseCol, set: setCaseCol },
                    { label: 'Client Col #', val: clientCol, set: setClientCol },
                    { label: 'App Name Col #', val: appNameCol, set: setAppNameCol },
                  ].map((field) => (
                    <div key={field.label}>
                      <label className="block text-[11px] font-bold text-[#111111] mb-1">
                        {field.label}
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={field.val}
                        onChange={(e) => field.set(Math.max(1, Number(e.target.value) || 1))}
                        className="w-full bg-[#f8f9fb] border border-[#cbd0da] px-2 py-1.5 text-xs font-mono"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <textarea
              rows={4}
              value={rawImport}
              onChange={(e) => {
                setRawImport(e.target.value);
                setImportPreviewPage(1);
                setSourceLabel('Pasted rows');
              }}
              placeholder="Paste CSV or TSV rows here..."
              className="w-full bg-[#f8f9fb] border border-[#cbd0da] p-3 text-xs font-mono text-[#111111] focus:bg-white focus:outline-none focus:border-[#111111]"
            />

            {importError && (
              <div className="p-3 bg-amber-50 border border-amber-300 text-xs font-medium text-amber-900">
                {importError}
              </div>
            )}

            {parsedImport.entries.length > 0 && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-[#111111] tabular-nums">
                  <div className="flex flex-wrap items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />
                    <span className="font-bold">
                      {parsedImport.totalCsvRows} CSV rows read → {parsedImport.entries.length} records
                      ({importDuplicateCheck.unique.length} new TMs
                      {parsedImport.blankTmRows > 0 ? ` · ${parsedImport.blankTmRows} blank TM` : ''})
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-4">
                    <div className="inline-flex border border-[#cbd0da] bg-white">
                      <button
                        type="button"
                        data-sfx="filter"
                        data-active={duplicatePolicy === 'skip'}
                        onClick={() => setDuplicatePolicy('skip')}
                        className={`builty-filter-btn px-2.5 py-1 text-[11px] font-bold ${
                          duplicatePolicy === 'skip'
                            ? 'bg-[#ffee00] text-[#111111]'
                            : 'text-[#555a66] hover:text-[#111111]'
                        }`}
                      >
                        Skip Duplicates
                      </button>
                      <button
                        type="button"
                        data-sfx="filter"
                        data-active={duplicatePolicy === 'update'}
                        onClick={() => setDuplicatePolicy('update')}
                        className={`builty-filter-btn px-2.5 py-1 text-[11px] font-bold ${
                          duplicatePolicy === 'update'
                            ? 'bg-[#ffee00] text-[#111111]'
                            : 'text-[#555a66] hover:text-[#111111]'
                        }`}
                      >
                        Update Existing
                      </button>
                    </div>

                    <label className="inline-flex items-center gap-2 cursor-pointer font-semibold">
                      <input
                        type="checkbox"
                        checked={refreshReviewOnImport}
                        onChange={(e) => setRefreshReviewOnImport(e.target.checked)}
                        className="w-4 h-4 accent-[#111111]"
                      />
                      <span>Update Review Queue</span>
                    </label>
                  </div>
                </div>

                {/* 50-row Import Preview Pagination Bar */}
                <div className="flex items-center justify-between text-xs text-[#555a66] bg-[#f8f9fb] border border-[#e2e4ea] px-3 py-1.5 tabular-nums">
                  <span>
                    Preview {(safeImportPreviewPage - 1) * safePageSize + 1}–
                    {Math.min(parsedImport.entries.length, safeImportPreviewPage * safePageSize)} of{' '}
                    {parsedImport.entries.length}
                  </span>
                  <div className="inline-flex items-center border border-[#cbd0da] bg-white">
                    <button
                      type="button"
                      disabled={safeImportPreviewPage <= 1}
                      onClick={() => setImportPreviewPage((p) => Math.max(1, p - 1))}
                      className="h-[26px] px-2 text-[11px] font-bold text-[#111111] hover:bg-[#ffee00] disabled:opacity-40 inline-flex items-center gap-0.5 border-r border-[#cbd0da]"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Back</span>
                    </button>
                    <span className="px-2 text-[11px] font-mono font-bold text-[#111111]">
                      {safeImportPreviewPage} / {importPreviewTotalPages}
                    </span>
                    <button
                      type="button"
                      disabled={safeImportPreviewPage >= importPreviewTotalPages}
                      onClick={() =>
                        setImportPreviewPage((p) => Math.min(importPreviewTotalPages, p + 1))
                      }
                      className="h-[26px] px-2 text-[11px] font-bold text-[#111111] hover:bg-[#ffee00] disabled:opacity-40 inline-flex items-center gap-0.5 border-l border-[#cbd0da]"
                    >
                      <span>Next</span>
                      <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </div>

                <div className="border border-[#e2e4ea] overflow-x-auto max-h-[300px]">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="sticky top-0 bg-[#111111] text-white text-[11px] uppercase tracking-wider">
                      <tr>
                        <th className="py-2 px-3">ID</th>
                        <th className="py-2 px-3">Date</th>
                        <th className="py-2 px-3">TM/CPR No</th>
                        <th className="py-2 px-3">Case No</th>
                        <th className="py-2 px-3">Application Name</th>
                        <th className="py-2 px-3">Status</th>
                        <th className="py-2 px-3">Agent</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#eceef2] bg-white">
                      {importPreviewSlice.map((entry, idx) => (
                        <tr key={`${entry.id || ''}_${entry.tmNumber}_${idx}`}>
                          <td className="py-2 px-3 font-mono text-[#555a66]">{entry.id || '—'}</td>
                          <td className="py-2 px-3 font-mono text-[#555a66]">{entry.date || '—'}</td>
                          <td className="py-2 px-3 font-mono font-bold tabular-nums">
                            {entry.tmNumber || '—'}
                          </td>
                          <td className="py-2 px-3 font-mono font-extrabold text-[#111111]">
                            {entry.caseNo}
                          </td>
                          <td className="py-2 px-3 text-[#111111] font-semibold">
                            {entry.applicationName || entry.clientName || '—'}
                          </td>
                          <td className="py-2 px-3 text-[#555a66]">
                            {[entry.status, entry.subStatus].filter(Boolean).join(' · ') || '—'}
                          </td>
                          <td className="py-2 px-3 text-[#555a66]">{entry.agent || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-wrap justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => handleApplyImport('merge')}
                    className="h-[38px] px-4 border border-[#111111] bg-white text-xs font-bold text-[#111111] hover:bg-[#f6f7f9]"
                  >
                    {duplicatePolicy === 'skip'
                      ? `Merge (+${importMergePreview.added} New)`
                      : `Merge (${importMergePreview.added} New, ${importMergePreview.updated} Update)`}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyImport('replace')}
                    className="builty-btn h-[38px] pl-4 pr-3 gap-2 text-xs"
                  >
                    <span>Replace Database ({parsedImport.entries.length})</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Add Single Case Record */}
      <form
        onSubmit={handleAddSingleRecord}
        className="bg-white border border-[#e2e4ea] p-5 space-y-3"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-extrabold text-[#111111]">Add Original Case Record</h3>
          <div className="flex items-center gap-2">
            {previewNewCaseNo && (
              <span className="text-xs font-mono font-bold text-[#111111] bg-[#fffef0] border border-[#111111] px-2.5 py-0.5">
                Case No: {previewNewCaseNo}
              </span>
            )}
            <button
              type="button"
              data-sfx="filter"
              onClick={() => setShowMoreAddFields((p) => !p)}
              className="h-[30px] px-2.5 border border-[#cbd0da] bg-[#f8f9fb] hover:border-[#111111] text-[11px] font-bold text-[#111111] inline-flex items-center gap-1"
            >
              {showMoreAddFields ? (
                <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
              )}
              <span>{showMoreAddFields ? 'Fewer Fields' : 'More Fields'}</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
          <input
            type="text"
            value={newId}
            onChange={(e) => setNewId(e.target.value)}
            placeholder="ID (REC-2436)"
            aria-label="Record ID"
            className="bg-[#f8f9fb] border border-[#cbd0da] px-2.5 py-2 text-xs font-mono text-[#111111] focus:bg-white focus:outline-none focus:border-[#111111]"
          />
          <input
            type="date"
            value={toHtmlDateInputValue(newDate)}
            onChange={(e) => setNewDate(fromHtmlDateInputValue(e.target.value))}
            aria-label="Case Date Picker"
            title={`Date: ${newDate}`}
            className="bg-[#f8f9fb] border border-[#cbd0da] px-2 py-2 text-xs font-mono text-[#111111] focus:bg-white focus:outline-none focus:border-[#111111]"
          />
          <input
            type="text"
            value={newPrefix}
            onChange={(e) => setNewPrefix(e.target.value)}
            placeholder="TYPE (A/X/N)"
            aria-label="Type"
            className="bg-[#f8f9fb] border border-[#cbd0da] px-2.5 py-2 text-xs font-mono text-[#111111] focus:bg-white focus:outline-none focus:border-[#111111]"
          />
          <input
            type="text"
            value={newClientCode}
            onChange={(e) => setNewClientCode(e.target.value)}
            placeholder="CLIENT CODE"
            aria-label="Client Code"
            className="bg-[#f8f9fb] border border-[#cbd0da] px-2.5 py-2 text-xs font-mono text-[#111111] focus:bg-white focus:outline-none focus:border-[#111111]"
          />
          <input
            type="text"
            value={newRawCaseNo}
            onChange={(e) => setNewRawCaseNo(e.target.value)}
            placeholder="CASE NUMBER"
            aria-label="Case Number"
            className="bg-[#f8f9fb] border border-[#cbd0da] px-2.5 py-2 text-xs font-mono text-[#111111] focus:bg-white focus:outline-none focus:border-[#111111]"
          />
          <input
            type="text"
            value={newClientName}
            onChange={(e) => setNewClientName(e.target.value)}
            placeholder="CLIENT NAME"
            aria-label="Client Name"
            className="bg-[#f8f9fb] border border-[#cbd0da] px-2.5 py-2 text-xs text-[#111111] focus:bg-white focus:outline-none focus:border-[#111111]"
          />
          <input
            type="text"
            value={newAppName}
            onChange={(e) => setNewAppName(e.target.value)}
            placeholder="APPLICATION NAME"
            aria-label="Application Name"
            className="bg-[#f8f9fb] border border-[#cbd0da] px-2.5 py-2 text-xs text-[#111111] focus:bg-white focus:outline-none focus:border-[#111111]"
          />

          <input
            type="text"
            inputMode="numeric"
            value={newTm}
            onChange={(e) => setNewTm(sanitizeTmCprValue(e.target.value))}
            placeholder="TM/CPR (0-9, -)"
            aria-label="TM or CPR Number (numbers and hyphen only)"
            className="bg-[#fffef0] border border-[#111111] px-2.5 py-2 text-xs font-mono font-bold text-[#111111] focus:bg-white focus:outline-none"
          />

          <select
            value={newClassNo}
            onChange={(e) => setNewClassNo(e.target.value)}
            aria-label="Trademark Class (1-45)"
            className="bg-[#f8f9fb] border border-[#cbd0da] px-2 py-2 text-xs font-mono font-bold text-[#111111] focus:bg-white focus:outline-none focus:border-[#111111]"
          >
            <option value="">CLASS (1–45)</option>
            <option value="-">-</option>
            {NICE_CLASS_NUMBERS.map((num) => (
              <option key={num} value={num}>
                Class {num}
              </option>
            ))}
          </select>

          <select
            value={newStatus}
            onChange={(e) => {
              const nextSt = e.target.value;
              setNewStatus(nextSt);
              const nextSubs = stageCatalog.subStatusesByStage[nextSt] || [];
              if (nextSubs.length > 0 && !nextSubs.includes(newSubStatus)) {
                setNewSubStatus('');
              }
            }}
            aria-label="Stage Status (STAGE 1 to STAGE 4)"
            className="bg-[#f8f9fb] border border-[#cbd0da] px-2 py-2 text-xs font-bold text-[#111111] focus:bg-white focus:outline-none focus:border-[#111111]"
          >
            {statusOptions.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>

          <select
            value={newSubStatus}
            onChange={(e) => setNewSubStatus(e.target.value)}
            aria-label="Sub Status"
            className="bg-[#f8f9fb] border border-[#cbd0da] px-2 py-2 text-xs font-semibold text-[#111111] focus:bg-white focus:outline-none focus:border-[#111111]"
          >
            <option value="">SUB STATUS…</option>
            {addSubCatalog.stageSpecific.length > 0 && (
              <optgroup label={`${newStatus} Sub-Statuses`}>
                {addSubCatalog.stageSpecific.map((sub) => (
                  <option key={`stage_${sub}`} value={sub}>
                    {sub}
                  </option>
                ))}
              </optgroup>
            )}
            <optgroup label="All Database Sub-Statuses">
              {addSubCatalog.all
                .filter((s) => !addSubCatalog.stageSpecific.includes(s))
                .map((sub) => (
                  <option key={`all_${sub}`} value={sub}>
                    {sub}
                  </option>
                ))}
            </optgroup>
          </select>

          <input
            type="text"
            value={newCaseType}
            onChange={(e) => setNewCaseType(e.target.value)}
            placeholder="CASE TYPE"
            aria-label="Case Type"
            className="bg-[#f8f9fb] border border-[#cbd0da] px-2.5 py-2 text-xs font-mono text-[#111111] focus:bg-white focus:outline-none focus:border-[#111111]"
          />
          <input
            type="text"
            value={newAgent}
            onChange={(e) => setNewAgent(e.target.value)}
            placeholder="AGENT"
            aria-label="Agent"
            className="bg-[#f8f9fb] border border-[#cbd0da] px-2.5 py-2 text-xs text-[#111111] focus:bg-white focus:outline-none focus:border-[#111111]"
          />
          <button
            type="submit"
            className="bg-[#ffee00] text-[#111111] text-xs font-extrabold hover:bg-[#e6d600] inline-flex items-center justify-center gap-1.5 px-3 py-2"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Add Case</span>
          </button>
        </div>

        {showMoreAddFields && (
          <div className="pt-3 border-t border-[#eceef2] space-y-2.5">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
              <input
                type="text"
                value={newOffNote}
                onChange={(e) => setNewOffNote(e.target.value)}
                placeholder="OFF NOTE"
                className="bg-[#f8f9fb] border border-[#cbd0da] px-2.5 py-2 text-xs text-[#111111]"
              />
              <input
                type="text"
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                placeholder="NOTES"
                className="bg-[#f8f9fb] border border-[#cbd0da] px-2.5 py-2 text-xs text-[#111111]"
              />
              <input
                type="text"
                value={newJournalNo}
                onChange={(e) => setNewJournalNo(e.target.value)}
                placeholder="JOURNAL NUMBER"
                className="bg-[#f8f9fb] border border-[#cbd0da] px-2.5 py-2 text-xs font-mono text-[#111111]"
              />
              <input
                type="text"
                value={newJournalDate}
                onChange={(e) => setNewJournalDate(e.target.value)}
                placeholder="JOURNAL DATE"
                className="bg-[#f8f9fb] border border-[#cbd0da] px-2.5 py-2 text-xs font-mono text-[#111111]"
              />
              <input
                type="text"
                value={newLastModified}
                onChange={(e) => setNewLastModified(e.target.value)}
                placeholder="LAST MODIFIED"
                className="bg-[#f8f9fb] border border-[#cbd0da] px-2.5 py-2 text-xs font-mono text-[#111111]"
              />
              <input
                type="text"
                value={newImageUrl}
                onChange={(e) => setNewImageUrl(e.target.value)}
                placeholder="IMAGE URL"
                className="bg-[#f8f9fb] border border-[#cbd0da] px-2.5 py-2 text-xs font-mono text-[#111111]"
              />
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs text-[#111111]">
              <span className="font-bold text-[#555a66]">TM Flags:</span>
              {[
                { label: 'TM5', checked: newTm5, set: setNewTm5 },
                { label: 'TM6', checked: newTm6, set: setNewTm6 },
                { label: 'TM11', checked: newTm11, set: setNewTm11 },
                { label: 'TM16', checked: newTm16, set: setNewTm16 },
                { label: 'TM56', checked: newTm56, set: setNewTm56 },
              ].map((flag) => (
                <label key={flag.label} className="inline-flex items-center gap-1.5 font-mono font-bold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={flag.checked}
                    onChange={(e) => flag.set(e.target.checked)}
                    className="w-3.5 h-3.5 accent-[#111111]"
                  />
                  <span>{flag.label}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {singleAddError && (
          <p className="text-xs font-semibold text-red-600">{singleAddError}</p>
        )}
      </form>

      {/* Search + Journal Tabs + Sort & Filter + Pagination + Delete All + Table */}
      <div className="bg-white border border-[#e2e4ea] overflow-hidden space-y-0">
        {/* Per-Journal Quick Separation Strip (when Journal Nos exist in Database) */}
        {journalOptions.length > 0 && (
          <div className="px-4 py-2.5 bg-[#f8f9fb] border-b border-[#e2e4ea] flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#555a66] mr-1">
              Journal No:
            </span>
            <button
              type="button"
              data-sfx="filter"
              onClick={() => {
                setJournalFilter('ALL');
                setCurrentPage(1);
              }}
              className={`px-2.5 py-1 border text-[11px] font-bold tabular-nums ${
                journalFilter === 'ALL'
                  ? 'border-[#111111] bg-[#ffee00] text-[#111111]'
                  : 'border-[#cbd0da] bg-white text-[#555a66] hover:text-[#111111]'
              }`}
            >
              All ({config.caseEntries.length})
            </button>
            {journalOptions.map((opt) => (
              <button
                key={opt.journalNumber}
                type="button"
                data-sfx="filter"
                onClick={() => {
                  setJournalFilter(opt.journalNumber);
                  setCurrentPage(1);
                }}
                className={`px-2.5 py-1 border text-[11px] font-bold font-mono tabular-nums ${
                  journalFilter === opt.journalNumber
                    ? 'border-[#111111] bg-[#ffee00] text-[#111111]'
                    : 'border-[#cbd0da] bg-white text-[#555a66] hover:text-[#111111]'
                }`}
              >
                Jrn {opt.journalNumber} ({opt.count})
              </button>
            ))}
          </div>
        )}

        <div className="p-4 border-b border-[#e2e4ea] flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1">
            <div className="relative flex-1 max-w-md">
              <Search
                className="w-4 h-4 text-[#6b7280] absolute left-3 top-1/2 -translate-y-1/2"
                aria-hidden="true"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search ID, TM No, App Name, Client, Agent…"
                aria-label="Search database records"
                className="w-full bg-[#f8f9fb] border border-[#cbd0da] pl-9 pr-3 py-2 text-xs text-[#111111] focus:bg-white focus:outline-none focus:border-[#111111]"
              />
            </div>

            <div className="relative flex-1 max-w-xs">
              <Search
                className="w-3.5 h-3.5 text-[#6b7280] absolute left-3 top-1/2 -translate-y-1/2"
                aria-hidden="true"
              />
              <input
                type="text"
                value={codeCaseFilter}
                onChange={(e) => {
                  setCodeCaseFilter(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Filter Client Code or Case No…"
                aria-label="Filter by Client Code or Case Number"
                className="w-full bg-[#fffef0] border border-[#cbd0da] pl-8 pr-3 py-2 text-xs font-mono text-[#111111] focus:bg-white focus:outline-none focus:border-[#111111]"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-[11px] font-bold text-[#555a66]">
              {editMode ? 'Edit Mode: ON' : 'Read-Only (Edit Mode OFF)'}
            </span>
          </div>
        </div>

        <TableControlsBar
          totalItems={sortedEntries.length}
          pageSize={safePageSize}
          currentPage={safePage}
          onPageChange={setCurrentPage}
          sortFilterOpen={sortFilterOpen}
          onToggleSortFilter={() => setSortFilterOpen((o) => !o)}
          sortFilterActiveCount={activeFilterCount}
          editMode={editMode}
          onToggleEditMode={() => setEditMode((m) => !m)}
          onRequestDeleteAll={() => setConfirmDialog('delete_all')}
          deleteAllDisabled={config.caseEntries.length === 0}
        />

        {sortFilterOpen && (
          <div className="px-4 pb-3 pt-1 bg-[#f8f9fb] border-b border-[#e2e4ea]">
            <TableSortInlinePanel
              sortField={sortBy}
              sortDir={sortDir}
              options={sortableColumns.map((c) => ({ value: c.key, label: c.label }))}
              onChangeSortField={(f) => {
                setSortBy(f as SortKey);
                setCurrentPage(1);
              }}
              onToggleSortDir={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
              onResetFilters={() => {
                setSearchQuery('');
                setCodeCaseFilter('');
                setStatusFilter('ALL');
                setJournalFilter('ALL');
                setSortBy('date');
                setSortDir('desc');
                setCurrentPage(1);
              }}
            >
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                aria-label="Filter by status"
                className="bg-white border border-[#cbd0da] px-2.5 py-1 text-xs font-bold text-[#111111]"
              >
                <option value="ALL">All Stages</option>
                {statusOptions.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </TableSortInlinePanel>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[2350px] text-xs">
            <thead className="bg-[#111111] text-white text-[11px] uppercase tracking-wider">
              <tr>
                <th className="py-3 px-3 w-10 text-center sticky left-0 z-10 bg-[#111111]">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={handleToggleSelectAllVisible}
                    aria-label="Select all visible database records"
                    className="w-4 h-4 accent-[#ffee00] cursor-pointer"
                  />
                </th>

                {sortableColumns.map((col) => {
                  const activeSort = sortBy === col.key;
                  return (
                    <th
                      key={col.key}
                      className={`py-3 px-3 whitespace-nowrap ${col.align === 'center' ? 'text-center' : ''}`}
                    >
                      <button
                        type="button"
                        data-sfx="filter"
                        onClick={() => handleToggleSort(col.key)}
                        className={`inline-flex items-center gap-1 uppercase font-extrabold tracking-wider hover:text-[#ffee00] ${
                          activeSort ? 'text-[#ffee00]' : 'text-white'
                        }`}
                      >
                        <span>{col.label}</span>
                      </button>
                    </th>
                  );
                })}

                <th className="py-3 px-3 whitespace-nowrap">OFF NOTE</th>
                <th className="py-3 px-3 whitespace-nowrap">NOTES</th>
                <th className="py-3 px-2 text-center whitespace-nowrap">TM5</th>
                <th className="py-3 px-2 text-center whitespace-nowrap">TM6</th>
                <th className="py-3 px-2 text-center whitespace-nowrap">TM11</th>
                <th className="py-3 px-2 text-center whitespace-nowrap">TM16</th>
                <th className="py-3 px-2 text-center whitespace-nowrap">TM56</th>
                <th className="py-3 px-3 whitespace-nowrap">JOURNAL NO</th>
                <th className="py-3 px-3 whitespace-nowrap">JOURNAL DATE</th>
                <th className="py-3 px-3 whitespace-nowrap">LAST MODIFIED</th>
                <th className="py-3 px-3 whitespace-nowrap">IMAGE</th>
                <th className="py-3 px-3 text-right whitespace-nowrap">Action</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-[#eceef2] bg-white">
              {visibleEntries.map((c, idx) => {
                const rowKey = getCaseEntryKey(c, (safePage - 1) * safePageSize + idx);
                const isSelected = selectedKeys.has(rowKey);

                const renderEditableText = (
                  value: string | undefined,
                  field: keyof CaseEntry,
                  className = ''
                ) => {
                  if (editMode) {
                    return (
                      <input
                        type="text"
                        value={value || ''}
                        onChange={(e) =>
                          handleUpdateEntryByKey(rowKey, { [field]: e.target.value })
                        }
                        className={`w-full min-w-[78px] bg-[#fffef0] border border-[#cbd0da] focus:border-[#111111] px-1.5 py-0.5 text-xs ${className}`}
                      />
                    );
                  }
                  return <span className={className}>{value || '—'}</span>;
                };

                const renderFlag = (val?: string, flagKey?: 'tm5' | 'tm6' | 'tm11' | 'tm16' | 'tm56') => {
                  const upper = String(val || '').trim().toUpperCase();
                  const isTrue = upper === 'TRUE';
                  if (editMode && flagKey) {
                    return (
                      <input
                        type="checkbox"
                        checked={isTrue}
                        onChange={(e) =>
                          handleUpdateEntryByKey(rowKey, {
                            [flagKey]: e.target.checked ? 'TRUE' : 'FALSE',
                          })
                        }
                        aria-label={`${flagKey.toUpperCase()} flag for ${c.id || c.tmNumber}`}
                        className="w-3.5 h-3.5 accent-[#111111] cursor-pointer"
                      />
                    );
                  }
                  if (isTrue) {
                    return (
                      <span className="px-1.5 py-0.5 bg-[#ffee00] text-[#111111] font-mono font-extrabold text-[10px]">
                        TRUE
                      </span>
                    );
                  }
                  return <span className="font-mono text-[#9ca3af] text-[10.5px]">{upper || '—'}</span>;
                };

                const rowSubCatalog = getSubStatusOptionsForStage(c.status || '', c.subStatus);

                return (
                  <tr
                    key={`${rowKey}_${idx}`}
                    className={isSelected ? 'bg-[#fffef0]' : 'hover:bg-[#f7f8fa]'}
                  >
                    <td
                      className={`py-2.5 px-3 text-center sticky left-0 ${
                        isSelected ? 'bg-[#fffef0]' : 'bg-white'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSelectRow(rowKey)}
                        aria-label={`Select record ${c.id || c.tmNumber}`}
                        className="w-4 h-4 accent-[#111111] cursor-pointer"
                      />
                    </td>
                    <td className="py-2.5 px-3 font-mono font-semibold text-[#555a66] whitespace-nowrap">
                      {renderEditableText(c.id, 'id')}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[#111111] whitespace-nowrap">
                      {editMode ? (
                        <input
                          type="date"
                          value={toHtmlDateInputValue(c.date)}
                          onChange={(e) =>
                            handleUpdateEntryByKey(rowKey, {
                              date: fromHtmlDateInputValue(e.target.value),
                            })
                          }
                          aria-label={`Date for ${c.id || c.tmNumber}`}
                          className="bg-[#fffef0] border border-[#cbd0da] focus:border-[#111111] px-1.5 py-0.5 text-xs font-mono"
                        />
                      ) : (
                        <span>{c.date || '—'}</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold text-[#111111] whitespace-nowrap">
                      {renderEditableText(c.prefix, 'prefix')}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[#111111] whitespace-nowrap">
                      {renderEditableText(c.clientCode, 'clientCode')}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[#111111] whitespace-nowrap">
                      {renderEditableText(c.rawCaseNo, 'rawCaseNo')}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className="px-2 py-0.5 bg-[#fffef0] border border-[#111111] font-mono font-extrabold text-[#111111]">
                        {renderEditableText(c.caseNo, 'caseNo')}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-[#4b505c] max-w-[180px] truncate" title={c.clientName}>
                      {renderEditableText(c.clientName, 'clientName')}
                    </td>
                    <td
                      className="py-2.5 px-3 font-semibold text-[#111111] max-w-[210px] truncate"
                      title={c.applicationName}
                    >
                      {renderEditableText(c.applicationName, 'applicationName')}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold text-[#111111] tabular-nums whitespace-nowrap">
                      {editMode ? (
                        <input
                          type="text"
                          inputMode="numeric"
                          value={c.tmNumber || ''}
                          onChange={(e) =>
                            handleUpdateEntryByKey(rowKey, {
                              tmNumber: sanitizeTmCprValue(e.target.value),
                            })
                          }
                          placeholder="0-9, -"
                          className="w-[104px] bg-[#fffef0] border border-[#cbd0da] focus:border-[#111111] px-1.5 py-0.5 text-xs font-mono font-bold"
                        />
                      ) : (
                        <span>{c.tmNumber || '—'}</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono tabular-nums whitespace-nowrap">
                      {editMode ? (
                        <select
                          value={c.classNo || ''}
                          onChange={(e) =>
                            handleUpdateEntryByKey(rowKey, { classNo: e.target.value })
                          }
                          aria-label={`Class for ${c.id || c.tmNumber}`}
                          className="bg-[#fffef0] border border-[#cbd0da] focus:border-[#111111] px-1.5 py-0.5 text-xs font-mono font-bold"
                        >
                          <option value="">—</option>
                          <option value="-">-</option>
                          {NICE_CLASS_NUMBERS.map((num) => (
                            <option key={num} value={num}>
                              {num}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span>{c.classNo || '—'}</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-[#111111] whitespace-nowrap">
                      {editMode ? (
                        <select
                          value={(c.status || '').trim().toUpperCase()}
                          onChange={(e) =>
                            handleUpdateEntryByKey(rowKey, { status: e.target.value })
                          }
                          aria-label={`Stage status for ${c.id || c.tmNumber}`}
                          className="bg-[#fffef0] border border-[#cbd0da] focus:border-[#111111] px-1.5 py-0.5 text-xs font-bold text-[#111111]"
                        >
                          <option value="">—</option>
                          {statusOptions.map((st) => (
                            <option key={st} value={st}>
                              {st}
                            </option>
                          ))}
                        </select>
                      ) : c.status ? (
                        <span
                          className={`inline-block px-2 py-0.5 border text-[10.5px] font-extrabold ${getStageBadgeClass(
                            c.status
                          )}`}
                        >
                          {c.status}
                        </span>
                      ) : (
                        <span>—</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-[#4b505c] whitespace-nowrap">
                      {editMode ? (
                        <select
                          value={(c.subStatus || '').trim().toUpperCase()}
                          onChange={(e) =>
                            handleUpdateEntryByKey(rowKey, { subStatus: e.target.value })
                          }
                          aria-label={`Sub status for ${c.id || c.tmNumber}`}
                          className="bg-[#fffef0] border border-[#cbd0da] focus:border-[#111111] px-1.5 py-0.5 text-xs font-semibold text-[#111111]"
                        >
                          <option value="">—</option>
                          {rowSubCatalog.stageSpecific.length > 0 && (
                            <optgroup label={`${c.status || 'Stage'} Sub-Statuses`}>
                              {rowSubCatalog.stageSpecific.map((sub) => (
                                <option key={`rs_${sub}`} value={sub}>
                                  {sub}
                                </option>
                              ))}
                            </optgroup>
                          )}
                          <optgroup label="All Database Sub-Statuses">
                            {rowSubCatalog.all
                              .filter((s) => !rowSubCatalog.stageSpecific.includes(s))
                              .map((sub) => (
                                <option key={`ra_${sub}`} value={sub}>
                                  {sub}
                                </option>
                              ))}
                          </optgroup>
                        </select>
                      ) : (
                        <span>{c.subStatus || '—'}</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[#555a66] whitespace-nowrap">
                      {renderEditableText(c.caseType, 'caseType')}
                    </td>
                    <td className="py-2.5 px-3 text-[#111111] whitespace-nowrap">
                      {renderEditableText(c.agent, 'agent')}
                    </td>
                    <td className="py-2.5 px-3 text-[#555a66] max-w-[160px] truncate" title={c.offNote}>
                      {renderEditableText(c.offNote, 'offNote')}
                    </td>
                    <td className="py-2.5 px-3 text-[#555a66] max-w-[160px] truncate" title={c.notes}>
                      {renderEditableText(c.notes, 'notes')}
                    </td>
                    <td className="py-2.5 px-2 text-center whitespace-nowrap">{renderFlag(c.tm5, 'tm5')}</td>
                    <td className="py-2.5 px-2 text-center whitespace-nowrap">{renderFlag(c.tm6, 'tm6')}</td>
                    <td className="py-2.5 px-2 text-center whitespace-nowrap">{renderFlag(c.tm11, 'tm11')}</td>
                    <td className="py-2.5 px-2 text-center whitespace-nowrap">{renderFlag(c.tm16, 'tm16')}</td>
                    <td className="py-2.5 px-2 text-center whitespace-nowrap">{renderFlag(c.tm56, 'tm56')}</td>
                    <td className="py-2.5 px-3 font-mono text-[#111111] whitespace-nowrap">
                      {renderEditableText(c.journalNumber, 'journalNumber')}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[#555a66] whitespace-nowrap">
                      {renderEditableText(c.journalDate, 'journalDate')}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[#555a66] whitespace-nowrap">
                      {renderEditableText(c.lastModified, 'lastModified')}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[#555a66] max-w-[140px] truncate" title={c.imageUrl}>
                      {renderEditableText(c.imageUrl, 'imageUrl')}
                    </td>
                    <td className="py-2.5 px-3 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleRemoveEntry(rowKey)}
                        aria-label={`Delete record ${c.id || c.tmNumber}`}
                        className="p-1.5 text-[#6b7280] hover:text-red-600"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}

              {visibleEntries.length === 0 && (
                <tr>
                  <td colSpan={27} className="py-10 text-center text-xs text-[#555a66]">
                    No database records found. Click &quot;Pull Sheet&quot; or &quot;Sheet Setup / Import CSV&quot;.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Google Drive Spreadsheet Picker Modal */}
      {drivePickerOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Choose Google Spreadsheet"
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
        >
          <div className="bg-white border border-[#111111] w-full max-w-lg shadow-xl overflow-hidden">
            <div className="px-5 py-3.5 bg-[#111111] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FolderSearch className="w-4 h-4 text-[#ffee00]" aria-hidden="true" />
                <h3 className="text-sm font-extrabold">Select Google Spreadsheet from Drive</h3>
              </div>
              <button
                type="button"
                onClick={() => setDrivePickerOpen(false)}
                aria-label="Close spreadsheet picker"
                className="p-1 text-white/80 hover:text-[#ffee00]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 max-h-[380px] overflow-y-auto divide-y divide-[#eceef2]">
              {driveLoading ? (
                <p className="py-8 text-center text-xs text-[#555a66]">
                  Loading your Google Drive spreadsheets…
                </p>
              ) : driveSpreadsheets.length === 0 ? (
                <p className="py-8 text-center text-xs text-[#555a66]">
                  No Google Spreadsheets found in Drive. Paste any Spreadsheet URL or ID manually.
                </p>
              ) : (
                driveSpreadsheets.map((file) => (
                  <button
                    key={file.id}
                    type="button"
                    onClick={() => handleSelectDriveSpreadsheet(file)}
                    className="w-full text-left py-2.5 px-3 hover:bg-[#fffef0] flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-extrabold text-[#111111] truncate">
                        {file.name}
                      </div>
                      <div className="text-[10.5px] font-mono text-[#555a66] truncate">
                        {file.id}
                      </div>
                    </div>
                    {file.modifiedTime && (
                      <span className="text-[10px] font-mono text-[#555a66] shrink-0">
                        {new Date(file.modifiedTime).toLocaleDateString()}
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Mandatory Confirmation Modal Before Updating User Google Sheet */}
      {confirmPushOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Confirm Google Sheet Update"
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
        >
          <div className="bg-white border border-[#111111] w-full max-w-md shadow-xl p-5 space-y-4">
            <div className="flex items-start gap-2.5">
              <CloudUpload className="w-5 h-5 text-[#111111] shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <h3 className="text-sm font-extrabold text-[#111111]">
                  Push Records to Google Sheet?
                </h3>
                <p className="text-xs text-[#555a66] mt-1">
                  This will update rows <span className="font-mono font-bold">A1:X</span> on your
                  connected Google Sheet tab with all{' '}
                  <span className="font-mono font-bold text-[#111111]">
                    {config.caseEntries.length}
                  </span>{' '}
                  database record(s):
                </p>
                <div className="mt-2 bg-[#f8f9fb] border border-[#e2e4ea] p-2.5 text-[11px] font-mono space-y-1">
                  <div>
                    <span className="font-bold">Sheet:</span>{' '}
                    {connectedSheetTitle || sheetUrlOrId}
                  </div>
                  <div>
                    <span className="font-bold">Tab:</span> {sheetName || 'DATABASE'}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={pushingSheet}
                onClick={() => setConfirmPushOpen(false)}
                className="h-[34px] px-3.5 border border-[#cbd0da] bg-white text-xs font-bold text-[#111111] hover:border-[#111111]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={pushingSheet}
                onClick={handleConfirmPushToGoogleSheet}
                className="h-[34px] px-4 bg-[#111111] text-[#ffee00] text-xs font-extrabold hover:bg-[#222222]"
              >
                {pushingSheet ? 'Updating Sheet…' : 'Confirm Push to Sheet'}
              </button>
            </div>
          </div>
        </div>
      )}

      <DeleteAllConfirmModal
        open={confirmDialog !== null}
        title={
          confirmDialog === 'delete_all'
            ? 'Delete All Database Records?'
            : `Delete ${selectedKeys.size} Selected Record(s)?`
        }
        message={
          confirmDialog === 'delete_all'
            ? `This will permanently remove all ${config.caseEntries.length} records from Cases Database.`
            : `This will remove ${selectedKeys.size} selected record(s) from Cases Database.`
        }
        confirmLabel={
          confirmDialog === 'delete_all' ? 'Confirm Delete All' : 'Confirm Bulk Delete'
        }
        onConfirm={
          confirmDialog === 'delete_all' ? handleDeleteAllRecords : handleDeleteSelected
        }
        onCancel={() => setConfirmDialog(null)}
      />
    </div>
  );
}
