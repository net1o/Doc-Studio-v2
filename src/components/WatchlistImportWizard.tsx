import { useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  Database,
  FileSpreadsheet,
  FileUp,
  Globe,
  RefreshCw,
  RotateCcw,
  X,
} from 'lucide-react';
import { CaseEntry, CaseSheetConfig, JournalConfig } from '../types/journal';
import {
  buildGoogleSheetCsvUrl,
  checkDuplicate,
  parseCaseLookupInput,
  parseWatchlistImport,
} from '../lib/journal/engine';
import {
  DEFAULT_APPS_SCRIPT_CASE_SHEET_ID,
  DEFAULT_APPS_SCRIPT_CASE_SHEET_NAME,
  USER_WATCHLIST_KEYWORDS,
  USER_WATCHLIST_TM_NUMBERS,
} from '../lib/journal/watchlistSeed';

export type WatchlistWizardTab = 'watchlist' | 'casemap';

interface WatchlistImportWizardProps {
  initialTab?: WatchlistWizardTab;
  config: JournalConfig;
  onApplyWatchlist: (
    keywords: string[],
    tmNumbers: string[],
    mode: 'append' | 'replace'
  ) => void;
  onApplyCaseEntries: (
    entries: CaseEntry[],
    mode: 'append' | 'replace',
    sheetConfig: CaseSheetConfig,
    refreshReview: boolean
  ) => void;
  onClose: () => void;
}

export function WatchlistImportWizard({
  initialTab = 'watchlist',
  config,
  onApplyWatchlist,
  onApplyCaseEntries,
  onClose,
}: WatchlistImportWizardProps) {
  const [activeTab, setActiveTab] = useState<WatchlistWizardTab>(initialTab);

  // Watchlist import state
  const [watchlistRaw, setWatchlistRaw] = useState('');
  const [watchlistTarget, setWatchlistTarget] = useState<'auto' | 'keywords_only' | 'tm_only'>('auto');
  const [watchlistError, setWatchlistError] = useState<string | null>(null);
  const watchlistFileRef = useRef<HTMLInputElement>(null);

  // Case Lookup import state
  const [sheetUrlOrId, setSheetUrlOrId] = useState(
    config.caseSheetConfig?.sheetUrlOrId || DEFAULT_APPS_SCRIPT_CASE_SHEET_ID
  );
  const [sheetName, setSheetName] = useState(
    config.caseSheetConfig?.sheetName || DEFAULT_APPS_SCRIPT_CASE_SHEET_NAME
  );
  const [mappingMode, setMappingMode] = useState<
    'auto' | 'apps_script_database' | 'three_col' | 'custom'
  >('auto');
  const [keyCol, setKeyCol] = useState(config.caseSheetConfig?.keyCol || 8);
  const [caseCol, setCaseCol] = useState(config.caseSheetConfig?.caseCol || 3);
  const [clientCol, setClientCol] = useState(config.caseSheetConfig?.clientCol || 4);
  const [caseRaw, setCaseRaw] = useState('');
  const [caseSourceLabel, setCaseSourceLabel] = useState('');
  const [fetchingSheet, setFetchingSheet] = useState(false);
  const [caseError, setCaseError] = useState<string | null>(null);
  const [refreshReviewOnImport, setRefreshReviewOnImport] = useState(true);
  const caseFileRef = useRef<HTMLInputElement>(null);

  const parsedWatchlist = useMemo(
    () => parseWatchlistImport(watchlistRaw, watchlistTarget),
    [watchlistRaw, watchlistTarget]
  );

  const watchlistDupStats = useMemo(() => {
    const existingKw = new Set(config.keywords.map((k) => k.trim().toLowerCase()));
    const newKw = parsedWatchlist.keywords.filter((k) => !existingKw.has(k.trim().toLowerCase())).length;
    const tmDup = checkDuplicate(parsedWatchlist.tmNumbers, config.tmNumbers);
    return {
      newKw,
      dupKw: parsedWatchlist.keywords.length - newKw,
      newTm: tmDup.unique.length,
      dupTm: tmDup.duplicates.length,
    };
  }, [parsedWatchlist, config.keywords, config.tmNumbers]);

  const parsedCaseMap = useMemo(
    () =>
      parseCaseLookupInput(caseRaw, {
        mappingMode:
          mappingMode === 'apps_script_database' ? 'sheet_col8_345' : mappingMode,
        keyCol,
        caseCol,
        clientCol,
      }),
    [caseRaw, mappingMode, keyCol, caseCol, clientCol]
  );

  const caseDupCount = useMemo(() => {
    return checkDuplicate(
      parsedCaseMap.entries.map((e) => e.tmNumber),
      config.caseEntries.map((c) => c.tmNumber)
    ).duplicates.length;
  }, [parsedCaseMap.entries, config.caseEntries]);

  const handleWatchlistFile = async (file: File) => {
    setWatchlistError(null);
    try {
      const text = await file.text();
      setWatchlistRaw(text);
    } catch {
      setWatchlistError('Could not read the selected file. Ensure it is UTF-8 text, CSV, or TSV.');
    }
  };

  const handleCaseFile = async (file: File) => {
    setCaseError(null);
    try {
      const text = await file.text();
      setCaseRaw(text);
      setCaseSourceLabel(file.name);
    } catch {
      setCaseError('Could not read the selected CSV file.');
    }
  };

  const handleFetchGoogleSheet = async () => {
    const csvUrl = buildGoogleSheetCsvUrl(sheetUrlOrId, sheetName);
    if (!csvUrl) {
      setCaseError('Enter a Google Sheet URL, Sheet ID, or Published CSV link.');
      return;
    }

    setFetchingSheet(true);
    setCaseError(null);
    try {
      const res = await fetch(csvUrl);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const text = await res.text();
      const trimmedLower = text.trim().slice(0, 200).toLowerCase();
      if (trimmedLower.startsWith('<!doctype') || trimmedLower.startsWith('<html')) {
        throw new Error('GOOGLE_LOGIN_HTML');
      }
      setCaseRaw(text);
      setCaseSourceLabel(`Google Sheet (${sheetName || 'CSV'})`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg === 'GOOGLE_LOGIN_HTML') {
        setCaseError(
          'Google returned a sign-in page because this spreadsheet is private. Either set sharing to "Anyone with the link -> Viewer", paste a File -> Share -> Publish to web CSV link, or download the DATABASE sheet as CSV and upload it below.'
        );
      } else {
        setCaseError(
          'Unable to fetch Google Sheet CSV directly (usually due to private sharing or CORS). Export the DATABASE tab as .csv or publish to web as CSV and paste/upload it below.'
        );
      }
    } finally {
      setFetchingSheet(false);
    }
  };

  const currentSheetConfig: CaseSheetConfig = {
    sheetUrlOrId: sheetUrlOrId.trim(),
    sheetName: sheetName.trim(),
    keyCol,
    caseCol,
    clientCol,
    lastSyncedAt: new Date().toISOString(),
  };

  return (
    <section
      aria-label="Watchlist and Case Lookup Import Wizard"
      className="bg-white border border-[#d4d7e0] shadow-sm"
    >
      {/* Top Bar */}
      <div className="px-6 py-4 bg-[#111111] text-white flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[#ffee00] text-[#111111] flex items-center justify-center shrink-0">
            <Database className="w-4 h-4" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-sm font-extrabold tracking-tight">
              Watchlist &amp; Case Lookup Import System
            </h3>
            <p className="text-xs text-[#c7c9d1]">
              Bulk-import Keywords, 6-digit TM Numbers, and Google Sheet DATABASE Case Mappings
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close watchlist import wizard"
          className="p-1.5 text-[#c7c9d1] hover:text-[#ffee00] transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Mode Switcher */}
      <div className="px-6 pt-5 flex flex-wrap gap-2 border-b border-[#e2e4ea]">
        <button
          type="button"
          data-sfx="filter"
          data-active={activeTab === 'watchlist'}
          onClick={() => setActiveTab('watchlist')}
          className={`builty-filter-btn px-4 py-2.5 text-xs font-extrabold border-b-2 ${
            activeTab === 'watchlist'
              ? 'border-[#111111] text-[#111111] bg-[#ffee00]'
              : 'border-transparent text-[#555a66] hover:text-[#111111] hover:bg-[#f6f7f9]'
          }`}
        >
          1. Keywords &amp; 6-Digit TM Numbers
        </button>
        <button
          type="button"
          data-sfx="filter"
          data-active={activeTab === 'casemap'}
          onClick={() => setActiveTab('casemap')}
          className={`builty-filter-btn px-4 py-2.5 text-xs font-extrabold border-b-2 ${
            activeTab === 'casemap'
              ? 'border-[#111111] text-[#111111] bg-[#ffee00]'
              : 'border-transparent text-[#555a66] hover:text-[#111111] hover:bg-[#f6f7f9]'
          }`}
        >
          2. Case Lookup Map (DATABASE Sheet / CSV)
        </button>
      </div>

      {/* TAB 1: WATCHLIST KEYWORDS & TM NUMBERS */}
      {activeTab === 'watchlist' && (
        <div className="p-6 space-y-5">
          <div className="bg-[#f6f7f9] border border-[#e2e4ea] p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div className="space-y-1">
              <div className="text-xs font-bold text-[#111111]">
                Supported Formats: Excel 2-Column Paste (Keywords + TM Numbers), CSV, or Plain Lists
              </div>
              <div className="text-xs text-[#555a66]">
                Paste directly from Excel/Google Sheets or upload a .csv/.tsv/.txt file. Headers like
                &quot;Keywords&quot; and &quot;TM Numbers (6-digit)&quot; are skipped automatically.
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                onApplyWatchlist(USER_WATCHLIST_KEYWORDS, USER_WATCHLIST_TM_NUMBERS, 'append');
              }}
              className="h-[36px] px-3.5 bg-white border border-[#cbd0da] hover:border-[#111111] text-xs font-bold text-[#111111] inline-flex items-center gap-2 shrink-0 whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>
                Ensure Seed List ({USER_WATCHLIST_KEYWORDS.length} KW ·{' '}
                {USER_WATCHLIST_TM_NUMBERS.length} TMs)
              </span>
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <label htmlFor="wl-target-mode" className="text-xs font-bold text-[#111111]">
                Parse Mode:
              </label>
              <select
                id="wl-target-mode"
                value={watchlistTarget}
                onChange={(e) =>
                  setWatchlistTarget(e.target.value as 'auto' | 'keywords_only' | 'tm_only')
                }
                className="bg-[#f8f9fb] border border-[#cbd0da] px-3 py-1.5 text-xs font-semibold text-[#111111] focus:bg-white focus:outline-none focus:border-[#111111]"
              >
                <option value="auto">Auto-detect (Keywords + 6-digit TMs)</option>
                <option value="keywords_only">Keywords Only</option>
                <option value="tm_only">6-Digit TM Numbers Only</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <input
                ref={watchlistFileRef}
                type="file"
                accept=".csv,.tsv,.txt"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    handleWatchlistFile(f);
                    e.target.value = '';
                  }
                }}
              />
              <button
                type="button"
                onClick={() => watchlistFileRef.current?.click()}
                className="h-[34px] px-3 border border-[#cbd0da] bg-white hover:border-[#111111] text-xs font-bold text-[#111111] inline-flex items-center gap-1.5"
              >
                <FileUp className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Upload File</span>
              </button>
              {watchlistRaw && (
                <button
                  type="button"
                  onClick={() => setWatchlistRaw('')}
                  className="text-xs text-[#555a66] hover:text-[#111111] underline"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          <textarea
            rows={6}
            value={watchlistRaw}
            onChange={(e) => setWatchlistRaw(e.target.value)}
            placeholder={`Keywords\tTM Numbers (6-digit)\nA2Z CONSULTANTS\t210199\nAIMA Management\t234336\n\t506000`}
            aria-label="Paste keywords or 6-digit TM numbers"
            className="w-full bg-[#f8f9fb] border border-[#cbd0da] p-3 text-xs font-mono text-[#111111] focus:bg-white focus:outline-none focus:border-[#111111]"
          />

          {watchlistError && (
            <div className="p-3 bg-red-50 border border-red-300 text-xs font-semibold text-red-800">
              {watchlistError}
            </div>
          )}

          {(parsedWatchlist.keywords.length > 0 || parsedWatchlist.tmNumbers.length > 0) && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2 text-xs text-[#111111] tabular-nums">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />
                <span className="font-bold">
                  {parsedWatchlist.keywords.length} keyword(s) ({watchlistDupStats.newKw} new, {watchlistDupStats.dupKw} dup)
                </span>
                <span aria-hidden="true" className="text-[#9ca3af]">·</span>
                <span className="font-bold">
                  {parsedWatchlist.tmNumbers.length} TM(s) ({watchlistDupStats.newTm} new, {watchlistDupStats.dupTm} dup)
                </span>
                {parsedWatchlist.invalidTmTokens.length > 0 && (
                  <>
                    <span aria-hidden="true" className="text-[#9ca3af]">·</span>
                    <span className="text-amber-800">
                      {parsedWatchlist.invalidTmTokens.length} non-6-digit token(s) ignored
                    </span>
                  </>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border border-[#e2e4ea] p-3 bg-[#f8f9fb] max-h-[160px] overflow-y-auto">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[#555a66] mb-2">
                    Keywords Preview (first 30)
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {parsedWatchlist.keywords.slice(0, 30).map((kw) => (
                      <span
                        key={kw}
                        className="px-2 py-0.5 bg-white border border-[#d4d7e0] text-[11px] font-mono text-[#111111]"
                      >
                        {kw}
                      </span>
                    ))}
                    {parsedWatchlist.keywords.length === 0 && (
                      <span className="text-xs text-[#555a66]">None in pasted data</span>
                    )}
                  </div>
                </div>

                <div className="border border-[#e2e4ea] p-3 bg-[#f8f9fb] max-h-[160px] overflow-y-auto">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[#555a66] mb-2">
                    TM Numbers Preview (first 30)
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {parsedWatchlist.tmNumbers.slice(0, 30).map((tm) => (
                      <span
                        key={tm}
                        className="px-2 py-0.5 bg-white border border-[#d4d7e0] text-[11px] font-mono tabular-nums text-[#111111]"
                      >
                        {tm}
                      </span>
                    ))}
                    {parsedWatchlist.tmNumbers.length === 0 && (
                      <span className="text-xs text-[#555a66]">None in pasted data</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2 border-t border-[#eceef2]">
                <button
                  type="button"
                  onClick={() => {
                    onApplyWatchlist(
                      parsedWatchlist.keywords,
                      parsedWatchlist.tmNumbers,
                      'append'
                    );
                    setWatchlistRaw('');
                  }}
                  className="h-[38px] px-4 border border-[#111111] bg-white text-xs font-bold text-[#111111] hover:bg-[#f6f7f9]"
                >
                  Append / Merge into Watchlist
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onApplyWatchlist(
                      parsedWatchlist.keywords,
                      parsedWatchlist.tmNumbers,
                      'replace'
                    );
                    setWatchlistRaw('');
                  }}
                  className="builty-btn h-[38px] pl-4 pr-3 gap-2 text-xs"
                >
                  <span>Replace Matched Watchlist Columns</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: CASE LOOKUP MAP (DATABASE SHEET / CSV) */}
      {activeTab === 'casemap' && (
        <div className="p-6 space-y-5">
          <div className="bg-[#f6f7f9] border border-[#e2e4ea] p-4 space-y-1.5">
            <div className="text-xs font-bold text-[#111111]">
              Google Sheet &quot;DATABASE&quot; Connector (Matches Apps Script CFG)
            </div>
            <p className="text-xs text-[#555a66]">
              Configured for <span className="font-mono text-[#111111]">Col H (8) = TM/CPR NUMBER</span>{' '}
              mapped to <span className="font-mono text-[#111111]">Col C (3) = CASE NUMBER</span> and{' '}
              <span className="font-mono text-[#111111]">Col D (4) = CLIENT NAME</span>. Paste a shared/published
              Google Sheet CSV link below or upload/paste an exported CSV.
            </p>
          </div>

          {/* Google Sheet Link / ID Sync */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-end">
            <div className="lg:col-span-6">
              <label htmlFor="case-sheet-url" className="block text-xs font-bold text-[#111111] mb-1">
                Google Sheet URL, Sheet ID, or Published CSV Link
              </label>
              <input
                id="case-sheet-url"
                type="text"
                value={sheetUrlOrId}
                onChange={(e) => setSheetUrlOrId(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/.../pub?output=csv or Sheet ID"
                className="w-full bg-[#f8f9fb] border border-[#cbd0da] px-3 py-2 text-xs font-mono text-[#111111] focus:bg-white focus:outline-none focus:border-[#111111]"
              />
            </div>

            <div className="lg:col-span-3">
              <label htmlFor="case-sheet-tab" className="block text-xs font-bold text-[#111111] mb-1">
                Sheet Tab Name
              </label>
              <input
                id="case-sheet-tab"
                type="text"
                value={sheetName}
                onChange={(e) => setSheetName(e.target.value)}
                placeholder="DATABASE"
                className="w-full bg-[#f8f9fb] border border-[#cbd0da] px-3 py-2 text-xs text-[#111111] focus:bg-white focus:outline-none focus:border-[#111111]"
              />
            </div>

            <div className="lg:col-span-3 flex gap-2">
              <button
                type="button"
                onClick={handleFetchGoogleSheet}
                disabled={fetchingSheet}
                className="builty-btn h-[36px] flex-1 pl-3.5 pr-3 gap-2 text-xs whitespace-nowrap"
              >
                <Globe className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{fetchingSheet ? 'Fetching…' : 'Fetch Sheet CSV'}</span>
              </button>
            </div>
          </div>

          {/* Column Mapping & File Upload */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end border-t border-b border-[#eceef2] py-3">
            <div className="md:col-span-5">
              <label htmlFor="case-col-preset" className="block text-xs font-bold text-[#111111] mb-1">
                Column Mapping Preset
              </label>
              <select
                id="case-col-preset"
                value={mappingMode}
                onChange={(e) =>
                  setMappingMode(
                    e.target.value as 'auto' | 'apps_script_database' | 'three_col' | 'custom'
                  )
                }
                className="w-full bg-[#f8f9fb] border border-[#cbd0da] px-3 py-2 text-xs font-semibold text-[#111111] focus:bg-white focus:outline-none focus:border-[#111111]"
              >
                <option value="auto">Auto-detect (Headers or Apps Script Width)</option>
                <option value="apps_script_database">Apps Script DATABASE (Col H → Col C &amp; D)</option>
                <option value="three_col">3-Column CSV (TM No, Case No, Client)</option>
                <option value="custom">Custom 1-Based Column Numbers</option>
              </select>
            </div>

            {mappingMode === 'custom' && (
              <>
                <div className="md:col-span-2">
                  <label htmlFor="case-key-col" className="block text-xs font-bold text-[#111111] mb-1">
                    TM Col #
                  </label>
                  <input
                    id="case-key-col"
                    type="number"
                    min={1}
                    value={keyCol}
                    onChange={(e) => setKeyCol(Math.max(1, Number(e.target.value) || 1))}
                    className="w-full bg-[#f8f9fb] border border-[#cbd0da] px-2.5 py-2 text-xs font-mono text-[#111111]"
                  />
                </div>
                <div className="md:col-span-2">
                  <label htmlFor="case-no-col" className="block text-xs font-bold text-[#111111] mb-1">
                    Case Col #
                  </label>
                  <input
                    id="case-no-col"
                    type="number"
                    min={1}
                    value={caseCol}
                    onChange={(e) => setCaseCol(Math.max(1, Number(e.target.value) || 1))}
                    className="w-full bg-[#f8f9fb] border border-[#cbd0da] px-2.5 py-2 text-xs font-mono text-[#111111]"
                  />
                </div>
                <div className="md:col-span-2">
                  <label htmlFor="case-client-col" className="block text-xs font-bold text-[#111111] mb-1">
                    Client Col #
                  </label>
                  <input
                    id="case-client-col"
                    type="number"
                    min={1}
                    value={clientCol}
                    onChange={(e) => setClientCol(Math.max(1, Number(e.target.value) || 1))}
                    className="w-full bg-[#f8f9fb] border border-[#cbd0da] px-2.5 py-2 text-xs font-mono text-[#111111]"
                  />
                </div>
              </>
            )}

            <div className={mappingMode === 'custom' ? 'md:col-span-12 flex justify-end' : 'md:col-span-7 flex justify-end gap-2'}>
              <input
                ref={caseFileRef}
                type="file"
                accept=".csv,.tsv,.txt"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    handleCaseFile(f);
                    e.target.value = '';
                  }
                }}
              />
              <button
                type="button"
                onClick={() => caseFileRef.current?.click()}
                className="h-[36px] px-3.5 border border-[#cbd0da] bg-white hover:border-[#111111] text-xs font-bold text-[#111111] inline-flex items-center gap-1.5"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Upload DATABASE CSV / TSV</span>
              </button>
              {caseSourceLabel && (
                <span className="text-xs font-semibold text-[#555a66] self-center">
                  Loaded: {caseSourceLabel}
                </span>
              )}
            </div>
          </div>

          <textarea
            rows={5}
            value={caseRaw}
            onChange={(e) => {
              setCaseRaw(e.target.value);
              setCaseSourceLabel('Pasted CSV/TSV');
            }}
            placeholder="Paste exported DATABASE CSV or TSV rows here (or click Fetch Sheet CSV / Upload DATABASE CSV above)…"
            aria-label="Paste Case Lookup DATABASE CSV"
            className="w-full bg-[#f8f9fb] border border-[#cbd0da] p-3 text-xs font-mono text-[#111111] focus:bg-white focus:outline-none focus:border-[#111111]"
          />

          {caseError && (
            <div className="p-3 bg-amber-50 border border-amber-300 text-xs font-medium text-amber-900">
              {caseError}
            </div>
          )}

          {parsedCaseMap.entries.length > 0 && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#111111] tabular-nums">
                <div className="flex flex-wrap items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />
                  <span className="font-bold">
                    {parsedCaseMap.entries.length} unique TM mappings ({parsedCaseMap.entries.length - caseDupCount} new · {caseDupCount} existing)
                  </span>
                  <span aria-hidden="true" className="text-[#9ca3af]">·</span>
                  <span className="text-[#555a66]">{parsedCaseMap.detectedLayout}</span>
                </div>
                <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={refreshReviewOnImport}
                    onChange={(e) => setRefreshReviewOnImport(e.target.checked)}
                    className="w-4 h-4 accent-[#111111]"
                  />
                  <span className="font-semibold flex items-center gap-1">
                    <RefreshCw className="w-3 h-3" aria-hidden="true" />
                    Update Case Nos in Review Queue
                  </span>
                </label>
              </div>

              <div className="border border-[#e2e4ea] overflow-x-auto max-h-[220px]">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="sticky top-0 bg-[#111111] text-white text-[11px] uppercase tracking-wider">
                    <tr>
                      <th className="py-2 px-3">TM / CPR Number</th>
                      <th className="py-2 px-3">Case Number</th>
                      <th className="py-2 px-3">Client Name</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#eceef2] bg-white">
                    {parsedCaseMap.entries.slice(0, 30).map((entry) => (
                      <tr key={entry.tmNumber} className="hover:bg-[#f7f8fa]">
                        <td className="py-2 px-3 font-mono font-bold text-[#111111] tabular-nums">
                          {entry.tmNumber}
                        </td>
                        <td className="py-2 px-3 font-semibold text-[#111111]">{entry.caseNo}</td>
                        <td className="py-2 px-3 text-[#4b505c]">{entry.clientName || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2 border-t border-[#eceef2]">
                <button
                  type="button"
                  onClick={() => {
                    onApplyCaseEntries(
                      parsedCaseMap.entries,
                      'append',
                      currentSheetConfig,
                      refreshReviewOnImport
                    );
                    setCaseRaw('');
                  }}
                  className="h-[38px] px-4 border border-[#111111] bg-white text-xs font-bold text-[#111111] hover:bg-[#f6f7f9]"
                >
                  Merge {parsedCaseMap.entries.length} Entries
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onApplyCaseEntries(
                      parsedCaseMap.entries,
                      'replace',
                      currentSheetConfig,
                      refreshReviewOnImport
                    );
                    setCaseRaw('');
                  }}
                  className="builty-btn h-[38px] pl-4 pr-3 gap-2 text-xs"
                >
                  <span>Replace Case Lookup Map ({parsedCaseMap.entries.length})</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
