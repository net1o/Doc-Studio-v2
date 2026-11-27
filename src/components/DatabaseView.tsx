import { useMemo, useRef, useState } from 'react';
import {
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Database,
  Download,
  FileSpreadsheet,
  Globe,
  Plus,
  RefreshCw,
  Search,
  ShieldPlus,
  Trash2,
} from 'lucide-react';
import { CaseEntry, CaseSheetConfig, JournalConfig, UniversalSettings } from '../types/journal';
import { BrandexLogo } from './BrandexLogo';
import {
  analyzeCaseEntries,
  checkDuplicate,
  exportRowsToCsv,
  fetchGoogleSheetCsvSmart,
  formatCompositeCaseNo,
  formatDdMmmYy,
  getCaseEntryKey,
  mergeDatabaseEntries,
  mergeUniqueTmNumbers,
  parseCaseLookupInput,
  parseLooseDate,
  triggerFileDownload,
} from '../lib/journal/engine';
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
"REC-2379","26-Oct-26  ","X","ASSIGHN","SULMAN","","ASSIGHN TO SULMAN LIST","835736","-","STAGE 2","ASSIGNED","TM","SULEMAN","","","FALSE","FALSE","FALSE","FALSE","FALSE","","","",""
"REC-2403","26-Oct-26  ","X","ASSIGHN","SULMAN","","ASSIGHN TO SULMAN LIST","868677","-","STAGE 2","ASSIGNED","TM","SULEMAN","","","FALSE","FALSE","FALSE","FALSE","FALSE","","","",""
"REC-2395","26-Oct-26  ","X","ASSIGHN","SULMAN","","ASSIGHN TO SULMAN LIST","871539","-","STAGE 2","ASSIGNED","TM","SULEMAN","","","FALSE","FALSE","FALSE","FALSE","FALSE","","","",""`;

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
  const [sortBy, setSortBy] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [sortFilterOpen, setSortFilterOpen] = useState(false);
  const [editMode, setEditMode] = useState(defaultEditMode);
  const [currentPage, setCurrentPage] = useState(1);
  const [importPreviewPage, setImportPreviewPage] = useState(1);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(() => new Set());
  const [confirmDialog, setConfirmDialog] = useState<null | 'delete_all' | 'delete_selected'>(null);

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

  // Importer State
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

  const dbAnalysis = useMemo(
    () => analyzeCaseEntries(config.caseEntries, config.tmNumbers),
    [config.caseEntries, config.tmNumbers]
  );

  const statusOptions = useMemo(() => {
    const set = new Set<string>();
    for (const c of config.caseEntries) {
      if (c.status?.trim()) set.add(c.status.trim());
    }
    return Array.from(set).sort();
  }, [config.caseEntries]);

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
      if (statusFilter !== 'ALL' && (c.status || '').trim() !== statusFilter) return false;
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
  }, [config.caseEntries, searchQuery, codeCaseFilter, statusFilter]);

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
    visibleEntries.every((c, idx) => selectedKeys.has(getCaseEntryKey(c, idx)));

  const handleToggleSort = (col: SortKey) => {
    if (sortBy === col) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(col);
      setSortDir(col === 'date' || col === 'id' ? 'desc' : 'asc');
    }
    setCurrentPage(1);
  };

  const handleUpdateEntryByKey = (
    targetKey: string,
    patch: Partial<CaseEntry>
  ) => {
    const nextEntries = config.caseEntries.map((entry, idx) => {
      if (getCaseEntryKey(entry, idx) !== targetKey) return entry;
      const updated = { ...entry, ...patch };
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
        visibleEntries.forEach((c, idx) => next.delete(getCaseEntryKey(c, idx)));
      } else {
        visibleEntries.forEach((c, idx) => next.add(getCaseEntryKey(c, idx)));
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
    const tm = newTm.trim();
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

  const handleFetchGoogleSheet = async (autoApply = false) => {
    if (!sheetUrlOrId.trim()) {
      setImportError('Enter a Google Sheet URL, Sheet ID, or Published CSV link.');
      return;
    }

    setFetchingSheet(true);
    setImportError(null);
    if (!autoApply) setShowImporter(true);

    try {
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
          setShowImporter(true);
          setRawImport(text);
          setImportPreviewPage(1);
          setImportError('Sheet fetched, but no matching rows were detected. Adjust mapping below.');
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
        setShowAnalysis(true);
        setCurrentPage(1);
        onNotify(
          `Synced (${sheetName || 'DATABASE'}): ${parsed.totalCsvRows} CSV rows read → ${parsed.entries.length} indexed (${merged.added} new, ${merged.updated} updated${
            parsed.blankTmRows > 0 ? `, ${parsed.blankTmRows} without TM No preserved` : ''
          }).`
        );
      } else {
        setRawImport(text);
        setImportPreviewPage(1);
        setSourceLabel(`Google Sheet (${sheetName || 'DATABASE'})`);
      }
    } catch (err) {
      setShowImporter(true);
      const msg = err instanceof Error ? err.message : '';
      if (msg === 'GOOGLE_LOGIN_HTML') {
        setImportError(
          'Sheet is private. Set sharing to "Anyone with the link -> Viewer" or paste exported CSV rows below.'
        );
      } else {
        setImportError(
          'Unable to fetch Google Sheet CSV directly. Paste or upload your CSV rows below.'
        );
      }
    } finally {
      setFetchingSheet(false);
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
        'ID',
        'DATE',
        'TYPE',
        'CLIENT CODE',
        'CASE NUMBER',
        'CLIENT NAME',
        'APPLICATION NAME',
        'TM/CPR NUMBER',
        'CLASS',
        'STATUS',
        'SUB STATUS',
        'CASE TYPE',
        'AGENT',
        'OFF NOTE',
        'NOTES',
        'TM5',
        'TM6',
        'TM11',
        'TM16',
        'TM56',
        'JOURNAL NUMBER',
        'JOURNAL DATE',
        'LAST MODIFIED',
        'IMAGE',
      ],
      sortedEntries.map((c) => [
        c.id || '',
        c.date || '',
        c.prefix || '',
        c.clientCode || '',
        c.rawCaseNo || '',
        c.clientName,
        c.applicationName || '',
        c.tmNumber,
        c.classNo || '',
        c.status || '',
        c.subStatus || '',
        c.caseType || '',
        c.agent || '',
        c.offNote || '',
        c.notes || '',
        c.tm5 || '',
        c.tm6 || '',
        c.tm11 || '',
        c.tm16 || '',
        c.tm56 || '',
        c.journalNumber || '',
        c.journalDate || '',
        c.lastModified || '',
        c.imageUrl || '',
      ])
    );
    triggerFileDownload(csv, `Cases_Database.csv`, 'text/csv;charset=utf-8');
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
    (statusFilter !== 'ALL' ? 1 : 0);

  return (
    <div className="space-y-6">
      {/* Header Toolbar */}
      <div className="bg-white border border-[#e2e4ea] p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <BrandexLogo
            variant="logo17Icon"
            size="sm"
            discColor={themeSettings?.uiDarkColor || '#111111'}
            accentColor={themeSettings?.uiAccentColor || '#f5c400'}
          />
          <h2 className="text-xl font-extrabold tracking-tight text-[#111111]">
            Cases Database
          </h2>
          <span className="bg-[#ffee00] text-[#111111] px-2.5 py-0.5 text-xs font-extrabold tabular-nums">
            {config.caseEntries.length} Records
          </span>
          <span className="bg-[#f6f7f9] border border-[#cbd0da] text-[#111111] px-2 py-0.5 text-[11px] font-bold">
            {sheetName || 'DATABASE'}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={fetchingSheet}
            onClick={() => handleFetchGoogleSheet(true)}
            className="builty-btn h-[38px] pl-4 pr-3 gap-2 text-xs whitespace-nowrap"
          >
            <Globe className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{fetchingSheet ? 'Syncing…' : 'Sync Google Sheet'}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowImporter((prev) => !prev)}
            className="h-[38px] px-3.5 border border-[#111111] bg-white hover:bg-[#fffef0] text-xs font-bold text-[#111111] inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <Database className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{showImporter ? 'Hide Importer' : 'Import CSV'}</span>
          </button>

          <button
            type="button"
            data-sfx="filter"
            data-active={showAnalysis}
            onClick={() => setShowAnalysis((prev) => !prev)}
            className={`builty-filter-btn h-[38px] px-3 border text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap ${
              showAnalysis
                ? 'border-[#111111] bg-[#fffef0] text-[#111111]'
                : 'border-[#cbd0da] bg-[#f8f9fb] text-[#555a66] hover:text-[#111111]'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Analysis</span>
          </button>

          <button
            type="button"
            onClick={() => onRefreshReviewCases(config.caseEntries)}
            className="h-[38px] px-3 border border-[#cbd0da] bg-[#f8f9fb] hover:border-[#111111] hover:bg-white text-xs font-bold text-[#111111] inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Refresh Cases</span>
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            className="h-[38px] px-3 border border-[#cbd0da] bg-white hover:border-[#111111] text-xs font-bold text-[#111111] inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Export CSV</span>
          </button>

          {selectedKeys.size > 0 && (
            <button
              type="button"
              onClick={() => setConfirmDialog('delete_selected')}
              className="h-[38px] px-3 border border-red-600 bg-red-600 hover:bg-red-700 text-xs font-bold text-white inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Delete Selected ({selectedKeys.size})</span>
            </button>
          )}
        </div>
      </div>

      {/* Database Analysis Card */}
      {showAnalysis && (
        <section
          aria-label="Cases Database Analysis"
          className="bg-white border border-[#e2e4ea] p-5 space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#eceef2] pb-3">
            <div>
              <h3 className="text-sm font-extrabold text-[#111111]">Summary</h3>
              <p className="text-xs text-[#555a66]">
                Latest Date: <span className="font-mono font-bold text-[#111111]">{dbAnalysis.latestDate || '—'}</span>
                {sheetCfg?.lastSyncedAt && (
                  <> · Synced {new Date(sheetCfg.lastSyncedAt).toLocaleString()}</>
                )}
              </p>
            </div>

            {dbAnalysis.missingFromWatchlistTms.length > 0 && (
              <button
                type="button"
                onClick={handleSyncMissingTmsToWatchlist}
                className="h-[34px] px-3 bg-[#ffee00] hover:bg-[#e6d600] text-[#111111] text-xs font-extrabold inline-flex items-center gap-1.5"
              >
                <ShieldPlus className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Add {dbAnalysis.missingFromWatchlistTms.length} Unwatched TMs</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 text-xs tabular-nums">
            <div className="bg-[#f8f9fb] border border-[#e2e4ea] p-3">
              <div className="text-[#555a66] font-semibold">Total Cases</div>
              <div className="text-lg font-extrabold text-[#111111] mt-0.5">
                {dbAnalysis.totalRecords}
              </div>
              <div className="text-[11px] text-[#555a66]">{dbAnalysis.uniqueTmCount} unique TMs</div>
            </div>

            <div className="bg-[#f8f9fb] border border-[#e2e4ea] p-3">
              <div className="text-[#555a66] font-semibold">Watchlist Overlap</div>
              <div className="text-lg font-extrabold text-[#111111] mt-0.5">
                {dbAnalysis.matchedWatchlistCount}
              </div>
              <div className="text-[11px] text-[#555a66]">
                {dbAnalysis.missingFromWatchlistTms.length} unwatched
              </div>
            </div>

            <div className="bg-[#f8f9fb] border border-[#e2e4ea] p-3">
              <div className="text-[#555a66] font-semibold">Top Statuses</div>
              <div className="mt-1 space-y-0.5">
                {dbAnalysis.topStatuses.slice(0, 3).map((s) => (
                  <div key={s.label} className="flex justify-between font-semibold text-[#111111]">
                    <span className="truncate">{s.label}</span>
                    <span className="font-mono">{s.count}</span>
                  </div>
                ))}
                {dbAnalysis.topStatuses.length === 0 && <span className="text-[#555a66]">—</span>}
              </div>
            </div>

            <div className="bg-[#f8f9fb] border border-[#e2e4ea] p-3">
              <div className="text-[#555a66] font-semibold">Top Agents</div>
              <div className="mt-1 space-y-0.5">
                {dbAnalysis.topAgents.slice(0, 2).map((a) => (
                  <div key={a.label} className="flex justify-between font-semibold text-[#111111]">
                    <span className="truncate">{a.label}</span>
                    <span className="font-mono">{a.count}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-[#f8f9fb] border border-[#e2e4ea] p-3">
              <div className="text-[#555a66] font-semibold">TM Flags</div>
              <div className="mt-1 text-[11px] font-mono text-[#111111] space-y-0.5">
                <div>
                  TM5: {dbAnalysis.tmFlagCounts.tm5} · TM6: {dbAnalysis.tmFlagCounts.tm6} · TM11:{' '}
                  {dbAnalysis.tmFlagCounts.tm11}
                </div>
                <div>
                  TM16: {dbAnalysis.tmFlagCounts.tm16} · TM56: {dbAnalysis.tmFlagCounts.tm56}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Expandable Database Importer */}
      {showImporter && (
        <section
          aria-label="Database Importer"
          className="bg-white border border-[#d4d7e0] shadow-sm"
        >
          <div className="px-6 py-4 bg-[#111111] text-white flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-extrabold">Import Database Sheet / CSV</h3>
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
                <input
                  id="db-sheet-name"
                  type="text"
                  value={sheetName}
                  onChange={(e) => setSheetName(e.target.value)}
                  className="w-full bg-[#f8f9fb] border border-[#cbd0da] px-3 py-2 text-xs text-[#111111] focus:bg-white focus:outline-none focus:border-[#111111]"
                />
              </div>
              <div className="lg:col-span-3">
                <button
                  type="button"
                  onClick={() => handleFetchGoogleSheet(false)}
                  disabled={fetchingSheet}
                  className="builty-btn h-[36px] w-full pl-4 pr-3 gap-2 text-xs"
                >
                  <Globe className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{fetchingSheet ? 'Fetching…' : 'Preview Sheet CSV'}</span>
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
          <h3 className="text-sm font-extrabold text-[#111111]">Add Case Record</h3>
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
            type="text"
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
            placeholder="DATE"
            aria-label="Case Date"
            className="bg-[#f8f9fb] border border-[#cbd0da] px-2.5 py-2 text-xs font-mono text-[#111111] focus:bg-white focus:outline-none focus:border-[#111111]"
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
            value={newTm}
            onChange={(e) => setNewTm(e.target.value)}
            placeholder="TM/CPR NUMBER"
            aria-label="TM or CPR Number"
            className="bg-[#fffef0] border border-[#111111] px-2.5 py-2 text-xs font-mono font-bold text-[#111111] focus:bg-white focus:outline-none"
          />
          <input
            type="text"
            value={newClassNo}
            onChange={(e) => setNewClassNo(e.target.value)}
            placeholder="CLASS"
            aria-label="Trademark Class"
            className="bg-[#f8f9fb] border border-[#cbd0da] px-2.5 py-2 text-xs font-mono text-[#111111] focus:bg-white focus:outline-none focus:border-[#111111]"
          />
          <input
            type="text"
            value={newStatus}
            onChange={(e) => setNewStatus(e.target.value)}
            placeholder="STATUS"
            aria-label="Status"
            className="bg-[#f8f9fb] border border-[#cbd0da] px-2.5 py-2 text-xs text-[#111111] focus:bg-white focus:outline-none focus:border-[#111111]"
          />
          <input
            type="text"
            value={newSubStatus}
            onChange={(e) => setNewSubStatus(e.target.value)}
            placeholder="SUB STATUS"
            aria-label="Sub Status"
            className="bg-[#f8f9fb] border border-[#cbd0da] px-2.5 py-2 text-xs text-[#111111] focus:bg-white focus:outline-none focus:border-[#111111]"
          />
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

      {/* Search + Sort & Filter + Pagination + Delete All + Table */}
      <div className="bg-white border border-[#e2e4ea] overflow-hidden space-y-0">
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

          {selectedKeys.size > 0 && (
            <span className="text-xs font-bold text-[#111111] bg-[#ffee00] px-2 py-0.5 tabular-nums self-start lg:self-auto">
              {selectedKeys.size} selected
            </span>
          )}
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
                <option value="ALL">All Statuses</option>
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

                const renderEditableCell = (
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
                  return (
                    <span
                      contentEditable
                      suppressContentEditableWarning
                      onBlur={(e) => {
                        const next = e.currentTarget.innerText.trim();
                        if (next !== (value || '').trim()) {
                          handleUpdateEntryByKey(rowKey, {
                            [field]: next === '—' ? '' : next,
                          });
                        }
                      }}
                      className={`outline-none focus:bg-[#fffef0] focus:px-1 ${className}`}
                    >
                      {value || '—'}
                    </span>
                  );
                };

                const renderFlag = (val?: string) => {
                  const upper = String(val || '').trim().toUpperCase();
                  if (upper === 'TRUE') {
                    return (
                      <span className="px-1.5 py-0.5 bg-[#ffee00] text-[#111111] font-mono font-extrabold text-[10px]">
                        TRUE
                      </span>
                    );
                  }
                  return <span className="font-mono text-[#9ca3af] text-[10.5px]">{upper || '—'}</span>;
                };

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
                      {renderEditableCell(c.id, 'id')}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[#111111] whitespace-nowrap">
                      {renderEditableCell(c.date, 'date')}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold text-[#111111] whitespace-nowrap">
                      {renderEditableCell(c.prefix, 'prefix')}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[#111111] whitespace-nowrap">
                      {renderEditableCell(c.clientCode, 'clientCode')}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[#111111] whitespace-nowrap">
                      {renderEditableCell(c.rawCaseNo, 'rawCaseNo')}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className="px-2 py-0.5 bg-[#fffef0] border border-[#111111] font-mono font-extrabold text-[#111111]">
                        {renderEditableCell(c.caseNo, 'caseNo')}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-[#4b505c] max-w-[180px] truncate" title={c.clientName}>
                      {renderEditableCell(c.clientName, 'clientName')}
                    </td>
                    <td
                      className="py-2.5 px-3 font-semibold text-[#111111] max-w-[210px] truncate"
                      title={c.applicationName}
                    >
                      {renderEditableCell(c.applicationName, 'applicationName')}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold text-[#111111] tabular-nums whitespace-nowrap">
                      {renderEditableCell(c.tmNumber, 'tmNumber')}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono tabular-nums whitespace-nowrap">
                      {renderEditableCell(c.classNo, 'classNo', 'text-center')}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-[#111111] whitespace-nowrap">
                      {renderEditableCell(c.status, 'status')}
                    </td>
                    <td className="py-2.5 px-3 text-[#4b505c] whitespace-nowrap">
                      {renderEditableCell(c.subStatus, 'subStatus')}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[#555a66] whitespace-nowrap">
                      {renderEditableCell(c.caseType, 'caseType')}
                    </td>
                    <td className="py-2.5 px-3 text-[#111111] whitespace-nowrap">
                      {renderEditableCell(c.agent, 'agent')}
                    </td>
                    <td className="py-2.5 px-3 text-[#555a66] max-w-[160px] truncate" title={c.offNote}>
                      {renderEditableCell(c.offNote, 'offNote')}
                    </td>
                    <td className="py-2.5 px-3 text-[#555a66] max-w-[160px] truncate" title={c.notes}>
                      {renderEditableCell(c.notes, 'notes')}
                    </td>
                    <td className="py-2.5 px-2 text-center whitespace-nowrap">{renderFlag(c.tm5)}</td>
                    <td className="py-2.5 px-2 text-center whitespace-nowrap">{renderFlag(c.tm6)}</td>
                    <td className="py-2.5 px-2 text-center whitespace-nowrap">{renderFlag(c.tm11)}</td>
                    <td className="py-2.5 px-2 text-center whitespace-nowrap">{renderFlag(c.tm16)}</td>
                    <td className="py-2.5 px-2 text-center whitespace-nowrap">{renderFlag(c.tm56)}</td>
                    <td className="py-2.5 px-3 font-mono text-[#111111] whitespace-nowrap">
                      {renderEditableCell(c.journalNumber, 'journalNumber')}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[#555a66] whitespace-nowrap">
                      {renderEditableCell(c.journalDate, 'journalDate')}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[#555a66] whitespace-nowrap">
                      {renderEditableCell(c.lastModified, 'lastModified')}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[#555a66] max-w-[140px] truncate" title={c.imageUrl}>
                      {renderEditableCell(c.imageUrl, 'imageUrl')}
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
                    No database records found. Click &quot;Sync Google Sheet&quot; or &quot;Import CSV&quot;.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

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
