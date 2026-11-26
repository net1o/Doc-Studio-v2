import { useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  Database,
  Download,
  FileSpreadsheet,
  Globe,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react';
import { CaseEntry, CaseSheetConfig, JournalConfig } from '../types/journal';
import {
  buildGoogleSheetCsvUrl,
  exportRowsToCsv,
  formatCompositeCaseNo,
  mergeDatabaseEntries,
  parseCaseLookupInput,
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

const SAMPLE_DATABASE_TSV = `DATE\tTYPE\tCLIENT CODE\tCASE NUMBER\tCLIENT NAME\tAPPLICATION NAME\tTM/CPR NUMBER\tCLASS\tSTATUS\tSUB STATUS\tCASE TYPE\tAGENT\tOFF NOTE\tNOTES\tTM5\tTM6\tTM11\tTM16\tTM56\tJOURNAL NUMBER\tJOURNAL DATE\tLAST MODIFIED
10-Mar-22  \tA\t32\t4\t\tITL\t590630\t3\tSTAGE 3\tD-NOTE SUBMITTED\tTM\t\t\t\tFALSE\tFALSE\tTRUE\tFALSE\tFALSE\t\t\t10-Mar-22  12:00 AM
11-Apr-22  \tX\t307\t1\t\tORAKAL\t583969\t16\tSTAGE 3\tD-NOTE SUBMITTED\tTM\t\t\t\tFALSE\tFALSE\tTRUE\tFALSE\tFALSE\t\t\t11-Apr-22  12:00 AM
11-Apr-22  \tX\t307\t2\t\tDELTA STAR\t583970\t16\tSTAGE 3\tD-NOTE SUBMITTED\tTM\t\t\t\tFALSE\tFALSE\tTRUE\tFALSE\tFALSE\t\t\t11-Apr-22  12:00 AM
21-Apr-22  \tA\t005\t2\t\tNAEEM INFEX\t582722\t9\tSTAGE 3\tD-NOTE SUBMITTED\tTM\t\t\t\tFALSE\tFALSE\tTRUE\tFALSE\tFALSE\t\t\t21-Apr-22  12:00 AM`;

const MAX_VISIBLE = 100;

export function DatabaseView({
  config,
  onUpdateConfig,
  onRefreshReviewCases,
  onNotify,
}: DatabaseViewProps) {
  const sheetCfg = config.caseSheetConfig;
  const separator = sheetCfg?.caseSeparator || '-';

  const [showImporter, setShowImporter] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Quick Add Row
  const [newTm, setNewTm] = useState('');
  const [newPrefix, setNewPrefix] = useState('');
  const [newClientCode, setNewClientCode] = useState('');
  const [newRawCaseNo, setNewRawCaseNo] = useState('');
  const [newAppName, setNewAppName] = useState('');
  const [newClientName, setNewClientName] = useState('');
  const [newClassNo, setNewClassNo] = useState('');

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
  const [duplicatePolicy, setDuplicatePolicy] = useState<'skip' | 'update'>('skip');
  const [refreshReviewOnImport, setRefreshReviewOnImport] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const importMergePreview = useMemo(
    () => mergeDatabaseEntries(config.caseEntries, parsedImport.entries, duplicatePolicy),
    [config.caseEntries, parsedImport.entries, duplicatePolicy]
  );

  const filteredEntries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return config.caseEntries;
    return config.caseEntries.filter(
      (c) =>
        c.tmNumber.toLowerCase().includes(q) ||
        c.caseNo.toLowerCase().includes(q) ||
        (c.applicationName || '').toLowerCase().includes(q) ||
        c.clientName.toLowerCase().includes(q) ||
        (c.status || '').toLowerCase().includes(q)
    );
  }, [config.caseEntries, searchQuery]);

  const handleAddSingleRecord = (e: React.FormEvent) => {
    e.preventDefault();
    const tm = newTm.trim();
    const composite = formatCompositeCaseNo(newPrefix, newClientCode, newRawCaseNo, separator);
    if (!tm || !composite) return;

    const duplicate = config.caseEntries.find((c) => c.tmNumber.trim() === tm);
    if (duplicate) {
      setSingleAddError(
        `Duplicate protected: TM ${tm} is already in Database (Case ${duplicate.caseNo}).`
      );
      return;
    }
    setSingleAddError(null);

    const entry: CaseEntry = {
      tmNumber: tm,
      caseNo: composite,
      prefix: newPrefix.trim() || undefined,
      clientCode: newClientCode.trim() || undefined,
      rawCaseNo: newRawCaseNo.trim() || undefined,
      applicationName: newAppName.trim() || undefined,
      clientName: newClientName.trim(),
      classNo: newClassNo.trim() || undefined,
    };

    const nextEntries = [entry, ...config.caseEntries];
    onUpdateConfig({ ...config, caseEntries: nextEntries });
    setNewTm('');
    setNewPrefix('');
    setNewClientCode('');
    setNewRawCaseNo('');
    setNewAppName('');
    setNewClientName('');
    setNewClassNo('');
    onNotify(`Added TM ${tm} -> Case ${composite} to Database.`);
  };

  const handleRemoveEntry = (tmNumber: string) => {
    onUpdateConfig({
      ...config,
      caseEntries: config.caseEntries.filter((c) => c.tmNumber !== tmNumber),
    });
  };

  const handleFetchGoogleSheet = async () => {
    const csvUrl = buildGoogleSheetCsvUrl(sheetUrlOrId, sheetName);
    if (!csvUrl) {
      setImportError('Enter a Google Sheet URL, Sheet ID, or Published CSV link.');
      return;
    }

    setFetchingSheet(true);
    setImportError(null);
    try {
      const res = await fetch(csvUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      const head = text.trim().slice(0, 200).toLowerCase();
      if (head.startsWith('<!doctype') || head.startsWith('<html')) {
        throw new Error('GOOGLE_LOGIN_HTML');
      }
      setRawImport(text);
      setSourceLabel(`Google Sheet (${sheetName || 'DATABASE'})`);
    } catch (err) {
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

  const handleExportCsv = () => {
    const csv = exportRowsToCsv(
      [
        'DATE',
        'TYPE',
        'CLIENT CODE',
        'CASE NUMBER',
        'FORMATTED CASE NO',
        'CLIENT NAME',
        'APPLICATION NAME',
        'TM/CPR NUMBER',
        'CLASS',
        'STATUS',
        'SUB STATUS',
      ],
      config.caseEntries.map((c) => [
        c.date || '',
        c.prefix || '',
        c.clientCode || '',
        c.rawCaseNo || '',
        c.caseNo,
        c.clientName,
        c.applicationName || '',
        c.tmNumber,
        c.classNo || '',
        c.status || '',
        c.subStatus || '',
      ])
    );
    triggerFileDownload(csv, `Trademark_Case_Database.csv`, 'text/csv;charset=utf-8');
  };

  const previewNewCaseNo = formatCompositeCaseNo(newPrefix, newClientCode, newRawCaseNo, separator);

  return (
    <div className="space-y-6">
      {/* Header Toolbar */}
      <div className="bg-white border border-[#e2e4ea] p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-xl font-extrabold tracking-tight text-[#111111]">
              Case &amp; Trademark Database
            </h2>
            <span className="bg-[#ffee00] text-[#111111] px-2.5 py-0.5 text-xs font-extrabold tabular-nums">
              {config.caseEntries.length} Records
            </span>
          </div>
          <p className="text-xs text-[#555a66] mt-1 tabular-nums">
            Matches Journal App No against Col {sheetCfg?.keyCol || 8} (TM/CPR NUMBER) · Case No built
            from Cols {sheetCfg?.prefixCol || 3}-{sheetCfg?.clientCodeCol || 4}-{sheetCfg?.caseCol || 5}{' '}
            with &quot;{separator}&quot; (e.g. <span className="font-mono font-bold text-[#111111]">A-32-4</span>)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setShowImporter((prev) => !prev)}
            className="builty-btn h-[38px] pl-4 pr-3 gap-2 text-xs whitespace-nowrap"
          >
            <Database className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{showImporter ? 'Hide Database Importer' : 'Import / Sync Database'}</span>
          </button>

          <button
            type="button"
            onClick={() => onRefreshReviewCases(config.caseEntries)}
            className="h-[38px] px-3.5 border border-[#cbd0da] bg-[#f8f9fb] hover:border-[#111111] hover:bg-white text-xs font-bold text-[#111111] inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Refresh Review Case Nos</span>
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            className="h-[38px] px-3.5 border border-[#cbd0da] bg-white hover:border-[#111111] text-xs font-bold text-[#111111] inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Expandable Database Importer */}
      {showImporter && (
        <section
          aria-label="Database CSV and Google Sheet Importer"
          className="bg-white border border-[#d4d7e0] shadow-sm"
        >
          <div className="px-6 py-4 bg-[#111111] text-white flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-extrabold">
                Import DATABASE Sheet (Col 8 Match + 3-Col Case No: Prefix-Code-CaseNo)
              </h3>
              <p className="text-xs text-[#c7c9d1]">
                Supports direct Google Sheet paste/CSV export, shared CSV link fetch, or 22-column Excel rows
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setRawImport(SAMPLE_DATABASE_TSV);
                setSourceLabel('4-row DATABASE sample');
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
                  onClick={handleFetchGoogleSheet}
                  disabled={fetchingSheet}
                  className="builty-btn h-[36px] w-full pl-4 pr-3 gap-2 text-xs"
                >
                  <Globe className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{fetchingSheet ? 'Fetching…' : 'Fetch Sheet CSV'}</span>
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
                  <option value="auto">Auto-detect (Headers, Col 8+3/4/5, or 22-Col DATE Export)</option>
                  <option value="sheet_col8_345">Google Sheet (Match Col 8 · Case Cols 3-4-5)</option>
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
              placeholder="Paste rows directly from your DATABASE Google Sheet or Excel (DATE, TYPE, CLIENT CODE, CASE NUMBER, CLIENT NAME, APPLICATION NAME, TM/CPR NUMBER, CLASS...)"
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
                      {parsedImport.entries.length} unique records ({importMergePreview.added} new ·{' '}
                      {duplicatePolicy === 'skip'
                        ? `${importMergePreview.skippedDuplicates} duplicate skipped`
                        : `${importMergePreview.updated} update existing`}
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
                        <th className="py-2 px-3">TM/CPR No</th>
                        <th className="py-2 px-3">Formatted Case No</th>
                        <th className="py-2 px-3">Prefix / Code / #</th>
                        <th className="py-2 px-3">Application Name</th>
                        <th className="py-2 px-3">Class</th>
                        <th className="py-2 px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#eceef2] bg-white">
                      {parsedImport.entries.slice(0, 25).map((entry) => (
                        <tr key={entry.tmNumber}>
                          <td className="py-2 px-3 font-mono font-bold tabular-nums">{entry.tmNumber}</td>
                          <td className="py-2 px-3 font-mono font-extrabold text-[#111111]">
                            {entry.caseNo}
                          </td>
                          <td className="py-2 px-3 font-mono text-[#555a66]">
                            {[entry.prefix, entry.clientCode, entry.rawCaseNo].filter(Boolean).join(' · ') || '—'}
                          </td>
                          <td className="py-2 px-3 text-[#111111] font-semibold">
                            {entry.applicationName || entry.clientName || '—'}
                          </td>
                          <td className="py-2 px-3 font-mono tabular-nums">{entry.classNo || '—'}</td>
                          <td className="py-2 px-3 text-[#555a66]">
                            {[entry.status, entry.subStatus].filter(Boolean).join(' · ') || '—'}
                          </td>
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

      {/* Quick Add Single Database Entry */}
      <form
        onSubmit={handleAddSingleRecord}
        className="bg-white border border-[#e2e4ea] p-5 space-y-3"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-extrabold text-[#111111]">Add Single Case Record</h3>
          {previewNewCaseNo && (
            <span className="text-xs font-mono font-bold text-[#111111] bg-[#fffef0] border border-[#111111] px-2.5 py-0.5">
              Formatted Case No: {previewNewCaseNo}
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
          <input
            type="text"
            value={newTm}
            onChange={(e) => setNewTm(e.target.value)}
            placeholder="TM/CPR No (Col 8)"
            className="bg-[#f8f9fb] border border-[#cbd0da] px-2.5 py-2 text-xs font-mono text-[#111111] focus:bg-white focus:outline-none focus:border-[#111111]"
          />
          <input
            type="text"
            value={newPrefix}
            onChange={(e) => setNewPrefix(e.target.value)}
            placeholder="Prefix (A/X/N)"
            className="bg-[#f8f9fb] border border-[#cbd0da] px-2.5 py-2 text-xs font-mono text-[#111111] focus:bg-white focus:outline-none focus:border-[#111111]"
          />
          <input
            type="text"
            value={newClientCode}
            onChange={(e) => setNewClientCode(e.target.value)}
            placeholder="Client Code (32)"
            className="bg-[#f8f9fb] border border-[#cbd0da] px-2.5 py-2 text-xs font-mono text-[#111111] focus:bg-white focus:outline-none focus:border-[#111111]"
          />
          <input
            type="text"
            value={newRawCaseNo}
            onChange={(e) => setNewRawCaseNo(e.target.value)}
            placeholder="Case # (4)"
            className="bg-[#f8f9fb] border border-[#cbd0da] px-2.5 py-2 text-xs font-mono text-[#111111] focus:bg-white focus:outline-none focus:border-[#111111]"
          />
          <input
            type="text"
            value={newAppName}
            onChange={(e) => setNewAppName(e.target.value)}
            placeholder="Application Name"
            className="bg-[#f8f9fb] border border-[#cbd0da] px-2.5 py-2 text-xs text-[#111111] focus:bg-white focus:outline-none focus:border-[#111111]"
          />
          <input
            type="text"
            value={newClientName}
            onChange={(e) => setNewClientName(e.target.value)}
            placeholder="Client Name"
            className="bg-[#f8f9fb] border border-[#cbd0da] px-2.5 py-2 text-xs text-[#111111] focus:bg-white focus:outline-none focus:border-[#111111]"
          />
          <input
            type="text"
            value={newClassNo}
            onChange={(e) => setNewClassNo(e.target.value)}
            placeholder="Class"
            className="bg-[#f8f9fb] border border-[#cbd0da] px-2.5 py-2 text-xs font-mono text-[#111111] focus:bg-white focus:outline-none focus:border-[#111111]"
          />
          <button
            type="submit"
            className="bg-[#ffee00] text-[#111111] text-xs font-extrabold hover:bg-[#e6d600] inline-flex items-center justify-center gap-1.5 px-3 py-2"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Add</span>
          </button>
        </div>
        {singleAddError && (
          <p className="text-xs font-semibold text-red-600">{singleAddError}</p>
        )}
      </form>

      {/* Search & Main Database Table */}
      <div className="bg-white border border-[#e2e4ea] overflow-hidden">
        <div className="p-4 border-b border-[#e2e4ea] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search
              className="w-4 h-4 text-[#6b7280] absolute left-3 top-1/2 -translate-y-1/2"
              aria-hidden="true"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search TM/CPR No, Case No (e.g. A-32-4), App Name, Client, Status…"
              className="w-full bg-[#f8f9fb] border border-[#cbd0da] pl-9 pr-3 py-2 text-xs text-[#111111] focus:bg-white focus:outline-none focus:border-[#111111]"
            />
          </div>
          <span className="text-xs text-[#555a66] tabular-nums">
            Showing {Math.min(MAX_VISIBLE, filteredEntries.length)} of {filteredEntries.length} records
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[960px] text-xs">
            <thead className="bg-[#111111] text-white text-[11px] uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">TM/CPR No (Col 8)</th>
                <th className="py-3 px-4">Case No (3-4-5)</th>
                <th className="py-3 px-4">Prefix · Code · #</th>
                <th className="py-3 px-4">Application Name</th>
                <th className="py-3 px-4">Client Name</th>
                <th className="py-3 px-4 text-center">Class</th>
                <th className="py-3 px-4">Status / Sub Status</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eceef2] bg-white">
              {filteredEntries.slice(0, MAX_VISIBLE).map((c) => (
                <tr key={c.tmNumber} className="hover:bg-[#f7f8fa]">
                  <td className="py-2.5 px-4 font-mono font-bold text-[#111111] tabular-nums whitespace-nowrap">
                    {c.tmNumber}
                  </td>
                  <td className="py-2.5 px-4 whitespace-nowrap">
                    <span className="px-2 py-0.5 bg-[#fffef0] border border-[#111111] font-mono font-extrabold text-[#111111]">
                      {c.caseNo}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 font-mono text-[#555a66] tabular-nums whitespace-nowrap">
                    {c.prefix || c.clientCode || c.rawCaseNo
                      ? `${c.prefix || '—'} · ${c.clientCode || '—'} · ${c.rawCaseNo || '—'}`
                      : '—'}
                  </td>
                  <td className="py-2.5 px-4 font-semibold text-[#111111]">
                    {c.applicationName || '—'}
                  </td>
                  <td className="py-2.5 px-4 text-[#4b505c]">{c.clientName || '—'}</td>
                  <td className="py-2.5 px-4 text-center font-mono tabular-nums">
                    {c.classNo || '—'}
                  </td>
                  <td className="py-2.5 px-4 text-[#4b505c]">
                    {[c.status, c.subStatus].filter(Boolean).join(' · ') || '—'}
                  </td>
                  <td className="py-2.5 px-4 font-mono text-[#555a66] whitespace-nowrap">
                    {c.date || '—'}
                  </td>
                  <td className="py-2.5 px-4 text-right">
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
              ))}
              {filteredEntries.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-xs text-[#555a66]">
                    No Database records match your filter. Click &quot;Import / Sync Database&quot; above to load your sheet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
