import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  BarChart3,
  CheckCircle2,
  ChevronDown,
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
import { CaseEntry, CaseSheetConfig, JournalConfig } from '../types/journal';
import {
  analyzeCaseEntries,
  buildGoogleSheetCsvUrl,
  checkDuplicate,
  exportRowsToCsv,
  formatCompositeCaseNo,
  formatDdMmmYy,
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

interface DatabaseViewProps {
  config: JournalConfig;
  onUpdateConfig: (next: JournalConfig) => void;
  onRefreshReviewCases: (entries: CaseEntry[]) => void;
  onNotify: (message: string) => void;
}

const SAMPLE_DATABASE_CSV = `"ID","DATE","TYPE","CLIENT CODE","CASE NUMBER","CLIENT NAME","APPLICATION NAME","TM/CPR NUMBER","CLASS","STATUS","SUB STATUS","CASE TYPE","AGENT","OFF NOTE","NOTES","TM5","TM6","TM11","TM16","TM56","JOURNAL NUMBER","JOURNAL DATE","LAST MODIFIED","IMAGE"
"REC-2379","26-Oct-26  ","X","ASSIGHN","SULMAN","","ASSIGHN TO SULMAN LIST","835736","-","STAGE 2","ASSIGNED","TM","SULEMAN","","","FALSE","FALSE","FALSE","FALSE","FALSE","","","",""
"REC-2403","26-Oct-26  ","X","ASSIGHN","SULMAN","","ASSIGHN TO SULMAN LIST","868677","-","STAGE 2","ASSIGNED","TM","SULEMAN","","","FALSE","FALSE","FALSE","FALSE","FALSE","","","",""
"REC-2395","26-Oct-26  ","X","ASSIGHN","SULMAN","","ASSIGHN TO SULMAN LIST","871539","-","STAGE 2","ASSIGNED","TM","SULEMAN","","","FALSE","FALSE","FALSE","FALSE","FALSE","","","",""`;

const MAX_VISIBLE = 150;

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
  onUpdateConfig,
  onRefreshReviewCases,
  onNotify,
}: DatabaseViewProps) {
  const sheetCfg = config.caseSheetConfig;
  const separator = sheetCfg?.caseSeparator || '-';

  const [showImporter, setShowImporter] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(true);
  const [showMoreAddFields, setShowMoreAddFields] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [codeCaseFilter, setCodeCaseFilter] = useState('');
  // Default sort by recent DATE descending
  const [sortBy, setSortBy] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [selectedTms, setSelectedTms] = useState<Set<string>>(() => new Set());
  const [confirmDialog, setConfirmDialog] = useState<null | 'delete_all' | 'delete_selected'>(null);

  // Single Case Record mapped to all 24 columns
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

  useEffect(() => {
    if (!confirmDialog) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setConfirmDialog(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [confirmDialog]);

  const dbAnalysis = useMemo(
    () => analyzeCaseEntries(config.caseEntries, config.tmNumbers),
    [config.caseEntries, config.tmNumbers]
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
      }),
    [rawImport, mappingMode, keyCol, prefixCol, clientCodeCol, caseCol, clientCol, appNameCol, separator]
  );

  const importDuplicateCheck = useMemo(
    () =>
      checkDuplicate(
        parsedImport.entries.map((entry) => entry.tmNumber),
        config.caseEntries.map((c) => c.tmNumber)
      ),
    [parsedImport.entries, config.caseEntries]
  );

  const importMergePreview = useMemo(
    () => mergeDatabaseEntries(config.caseEntries, parsedImport.entries, duplicatePolicy),
    [config.caseEntries, parsedImport.entries, duplicatePolicy]
  );

  const filteredEntries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const ccQ = codeCaseFilter.trim().toLowerCase();
    return config.caseEntries.filter((c) => {
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
  }, [config.caseEntries, searchQuery, codeCaseFilter]);

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

  const visibleEntries = useMemo(() => sortedEntries.slice(0, MAX_VISIBLE), [sortedEntries]);

  const allVisibleSelected =
    visibleEntries.length > 0 && visibleEntries.every((c) => selectedTms.has(c.tmNumber));

  const handleToggleSort = (col: SortKey) => {
    if (sortBy === col) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(col);
      setSortDir(col === 'date' || col === 'id' ? 'desc' : 'asc');
    }
  };

  const handleToggleSelectRow = (tmNumber: string) => {
    setSelectedTms((prev) => {
      const next = new Set(prev);
      if (next.has(tmNumber)) next.delete(tmNumber);
      else next.add(tmNumber);
      return next;
    });
  };

  const handleToggleSelectAllVisible = () => {
    setSelectedTms((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        visibleEntries.forEach((c) => next.delete(c.tmNumber));
      } else {
        visibleEntries.forEach((c) => next.add(c.tmNumber));
      }
      return next;
    });
  };

  const handleDeleteSelected = () => {
    if (selectedTms.size === 0) return;
    const removedCount = selectedTms.size;
    onUpdateConfig({
      ...config,
      caseEntries: config.caseEntries.filter((c) => !selectedTms.has(c.tmNumber)),
    });
    setSelectedTms(new Set());
    setConfirmDialog(null);
    onNotify(`Deleted ${removedCount} selected record(s) from Cases Database.`);
  };

  const handleDeleteAllRecords = () => {
    const total = config.caseEntries.length;
    onUpdateConfig({
      ...config,
      caseEntries: [],
    });
    setSelectedTms(new Set());
    setConfirmDialog(null);
    onNotify(`Deleted all ${total} record(s) from Cases Database.`);
  };

  const handleAddSingleRecord = (e: React.FormEvent) => {
    e.preventDefault();
    const tm = newTm.trim();
    const composite =
      formatCompositeCaseNo(newPrefix, newClientCode, newRawCaseNo, separator) || 'NOT FOUND';
    if (!tm) {
      setSingleAddError('TM/CPR NUMBER (Col 8) is required to add a case record.');
      return;
    }

    const dupCheck = checkDuplicate(
      tm,
      config.caseEntries.map((c) => c.tmNumber)
    );
    if (dupCheck.isDuplicate) {
      const duplicate = config.caseEntries.find((c) => c.tmNumber.trim() === tm);
      setSingleAddError(
        `Duplicate protected: TM ${tm} is already in Database (Case ${duplicate?.caseNo || 'existing'}).`
      );
      return;
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

    const nextEntries = [entry, ...config.caseEntries];
    onUpdateConfig({ ...config, caseEntries: nextEntries });
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
    onNotify(`Added ${resolvedId} · TM ${tm} -> Case ${composite} to Cases Database.`);
  };

  const handleRemoveEntry = (tmNumber: string) => {
    onUpdateConfig({
      ...config,
      caseEntries: config.caseEntries.filter((c) => c.tmNumber !== tmNumber),
    });
    setSelectedTms((prev) => {
      if (!prev.has(tmNumber)) return prev;
      const next = new Set(prev);
      next.delete(tmNumber);
      return next;
    });
  };

  const handleFetchGoogleSheet = async (autoApply = false) => {
    const csvUrl = buildGoogleSheetCsvUrl(sheetUrlOrId, sheetName);
    if (!csvUrl) {
      setImportError('Enter a Google Sheet URL, Sheet ID, or Published CSV link.');
      return;
    }

    setFetchingSheet(true);
    setImportError(null);
    if (!autoApply) setShowImporter(true);

    try {
      const res = await fetch(csvUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      const head = text.trim().slice(0, 200).toLowerCase();
      if (head.startsWith('<!doctype') || head.startsWith('<html')) {
        throw new Error('GOOGLE_LOGIN_HTML');
      }

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
        });
        if (parsed.entries.length === 0) {
          setShowImporter(true);
          setRawImport(text);
          setImportError('Sheet fetched, but no valid TM/Case rows were matched. Adjust column mapping below.');
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
        onNotify(
          `Synced Google Sheet (${sheetName || 'DATABASE'}): ${parsed.entries.length} sheet rows analyzed · ${merged.added} new, ${merged.updated} updated.`
        );
      } else {
        setRawImport(text);
        setSourceLabel(`Google Sheet (${sheetName || 'DATABASE'})`);
      }
    } catch (err) {
      setShowImporter(true);
      const msg = err instanceof Error ? err.message : '';
      if (msg === 'GOOGLE_LOGIN_HTML') {
        setImportError(
          'Google returned a sign-in page because this sheet is private. Set sharing to "Anyone with the link -> Viewer", paste a File -> Share -> Publish to web CSV link, or paste/upload exported DATABASE CSV rows below.'
        );
      } else {
        setImportError(
          'Unable to fetch Google Sheet CSV directly (private sharing or CORS). Paste your DATABASE sheet rows or upload the CSV file below.'
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
      summaryMsg = `Database replaced with ${nextEntries.length} unique record(s)${
        parsedImport.skippedDuplicates > 0
          ? ` (${parsedImport.skippedDuplicates} duplicate TM rows skipped in file)`
          : ''
      }.`;
    } else {
      const result = mergeDatabaseEntries(config.caseEntries, parsedImport.entries, duplicatePolicy);
      nextEntries = result.merged;
      const totalSkipped = result.skippedDuplicates + parsedImport.skippedDuplicates;
      summaryMsg =
        duplicatePolicy === 'skip'
          ? `Database merged: ${result.added} new record(s) added${
              totalSkipped > 0 ? `, ${totalSkipped} duplicate(s) skipped` : ''
            }.`
          : `Database merged: ${result.added} added, ${result.updated} existing updated${
              parsedImport.skippedDuplicates > 0
                ? `, ${parsedImport.skippedDuplicates} batch duplicate(s) skipped`
                : ''
            }.`;
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
    onNotify(summaryMsg);
  };

  const handleSyncMissingTmsToWatchlist = () => {
    if (dbAnalysis.missingFromWatchlistTms.length === 0) {
      onNotify('All 6-digit TM Numbers from Cases Database are already in Watchlist.');
      return;
    }
    const { merged, added, skippedDuplicates } = mergeUniqueTmNumbers(
      config.tmNumbers,
      dbAnalysis.missingFromWatchlistTms,
      true
    );
    onUpdateConfig({
      ...config,
      tmNumbers: merged,
    });
    onNotify(
      `Synced ${added} TM number(s) from Cases Database to Watchlist${
        skippedDuplicates > 0 ? ` (${skippedDuplicates} duplicate skipped)` : ''
      }.`
    );
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
    triggerFileDownload(csv, `Cases_Database_24Col.csv`, 'text/csv;charset=utf-8');
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

  return (
    <div className="space-y-6">
      {/* Header Toolbar */}
      <div className="bg-white border border-[#e2e4ea] p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-xl font-extrabold tracking-tight text-[#111111]">
              Cases Database (24 Columns)
            </h2>
            <span className="bg-[#ffee00] text-[#111111] px-2.5 py-0.5 text-xs font-extrabold tabular-nums">
              {config.caseEntries.length} Records
            </span>
            <span className="bg-[#f6f7f9] border border-[#cbd0da] text-[#111111] px-2 py-0.5 text-[11px] font-bold">
              Sorted: {sortBy === 'date' ? 'Recent Date' : sortBy} ({sortDir.toUpperCase()})
            </span>
          </div>
          <p className="text-xs text-[#555a66] mt-1 tabular-nums">
            Google Sheet <span className="font-mono text-[#111111]">{sheetUrlOrId}</span> · Matches App
            No against Col {sheetCfg?.keyCol || 8} (TM/CPR NUMBER) · Case No built from Cols{' '}
            {sheetCfg?.prefixCol || 3}-{sheetCfg?.clientCodeCol || 4}-{sheetCfg?.caseCol || 5}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={fetchingSheet}
            onClick={() => handleFetchGoogleSheet(true)}
            className="builty-btn h-[38px] pl-4 pr-3 gap-2 text-xs whitespace-nowrap"
          >
            <Globe className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{fetchingSheet ? 'Syncing Sheet…' : 'Sync & Analyze Google Sheet'}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowImporter((prev) => !prev)}
            className="h-[38px] px-3.5 border border-[#111111] bg-white hover:bg-[#fffef0] text-xs font-bold text-[#111111] inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <Database className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{showImporter ? 'Hide Importer' : 'Paste / Upload CSV'}</span>
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
            <span>Refresh Review Cases</span>
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            className="h-[38px] px-3 border border-[#cbd0da] bg-white hover:border-[#111111] text-xs font-bold text-[#111111] inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Export 24-Col CSV</span>
          </button>

          {selectedTms.size > 0 && (
            <button
              type="button"
              onClick={() => setConfirmDialog('delete_selected')}
              className="h-[38px] px-3 border border-red-600 bg-red-600 hover:bg-red-700 text-xs font-bold text-white inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Delete Selected ({selectedTms.size})</span>
            </button>
          )}

          <button
            type="button"
            disabled={config.caseEntries.length === 0}
            onClick={() => setConfirmDialog('delete_all')}
            className="h-[38px] px-3 border border-red-300 bg-red-50 hover:border-red-600 hover:bg-red-600 hover:text-white text-xs font-bold text-red-700 inline-flex items-center gap-1.5 whitespace-nowrap disabled:opacity-40"
          >
            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Delete All</span>
          </button>
        </div>
      </div>

      {/* Live Sheet & Cases Database Analysis Card */}
      {showAnalysis && (
        <section
          aria-label="Cases Database Analysis"
          className="bg-white border border-[#e2e4ea] p-5 space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#eceef2] pb-3">
            <div>
              <h3 className="text-sm font-extrabold text-[#111111]">
                Cases Database Sheet Analysis
              </h3>
              <p className="text-xs text-[#555a66]">
                Latest Date: <span className="font-mono font-bold text-[#111111]">{dbAnalysis.latestDate || '—'}</span> ·{' '}
                {sheetCfg?.lastSyncedAt
                  ? `Last synced ${new Date(sheetCfg.lastSyncedAt).toLocaleString()}`
                  : 'Click "Sync & Analyze Google Sheet" to pull live DATABASE rows'}
              </p>
            </div>

            {dbAnalysis.missingFromWatchlistTms.length > 0 && (
              <button
                type="button"
                onClick={handleSyncMissingTmsToWatchlist}
                className="h-[34px] px-3 bg-[#ffee00] hover:bg-[#e6d600] text-[#111111] text-xs font-extrabold inline-flex items-center gap-1.5"
              >
                <ShieldPlus className="w-3.5 h-3.5" aria-hidden="true" />
                <span>
                  Add {dbAnalysis.missingFromWatchlistTms.length} Unwatched TM(s) to Watchlist
                </span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 text-xs tabular-nums">
            <div className="bg-[#f8f9fb] border border-[#e2e4ea] p-3">
              <div className="text-[#555a66] font-semibold">Total Cases Indexed</div>
              <div className="text-lg font-extrabold text-[#111111] mt-0.5">
                {dbAnalysis.totalRecords}
              </div>
              <div className="text-[11px] text-[#555a66]">{dbAnalysis.uniqueTmCount} unique TM/CPR</div>
            </div>

            <div className="bg-[#f8f9fb] border border-[#e2e4ea] p-3">
              <div className="text-[#555a66] font-semibold">Watchlist Overlap</div>
              <div className="text-lg font-extrabold text-[#111111] mt-0.5">
                {dbAnalysis.matchedWatchlistCount}
              </div>
              <div className="text-[11px] text-[#555a66]">
                {dbAnalysis.missingFromWatchlistTms.length} 6-digit TM not in Watchlist
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
              <div className="text-[#555a66] font-semibold">Top Agents &amp; Codes</div>
              <div className="mt-1 space-y-0.5">
                {dbAnalysis.topAgents.slice(0, 2).map((a) => (
                  <div key={a.label} className="flex justify-between font-semibold text-[#111111]">
                    <span className="truncate">{a.label}</span>
                    <span className="font-mono">{a.count}</span>
                  </div>
                ))}
                {dbAnalysis.topClientCodes.slice(0, 1).map((cc) => (
                  <div key={cc.label} className="flex justify-between text-[11px] text-[#555a66]">
                    <span className="truncate">Code: {cc.label}</span>
                    <span className="font-mono">{cc.count}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-[#f8f9fb] border border-[#e2e4ea] p-3">
              <div className="text-[#555a66] font-semibold">TM Flags Active</div>
              <div className="mt-1 text-[11px] font-mono text-[#111111] space-y-0.5">
                <div>
                  TM5: {dbAnalysis.tmFlagCounts.tm5} · TM6: {dbAnalysis.tmFlagCounts.tm6} · TM11:{' '}
                  {dbAnalysis.tmFlagCounts.tm11}
                </div>
                <div>
                  TM16: {dbAnalysis.tmFlagCounts.tm16} · TM56: {dbAnalysis.tmFlagCounts.tm56}
                </div>
                <div className="text-[#555a66]">
                  Journal Linked: {dbAnalysis.journalLinkedCount}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Expandable Database Importer */}
      {showImporter && (
        <section
          aria-label="Database CSV and Google Sheet Importer"
          className="bg-white border border-[#d4d7e0] shadow-sm"
        >
          <div className="px-6 py-4 bg-[#111111] text-white flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-extrabold">
                Import 24-Column DATABASE Sheet (Col 8 Match + Case Cols 3-4-5)
              </h3>
              <p className="text-xs text-[#c7c9d1]">
                Supports direct Google Sheet CSV link fetch, pasted CSV/TSV rows, or Excel exports
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setRawImport(SAMPLE_DATABASE_CSV);
                setSourceLabel('REC-2379/2403/2395 24-Col sample');
                setImportError(null);
              }}
              className="h-[32px] px-3 bg-[#ffee00] text-[#111111] text-xs font-bold hover:bg-[#e6d600]"
            >
              Load Sample Rows
            </button>
          </div>

          <div className="p-6 space-y-5">
            {/* Google Sheet CSV Fetch */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-end">
              <div className="lg:col-span-6">
                <label htmlFor="db-sheet-url" className="block text-xs font-bold text-[#111111] mb-1">
                  Google Sheet URL, Sheet ID, or Published CSV Link
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

            {/* Mapping Preset + File Picker */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end border-t border-b border-[#eceef2] py-3">
              <div className="md:col-span-6">
                <label htmlFor="db-mapping-preset" className="block text-xs font-bold text-[#111111] mb-1">
                  Column Mapping Preset
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
                  <option value="auto">Auto-detect (24-Col Sheet Headers, Col 8+3/4/5, or 22-Col)</option>
                  <option value="sheet_col8_345">24-Col Google Sheet (ID..IMAGE · TM Col 8 · Case 3-4-5)</option>
                  <option value="date_start_22col">22-Col DATE-Start Export (Match Col 7 · Case Cols 2-3-4)</option>
                  <option value="three_col">Simple 3-Column (TM No, Case No, Client)</option>
                  <option value="custom">Custom 1-Based Column Numbers</option>
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
                  <span>Upload DATABASE CSV / TSV</span>
                </button>
                {sourceLabel && (
                  <span className="text-xs font-semibold text-[#555a66]">{sourceLabel}</span>
                )}
              </div>

              {mappingMode === 'custom' && (
                <div className="md:col-span-12 grid grid-cols-2 sm:grid-cols-6 gap-2.5 pt-2">
                  <div>
                    <label className="block text-[11px] font-bold text-[#111111] mb-1">
                      TM/CPR Col #
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={keyCol}
                      onChange={(e) => setKeyCol(Math.max(1, Number(e.target.value) || 1))}
                      className="w-full bg-[#f8f9fb] border border-[#cbd0da] px-2 py-1.5 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[#111111] mb-1">
                      Prefix Col #
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={prefixCol}
                      onChange={(e) => setPrefixCol(Math.max(1, Number(e.target.value) || 1))}
                      className="w-full bg-[#f8f9fb] border border-[#cbd0da] px-2 py-1.5 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[#111111] mb-1">
                      Client Code Col #
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={clientCodeCol}
                      onChange={(e) => setClientCodeCol(Math.max(1, Number(e.target.value) || 1))}
                      className="w-full bg-[#f8f9fb] border border-[#cbd0da] px-2 py-1.5 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[#111111] mb-1">
                      Case No Col #
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={caseCol}
                      onChange={(e) => setCaseCol(Math.max(1, Number(e.target.value) || 1))}
                      className="w-full bg-[#f8f9fb] border border-[#cbd0da] px-2 py-1.5 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[#111111] mb-1">
                      Client Col #
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={clientCol}
                      onChange={(e) => setClientCol(Math.max(1, Number(e.target.value) || 1))}
                      className="w-full bg-[#f8f9fb] border border-[#cbd0da] px-2 py-1.5 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[#111111] mb-1">
                      App Name Col #
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={appNameCol}
                      onChange={(e) => setAppNameCol(Math.max(1, Number(e.target.value) || 1))}
                      className="w-full bg-[#f8f9fb] border border-[#cbd0da] px-2 py-1.5 text-xs font-mono"
                    />
                  </div>
                </div>
              )}
            </div>

            <textarea
              rows={5}
              value={rawImport}
              onChange={(e) => {
                setRawImport(e.target.value);
                setSourceLabel('Pasted rows');
              }}
              placeholder='Paste rows directly from your 24-column DATABASE Google Sheet ("ID","DATE","TYPE","CLIENT CODE","CASE NUMBER","CLIENT NAME","APPLICATION NAME","TM/CPR NUMBER",...)'
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
                      {parsedImport.entries.length} unique records ({importDuplicateCheck.unique.length} new ·{' '}
                      {duplicatePolicy === 'skip'
                        ? `${importMergePreview.skippedDuplicates} duplicate skipped`
                        : `${importDuplicateCheck.duplicates.length} update existing`}
                      )
                    </span>
                    <span aria-hidden="true" className="text-[#9ca3af]">·</span>
                    <span className="text-[#555a66]">{parsedImport.detectedLayout}</span>
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

                <div className="border border-[#e2e4ea] overflow-x-auto max-h-[220px]">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="sticky top-0 bg-[#111111] text-white text-[11px] uppercase tracking-wider">
                      <tr>
                        <th className="py-2 px-3">ID</th>
                        <th className="py-2 px-3">Date</th>
                        <th className="py-2 px-3">TM/CPR No</th>
                        <th className="py-2 px-3">Formatted Case No</th>
                        <th className="py-2 px-3">Application Name</th>
                        <th className="py-2 px-3">Status</th>
                        <th className="py-2 px-3">Agent</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#eceef2] bg-white">
                      {parsedImport.entries.slice(0, 25).map((entry) => (
                        <tr key={entry.tmNumber}>
                          <td className="py-2 px-3 font-mono text-[#555a66]">{entry.id || '—'}</td>
                          <td className="py-2 px-3 font-mono text-[#555a66]">{entry.date || '—'}</td>
                          <td className="py-2 px-3 font-mono font-bold tabular-nums">{entry.tmNumber}</td>
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

      {/* Add Single Case Record Mapped to All 24 Columns */}
      <form
        onSubmit={handleAddSingleRecord}
        className="bg-white border border-[#e2e4ea] p-5 space-y-3"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-extrabold text-[#111111]">
              Add Single Case Record (24-Column Schema)
            </h3>
            <p className="text-[11px] text-[#555a66]">
              Maps directly to ID, DATE, TYPE, CLIENT CODE, CASE NUMBER, CLIENT NAME, APPLICATION NAME, TM/CPR NUMBER, CLASS, STATUS, SUB STATUS, CASE TYPE, AGENT &amp; flags.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {previewNewCaseNo && (
              <span className="text-xs font-mono font-bold text-[#111111] bg-[#fffef0] border border-[#111111] px-2.5 py-0.5">
                Formatted Case No: {previewNewCaseNo}
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
              <span>{showMoreAddFields ? 'Hide Cols 14–24' : 'Show Cols 14–24 (Notes, TM Flags, Journal)'}</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
          <input
            type="text"
            value={newId}
            onChange={(e) => setNewId(e.target.value)}
            placeholder="ID (e.g. REC-2436)"
            aria-label="Record ID"
            className="bg-[#f8f9fb] border border-[#cbd0da] px-2.5 py-2 text-xs font-mono text-[#111111] focus:bg-white focus:outline-none focus:border-[#111111]"
          />
          <input
            type="text"
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
            placeholder="DATE (26-Oct-26)"
            aria-label="Case Date"
            className="bg-[#f8f9fb] border border-[#cbd0da] px-2.5 py-2 text-xs font-mono text-[#111111] focus:bg-white focus:outline-none focus:border-[#111111]"
          />
          <input
            type="text"
            value={newPrefix}
            onChange={(e) => setNewPrefix(e.target.value)}
            placeholder="TYPE (A/X/N)"
            aria-label="Type or Prefix"
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
            placeholder="TM/CPR NUMBER *"
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
            placeholder="STATUS (STAGE 2)"
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
            placeholder="CASE TYPE (TM)"
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
                className="bg-[#f8f9fb] border border-[#cbd0da] px-2.5 py-2 text-xs text-[#111111] focus:bg-white focus:outline-none focus:border-[#111111]"
              />
              <input
                type="text"
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                placeholder="NOTES"
                className="bg-[#f8f9fb] border border-[#cbd0da] px-2.5 py-2 text-xs text-[#111111] focus:bg-white focus:outline-none focus:border-[#111111]"
              />
              <input
                type="text"
                value={newJournalNo}
                onChange={(e) => setNewJournalNo(e.target.value)}
                placeholder="JOURNAL NUMBER"
                className="bg-[#f8f9fb] border border-[#cbd0da] px-2.5 py-2 text-xs font-mono text-[#111111] focus:bg-white focus:outline-none focus:border-[#111111]"
              />
              <input
                type="text"
                value={newJournalDate}
                onChange={(e) => setNewJournalDate(e.target.value)}
                placeholder="JOURNAL DATE"
                className="bg-[#f8f9fb] border border-[#cbd0da] px-2.5 py-2 text-xs font-mono text-[#111111] focus:bg-white focus:outline-none focus:border-[#111111]"
              />
              <input
                type="text"
                value={newLastModified}
                onChange={(e) => setNewLastModified(e.target.value)}
                placeholder="LAST MODIFIED"
                className="bg-[#f8f9fb] border border-[#cbd0da] px-2.5 py-2 text-xs font-mono text-[#111111] focus:bg-white focus:outline-none focus:border-[#111111]"
              />
              <input
                type="text"
                value={newImageUrl}
                onChange={(e) => setNewImageUrl(e.target.value)}
                placeholder="IMAGE URL"
                className="bg-[#f8f9fb] border border-[#cbd0da] px-2.5 py-2 text-xs font-mono text-[#111111] focus:bg-white focus:outline-none focus:border-[#111111]"
              />
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs text-[#111111]">
              <span className="font-bold text-[#555a66]">TM Form Flags:</span>
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

      {/* Search & Full 24-Column Database Table */}
      <div className="bg-white border border-[#e2e4ea] overflow-hidden">
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
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search ID, TM/CPR No, App Name, Client, Agent, Status…"
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
                onChange={(e) => setCodeCaseFilter(e.target.value)}
                placeholder="Filter Client Code or Case No (e.g. 32 or A-32-4)…"
                aria-label="Filter by Client Code or Case Number"
                className="w-full bg-[#fffef0] border border-[#cbd0da] pl-8 pr-3 py-2 text-xs font-mono text-[#111111] focus:bg-white focus:outline-none focus:border-[#111111]"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {selectedTms.size > 0 && (
              <span className="text-xs font-bold text-[#111111] bg-[#ffee00] px-2 py-0.5 tabular-nums">
                {selectedTms.size} selected
              </span>
            )}
            <span className="text-xs text-[#555a66] tabular-nums">
              Showing {visibleEntries.length} of {sortedEntries.length} records
            </span>
          </div>
        </div>

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
                  const SortIcon = !activeSort
                    ? ArrowUpDown
                    : sortDir === 'asc'
                    ? ArrowUp
                    : ArrowDown;
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
                        <SortIcon className="w-3 h-3 shrink-0" aria-hidden="true" />
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
                <th className="py-3 px-3 whitespace-nowrap">
                  <button
                    type="button"
                    data-sfx="filter"
                    onClick={() => handleToggleSort('journalNumber')}
                    className={`inline-flex items-center gap-1 uppercase font-extrabold tracking-wider hover:text-[#ffee00] ${
                      sortBy === 'journalNumber' ? 'text-[#ffee00]' : 'text-white'
                    }`}
                  >
                    <span>JOURNAL NUMBER</span>
                    <ArrowUpDown className="w-3 h-3 shrink-0" aria-hidden="true" />
                  </button>
                </th>
                <th className="py-3 px-3 whitespace-nowrap">JOURNAL DATE</th>
                <th className="py-3 px-3 whitespace-nowrap">
                  <button
                    type="button"
                    data-sfx="filter"
                    onClick={() => handleToggleSort('lastModified')}
                    className={`inline-flex items-center gap-1 uppercase font-extrabold tracking-wider hover:text-[#ffee00] ${
                      sortBy === 'lastModified' ? 'text-[#ffee00]' : 'text-white'
                    }`}
                  >
                    <span>LAST MODIFIED</span>
                    <ArrowUpDown className="w-3 h-3 shrink-0" aria-hidden="true" />
                  </button>
                </th>
                <th className="py-3 px-3 whitespace-nowrap">IMAGE</th>
                <th className="py-3 px-3 text-right whitespace-nowrap">Action</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-[#eceef2] bg-white">
              {visibleEntries.map((c) => {
                const isSelected = selectedTms.has(c.tmNumber);
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
                    key={`${c.id || ''}_${c.tmNumber}`}
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
                        onChange={() => handleToggleSelectRow(c.tmNumber)}
                        aria-label={`Select TM ${c.tmNumber}`}
                        className="w-4 h-4 accent-[#111111] cursor-pointer"
                      />
                    </td>
                    <td className="py-2.5 px-3 font-mono font-semibold text-[#555a66] whitespace-nowrap">
                      {c.id || '—'}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[#111111] whitespace-nowrap">
                      {c.date || '—'}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold text-[#111111] whitespace-nowrap">
                      {c.prefix || '—'}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[#111111] whitespace-nowrap">
                      {c.clientCode || '—'}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[#111111] whitespace-nowrap">
                      {c.rawCaseNo || '—'}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className="px-2 py-0.5 bg-[#fffef0] border border-[#111111] font-mono font-extrabold text-[#111111]">
                        {c.caseNo}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-[#4b505c] max-w-[180px] truncate" title={c.clientName}>
                      {c.clientName || '—'}
                    </td>
                    <td
                      className="py-2.5 px-3 font-semibold text-[#111111] max-w-[210px] truncate"
                      title={c.applicationName}
                    >
                      {c.applicationName || '—'}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold text-[#111111] tabular-nums whitespace-nowrap">
                      {c.tmNumber}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono tabular-nums whitespace-nowrap">
                      {c.classNo || '—'}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-[#111111] whitespace-nowrap">
                      {c.status || '—'}
                    </td>
                    <td className="py-2.5 px-3 text-[#4b505c] whitespace-nowrap">
                      {c.subStatus || '—'}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[#555a66] whitespace-nowrap">
                      {c.caseType || '—'}
                    </td>
                    <td className="py-2.5 px-3 text-[#111111] whitespace-nowrap">
                      {c.agent || '—'}
                    </td>
                    <td className="py-2.5 px-3 text-[#555a66] max-w-[160px] truncate" title={c.offNote}>
                      {c.offNote || '—'}
                    </td>
                    <td className="py-2.5 px-3 text-[#555a66] max-w-[160px] truncate" title={c.notes}>
                      {c.notes || '—'}
                    </td>
                    <td className="py-2.5 px-2 text-center whitespace-nowrap">{renderFlag(c.tm5)}</td>
                    <td className="py-2.5 px-2 text-center whitespace-nowrap">{renderFlag(c.tm6)}</td>
                    <td className="py-2.5 px-2 text-center whitespace-nowrap">{renderFlag(c.tm11)}</td>
                    <td className="py-2.5 px-2 text-center whitespace-nowrap">{renderFlag(c.tm16)}</td>
                    <td className="py-2.5 px-2 text-center whitespace-nowrap">{renderFlag(c.tm56)}</td>
                    <td className="py-2.5 px-3 font-mono text-[#111111] whitespace-nowrap">
                      {c.journalNumber || '—'}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[#555a66] whitespace-nowrap">
                      {c.journalDate || '—'}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[#555a66] whitespace-nowrap">
                      {c.lastModified || '—'}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[#555a66] max-w-[140px] truncate" title={c.imageUrl}>
                      {c.imageUrl || '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleRemoveEntry(c.tmNumber)}
                        aria-label={`Delete TM ${c.tmNumber}`}
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
                    No Database records match your filter. Click &quot;Sync &amp; Analyze Google Sheet&quot; above to load your sheet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirmation Dialog for Delete All / Bulk Delete */}
      {confirmDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setConfirmDialog(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="db-confirm-dialog-title"
            className="w-full max-w-md bg-white border border-[#111111] shadow-xl p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 bg-red-100 text-red-700 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" aria-hidden="true" />
              </div>
              <div>
                <h3 id="db-confirm-dialog-title" className="text-base font-extrabold text-[#111111]">
                  {confirmDialog === 'delete_all'
                    ? 'Delete All Database Records?'
                    : `Delete ${selectedTms.size} Selected Record(s)?`}
                </h3>
                <p className="text-xs text-[#555a66] mt-1">
                  {confirmDialog === 'delete_all'
                    ? `This will permanently remove all ${config.caseEntries.length} records from the Cases Database. Export a CSV backup first if needed.`
                    : `This will remove the ${selectedTms.size} checked TM record(s) from the Cases Database.`}
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDialog(null)}
                className="h-[36px] px-4 border border-[#cbd0da] bg-white text-xs font-bold text-[#111111]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={
                  confirmDialog === 'delete_all' ? handleDeleteAllRecords : handleDeleteSelected
                }
                className="h-[36px] px-4 bg-red-600 hover:bg-red-700 text-white text-xs font-extrabold"
              >
                {confirmDialog === 'delete_all' ? 'Confirm Delete All' : 'Confirm Bulk Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
