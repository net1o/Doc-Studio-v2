import { useMemo, useState } from 'react';
import {
  ArrowDownUp,
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  Database,
  Edit3,
  FileSpreadsheet,
  FolderSearch,
  Layers,
  Play,
  Plus,
  Printer,
  Search,
  SearchCheck,
  Settings2,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import {
  AppTab,
  CaseEntry,
  CaseSheetConfig,
  JournalConfig,
  JournalStats,
} from '../types/journal';
import {
  checkDuplicate,
  getCaseEntryKey,
  mergeDatabaseEntries,
  mergeUniqueKeywords,
  mergeUniqueTmNumbers,
} from '../lib/journal/engine';
import { WatchlistImportWizard, WatchlistWizardTab } from './WatchlistImportWizard';
import { WatchlistBulkModal } from './WatchlistBulkModal';
import { BrandexLogo } from './BrandexLogo';
import { DeleteAllConfirmModal } from './TableControlsBar';

interface AnalyzerViewProps {
  config: JournalConfig;
  stats: JournalStats;
  allTimeStats?: JournalStats;
  journalRowCount: number;
  pageSize?: number;
  defaultEditMode?: boolean;
  onUpdateConfig: (next: JournalConfig) => void;
  onRunScan: () => void;
  onGoToTab: (tab: AppTab) => void;
  onRefreshReviewCases: (entries: CaseEntry[]) => void;
  onNotify: (message: string) => void;
}

export function AnalyzerView({
  config,
  stats,
  allTimeStats,
  journalRowCount,
  pageSize = 50,
  defaultEditMode = false,
  onUpdateConfig,
  onRunScan,
  onGoToTab,
  onRefreshReviewCases,
  onNotify,
}: AnalyzerViewProps) {
  const safePageSize = Math.max(1, pageSize || 50);

  const [newKeyword, setNewKeyword] = useState('');
  const [newTm, setNewTm] = useState('');
  const [tmError, setTmError] = useState<string | null>(null);
  const [caseTm, setCaseTm] = useState('');
  const [caseNo, setCaseNo] = useState('');
  const [caseClient, setCaseClient] = useState('');
  const [caseError, setCaseError] = useState<string | null>(null);

  const [kwSearch, setKwSearch] = useState('');
  const [tmSearch, setTmSearch] = useState('');
  const [caseSearch, setCaseSearch] = useState('');

  const [kwSort, setKwSort] = useState<'default' | 'asc' | 'desc'>('default');
  const [tmSort, setTmSort] = useState<'default' | 'asc' | 'desc'>('default');
  const [caseSort, setCaseSort] = useState<'default' | 'asc' | 'desc'>('default');

  const [kwEditMode, setKwEditMode] = useState(defaultEditMode);
  const [tmEditMode, setTmEditMode] = useState(defaultEditMode);
  const [caseEditMode, setCaseEditMode] = useState(defaultEditMode);

  const [kwPage, setKwPage] = useState(1);
  const [tmPage, setTmPage] = useState(1);
  const [casePage, setCasePage] = useState(1);

  const [deleteConfirm, setDeleteConfirm] = useState<null | 'keywords' | 'tms' | 'cases'>(null);

  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardTab, setWizardTab] = useState<WatchlistWizardTab>('watchlist');
  const [bulkModalOpen, setBulkModalOpen] = useState(false);

  const logoPrimary = config.universalSettings?.docPrimaryColor || '#290076';
  const logoAccent = config.universalSettings?.docAccentColor || '#f4580b';

  const openWizard = (tab: WatchlistWizardTab) => {
    setWizardTab(tab);
    setWizardOpen(true);
  };

  const handleAddKeyword = (e: React.FormEvent) => {
    e.preventDefault();
    const parts = newKeyword
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length === 0) return;

    const { merged, added, skippedDuplicates } = mergeUniqueKeywords(
      config.keywords,
      parts,
      true
    );
    onUpdateConfig({ ...config, keywords: merged });
    setNewKeyword('');
    setKwPage(1);
    if (skippedDuplicates > 0) {
      onNotify(`Keywords updated: ${added} added, ${skippedDuplicates} duplicate skipped.`);
    }
  };

  const handleRenameKeyword = (oldVal: string, nextVal: string) => {
    const cleaned = nextVal.trim();
    if (!cleaned || cleaned === oldVal) return;
    onUpdateConfig({
      ...config,
      keywords: config.keywords.map((k) => (k === oldVal ? cleaned : k)),
    });
  };

  const handleRemoveKeyword = (kw: string) => {
    onUpdateConfig({
      ...config,
      keywords: config.keywords.filter((k) => k !== kw),
    });
  };

  const handleAddTm = (e: React.FormEvent) => {
    e.preventDefault();
    const parts = newTm
      .split(/[\s,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length === 0) return;
    const invalid = parts.filter((p) => !/^\d{6}$/.test(p));
    if (invalid.length > 0) {
      setTmError(`Invalid 6-digit TM number(s): ${invalid.slice(0, 3).join(', ')}`);
      return;
    }
    setTmError(null);
    const dupCheck = checkDuplicate(parts, config.tmNumbers);
    if (dupCheck.unique.length === 0) {
      setTmError('Entered TM number(s) already exist.');
      return;
    }

    const { merged, added, skippedDuplicates } = mergeUniqueTmNumbers(
      config.tmNumbers,
      dupCheck.unique,
      true
    );
    onUpdateConfig({ ...config, tmNumbers: merged });
    setNewTm('');
    setTmPage(1);
    const totalSkipped = dupCheck.duplicates.length + skippedDuplicates;
    if (totalSkipped > 0) {
      onNotify(`TM Numbers updated: ${added} added, ${totalSkipped} duplicate skipped.`);
    }
  };

  const handleRenameTm = (oldVal: string, nextVal: string) => {
    const cleaned = nextVal.trim();
    if (!cleaned || cleaned === oldVal) return;
    onUpdateConfig({
      ...config,
      tmNumbers: config.tmNumbers.map((t) => (t === oldVal ? cleaned : t)),
    });
  };

  const handleRemoveTm = (tm: string) => {
    onUpdateConfig({
      ...config,
      tmNumbers: config.tmNumbers.filter((t) => t !== tm),
    });
  };

  const handleAddCaseEntry = (e: React.FormEvent) => {
    e.preventDefault();
    const tm = caseTm.trim();
    const cNo = caseNo.trim();
    if (!tm || !cNo) return;

    const dupCheck = checkDuplicate(
      tm,
      config.caseEntries.map((c) => c.tmNumber)
    );
    if (dupCheck.isDuplicate) {
      const dup = config.caseEntries.find((c) => c.tmNumber.trim() === tm);
      setCaseError(`TM ${tm} already maps to ${dup?.caseNo || 'existing'}.`);
      return;
    }
    setCaseError(null);

    const entry: CaseEntry = {
      tmNumber: tm,
      caseNo: cNo,
      clientName: caseClient.trim(),
    };
    onUpdateConfig({
      ...config,
      caseEntries: [entry, ...config.caseEntries],
    });
    setCaseTm('');
    setCaseNo('');
    setCaseClient('');
    setCasePage(1);
  };

  const handleUpdateCaseEntry = (targetKey: string, patch: Partial<CaseEntry>) => {
    onUpdateConfig({
      ...config,
      caseEntries: config.caseEntries.map((c, idx) =>
        getCaseEntryKey(c, idx) === targetKey ? { ...c, ...patch } : c
      ),
    });
  };

  const handleMergeBulkWatchlist = (
    keywords: string[],
    tmNumbers: string[],
    mode: 'merge' | 'replace'
  ) => {
    if (mode === 'replace') {
      const nextKwRes =
        keywords.length > 0
          ? mergeUniqueKeywords([], keywords, true)
          : { merged: config.keywords, added: 0, skippedDuplicates: 0 };
      const nextTmRes =
        tmNumbers.length > 0
          ? mergeUniqueTmNumbers([], tmNumbers, true)
          : { merged: config.tmNumbers, added: 0, skippedDuplicates: 0 };

      onUpdateConfig({
        ...config,
        keywords: nextKwRes.merged,
        tmNumbers: nextTmRes.merged,
      });
      onNotify(
        `Watchlist replaced: ${nextKwRes.merged.length} keywords and ${nextTmRes.merged.length} TMs.`
      );
      return;
    }

    const kwRes = mergeUniqueKeywords(config.keywords, keywords, true);
    const tmRes = mergeUniqueTmNumbers(config.tmNumbers, tmNumbers, true);
    const totalSkipped = kwRes.skippedDuplicates + tmRes.skippedDuplicates;

    onUpdateConfig({
      ...config,
      keywords: kwRes.merged,
      tmNumbers: tmRes.merged,
    });
    onNotify(
      `Watchlist merged: +${kwRes.added} keywords, +${tmRes.added} TMs${
        totalSkipped > 0 ? ` (${totalSkipped} duplicate skipped)` : ''
      }.`
    );
  };

  const handleApplyWatchlistImport = (
    keywords: string[],
    tmNumbers: string[],
    mode: 'append' | 'replace'
  ) => {
    handleMergeBulkWatchlist(keywords, tmNumbers, mode === 'replace' ? 'replace' : 'merge');
    setWizardOpen(false);
  };

  const handleApplyCaseEntries = (
    entries: CaseEntry[],
    mode: 'append' | 'replace',
    sheetConfig: CaseSheetConfig,
    refreshReview: boolean
  ) => {
    let nextEntries: CaseEntry[];
    let msg = '';

    if (mode === 'replace') {
      nextEntries = entries;
      msg = `Case Map replaced: ${nextEntries.length} records indexed.`;
    } else {
      const res = mergeDatabaseEntries(config.caseEntries, entries, 'update');
      nextEntries = res.merged;
      msg = `Case Map merged: ${res.added} added, ${res.updated} updated.`;
    }

    onUpdateConfig({
      ...config,
      caseEntries: nextEntries,
      caseSheetConfig: sheetConfig,
    });
    if (refreshReview) {
      onRefreshReviewCases(nextEntries);
    }
    setWizardOpen(false);
    setCasePage(1);
    onNotify(msg);
  };

  const filteredKeywords = useMemo(() => {
    const q = kwSearch.trim().toLowerCase();
    const list = q
      ? config.keywords.filter((k) => k.toLowerCase().includes(q))
      : [...config.keywords];
    if (kwSort === 'asc') list.sort((a, b) => a.localeCompare(b));
    else if (kwSort === 'desc') list.sort((a, b) => b.localeCompare(a));
    return list;
  }, [config.keywords, kwSearch, kwSort]);

  const filteredTms = useMemo(() => {
    const q = tmSearch.trim();
    const list = q ? config.tmNumbers.filter((tm) => tm.includes(q)) : [...config.tmNumbers];
    if (tmSort === 'asc') list.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    else if (tmSort === 'desc')
      list.sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
    return list;
  }, [config.tmNumbers, tmSearch, tmSort]);

  const filteredCases = useMemo(() => {
    const q = caseSearch.trim().toLowerCase();
    const list = q
      ? config.caseEntries.filter(
          (c) =>
            c.tmNumber.toLowerCase().includes(q) ||
            c.caseNo.toLowerCase().includes(q) ||
            (c.applicationName || '').toLowerCase().includes(q) ||
            c.clientName.toLowerCase().includes(q)
        )
      : [...config.caseEntries];
    if (caseSort === 'asc')
      list.sort((a, b) => a.tmNumber.localeCompare(b.tmNumber, undefined, { numeric: true }));
    else if (caseSort === 'desc')
      list.sort((a, b) => b.tmNumber.localeCompare(a.tmNumber, undefined, { numeric: true }));
    return list;
  }, [config.caseEntries, caseSearch, caseSort]);

  const kwTotalPages = Math.max(1, Math.ceil(filteredKeywords.length / safePageSize));
  const safeKwPage = Math.min(kwPage, kwTotalPages);
  const kwSlice = filteredKeywords.slice(
    (safeKwPage - 1) * safePageSize,
    safeKwPage * safePageSize
  );

  const tmTotalPages = Math.max(1, Math.ceil(filteredTms.length / safePageSize));
  const safeTmPage = Math.min(tmPage, tmTotalPages);
  const tmSlice = filteredTms.slice((safeTmPage - 1) * safePageSize, safeTmPage * safePageSize);

  const caseTotalPages = Math.max(1, Math.ceil(filteredCases.length / safePageSize));
  const safeCasePage = Math.min(casePage, caseTotalPages);
  const caseSlice = filteredCases.slice(
    (safeCasePage - 1) * safePageSize,
    safeCasePage * safePageSize
  );

  const totalWatchlistItems = config.keywords.length + config.tmNumbers.length;
  const recentTms = config.tmNumbers.slice(0, 8);
  const sheetCfg = config.caseSheetConfig;

  const statCards = [
    {
      label: 'TM Matches',
      value: `${stats.tmMatches} matched`,
      sub: `${config.tmNumbers.length} watched TMs`,
      icon: SearchCheck,
    },
    {
      label: 'Keyword Matches',
      value: `${stats.keywordMatches} matched`,
      sub: `${config.keywords.length} terms · ${config.keywordMatchMode}`,
      icon: FolderSearch,
    },
    {
      label: 'Review Decisions',
      value: `${stats.pending} / ${stats.issue} / ${stats.clear}`,
      sub: 'Pending / Issue / Clear',
      icon: ShieldAlert,
    },
    {
      label: 'Docs Ready',
      value: `${stats.docsGenerated} / ${stats.pdfsGenerated}`,
      sub: `Journal ${config.journalNo || '909'}`,
      icon: Printer,
    },
  ];

  const checklistItems = [
    `Journal ${config.journalNo || '909'} (${config.journalDate})`,
    `${journalRowCount} rows in JournalCheck`,
    `${config.keywords.length} keywords and ${config.tmNumbers.length} TMs armed`,
    `${stats.total} matches in Review (${stats.issue} Issue / Oppose)`,
    `${config.caseEntries.length} Database records indexed`,
  ];

  const renderCardPagination = (
    total: number,
    page: number,
    totalPg: number,
    onChangePage: (p: number) => void
  ) => (
    <div className="flex items-center justify-between pt-2 border-t border-[#eceef2] text-[11px] text-[#555a66] tabular-nums">
      <span>
        {total === 0
          ? '0 items'
          : `${(page - 1) * safePageSize + 1}–${Math.min(total, page * safePageSize)} of ${total}`}
      </span>
      <div className="inline-flex items-center border border-[#cbd0da] bg-white">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onChangePage(Math.max(1, page - 1))}
          className="h-[24px] px-2 font-bold text-[#111111] hover:bg-[#ffee00] disabled:opacity-40 inline-flex items-center border-r border-[#cbd0da]"
        >
          <ChevronLeft className="w-3 h-3" aria-hidden="true" />
          <span>Back</span>
        </button>
        <span className="px-2 font-mono font-bold text-[#111111]">
          {page}/{totalPg}
        </span>
        <button
          type="button"
          disabled={page >= totalPg}
          onClick={() => onChangePage(Math.min(totalPg, page + 1))}
          className="h-[24px] px-2 font-bold text-[#111111] hover:bg-[#ffee00] disabled:opacity-40 inline-flex items-center border-l border-[#cbd0da]"
        >
          <span>Next</span>
          <ChevronRight className="w-3 h-3" aria-hidden="true" />
        </button>
      </div>
    </div>
  );

  const cycleSort = (curr: 'default' | 'asc' | 'desc') =>
    curr === 'default' ? 'asc' : curr === 'asc' ? 'desc' : 'default';

  return (
    <div className="space-y-8">
      {/* Watchlist Status Badge with Brandex Circular Seal (Logo 06) */}
      <section aria-label="Watchlist active status">
        <div className="bg-white border border-[#111111] p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <BrandexLogo
              variant="logo06"
              size="lg"
              primaryColor={logoPrimary}
              accentColor={logoAccent}
              className="shrink-0"
            />
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-[#111111] text-[#ffee00] text-[11px] font-extrabold uppercase tracking-wider">
                  Watchlist Armed
                </span>
                <span className="text-sm font-extrabold text-[#111111] tabular-nums">
                  {totalWatchlistItems.toLocaleString()} Criteria
                </span>
                <span className="text-xs font-semibold text-[#555a66] tabular-nums">
                  ({config.keywords.length} Keywords · {config.tmNumbers.length} TMs)
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-[#555a66]">
                <span className="font-bold text-[#111111]">Recent TMs:</span>
                {recentTms.length > 0 ? (
                  recentTms.map((tm) => (
                    <span
                      key={tm}
                      className="px-1.5 py-0.5 bg-[#f6f7f9] border border-[#d4d7e0] font-mono font-bold text-[11px] text-[#111111] tabular-nums"
                    >
                      {tm}
                    </span>
                  ))
                ) : (
                  <span>None</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setBulkModalOpen(true)}
              className="builty-btn h-[38px] pl-4 pr-3 gap-2 text-xs whitespace-nowrap"
            >
              <Layers className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Bulk Update</span>
            </button>
            <button
              type="button"
              onClick={() => onGoToTab('settings')}
              className="h-[38px] px-3.5 border border-[#cbd0da] bg-[#f8f9fb] hover:border-[#111111] hover:bg-white text-xs font-bold text-[#111111] inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <Settings2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Settings</span>
            </button>
          </div>
        </div>
      </section>

      {/* 2x2 Stat Cards */}
      <section aria-label="Summary cards">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {statCards.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.label}
                className="bg-white border border-[#e2e4ea] flex items-stretch justify-between min-h-[108px]"
              >
                <div className="p-5 flex flex-col justify-center min-w-0">
                  <h2 className="text-[14px] font-bold text-[#111111]">{card.label}</h2>
                  <p className="mt-1 text-xl font-extrabold text-[#111111] tabular-nums">
                    {card.value}
                  </p>
                  <p className="mt-0.5 text-xs text-[#555a66] truncate">{card.sub}</p>
                </div>
                <div className="w-[96px] sm:w-[112px] bg-[#ffee00] text-[#111111] flex items-center justify-center shrink-0">
                  <Icon className="w-9 h-9 stroke-[1.75]" aria-hidden="true" />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Pipeline & Config */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-6 bg-white border border-[#e2e4ea] p-6 flex flex-col justify-between gap-5">
          <div className="space-y-4">
            <h2 className="text-xl font-extrabold tracking-tight text-[#111111]">
              Active Pipeline
            </h2>
            <ul className="space-y-3">
              {checklistItems.map((line) => (
                <li key={line} className="flex items-start gap-3 text-sm text-[#374151]">
                  <span className="inline-flex items-center justify-center w-5 h-5 bg-[#ffee00] text-[#111111] shrink-0 mt-0.5">
                    <Check className="w-3.5 h-3.5 stroke-[2.5]" aria-hidden="true" />
                  </span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="pt-4 border-t border-[#eceef2] flex flex-wrap gap-2.5">
            <button
              type="button"
              onClick={onRunScan}
              className="builty-btn h-[40px] pl-4 pr-2 gap-2.5 text-xs whitespace-nowrap"
            >
              <span>Run Scan</span>
              <span className="builty-btn-icon-tab w-7 h-7">
                <Play className="w-3 h-3 fill-current" aria-hidden="true" />
              </span>
            </button>
            <button
              type="button"
              onClick={() => onGoToTab('journalcheck')}
              className="h-[40px] px-4 border border-[#cbd0da] bg-[#f8f9fb] text-xs font-bold text-[#111111] hover:border-[#111111] hover:bg-white whitespace-nowrap"
            >
              JournalCheck
            </button>
            <button
              type="button"
              onClick={() => onGoToTab('review')}
              className="h-[40px] px-4 border border-[#cbd0da] bg-[#f8f9fb] text-xs font-bold text-[#111111] hover:border-[#111111] hover:bg-white whitespace-nowrap"
            >
              Review Queue
            </button>
          </div>
        </div>

        <div className="lg:col-span-6 bg-white border border-[#e2e4ea] p-6 flex flex-col justify-between gap-5">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2 border-b border-[#eceef2] pb-3">
              <h2 className="text-lg font-extrabold tracking-tight text-[#111111]">
                Journal Edition &amp; Config
              </h2>
              <span className="text-xs font-mono font-bold text-[#111111] bg-[#fffef0] border border-[#111111] px-2 py-0.5">
                {config.keywordMatchMode.toUpperCase()}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="bg-[#f8f9fb] border border-[#e2e4ea] p-3.5 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[#555a66] font-semibold inline-flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-[#111111]" aria-hidden="true" />
                    <span>Journal Edition</span>
                  </span>
                  <button
                    type="button"
                    data-sfx="filter"
                    onClick={() => {
                      const currNum = parseInt(config.journalNo, 10);
                      const nextNo = Number.isNaN(currNum) ? '910' : String(currNum + 1);
                      onUpdateConfig({ ...config, journalNo: nextNo });
                      onNotify(`Switched active Journal to ${nextNo}.`);
                    }}
                    className="px-2 py-0.5 bg-[#ffee00] hover:bg-[#e6d600] text-[#111111] text-[10.5px] font-extrabold"
                  >
                    + Next
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label htmlFor="dash-journal-no" className="block text-[10.5px] font-bold text-[#555a66] mb-0.5">
                      Journal No
                    </label>
                    <input
                      id="dash-journal-no"
                      type="text"
                      value={config.journalNo}
                      onChange={(e) => onUpdateConfig({ ...config, journalNo: e.target.value })}
                      className="w-full bg-white border border-[#cbd0da] px-2 py-1 text-xs font-mono font-extrabold text-[#111111]"
                    />
                  </div>
                  <div>
                    <label htmlFor="dash-journal-date" className="block text-[10.5px] font-bold text-[#555a66] mb-0.5">
                      Date
                    </label>
                    <input
                      id="dash-journal-date"
                      type="text"
                      value={config.journalDate}
                      onChange={(e) => onUpdateConfig({ ...config, journalDate: e.target.value })}
                      className="w-full bg-white border border-[#cbd0da] px-2 py-1 text-xs font-mono text-[#111111]"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-[#555a66] font-mono">
                  <span>
                    Serial: {config.serialPrefix}
                    {String(1).padStart(config.serialPad || 3, '0')}
                  </span>
                  {allTimeStats && (
                    <span>{Object.keys(allTimeStats.byJournal).length} Editions</span>
                  )}
                </div>
              </div>

              <div className="bg-[#f8f9fb] border border-[#e2e4ea] p-3.5 space-y-1">
                <div className="text-[#555a66] font-semibold">Case Lookup</div>
                <div className="font-extrabold text-[#111111] text-sm tabular-nums">
                  Col {sheetCfg?.keyCol || 8} · {config.caseEntries.length} rows
                </div>
                <div className="text-[#555a66]">
                  Cols {sheetCfg?.prefixCol || 3}-{sheetCfg?.clientCodeCol || 4}-
                  {sheetCfg?.caseCol || 5}
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-[#eceef2] flex flex-wrap gap-2.5">
            <button
              type="button"
              onClick={() => onGoToTab('database')}
              className="h-[40px] px-4 border border-[#111111] bg-white hover:bg-[#fffef0] text-xs font-bold text-[#111111] inline-flex items-center gap-2 whitespace-nowrap"
            >
              <Database className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Database ({config.caseEntries.length})</span>
            </button>
            <button
              type="button"
              onClick={() => onGoToTab('settings')}
              className="h-[40px] px-4 border border-[#cbd0da] bg-[#f8f9fb] hover:border-[#111111] hover:bg-white text-xs font-bold text-[#111111] inline-flex items-center gap-2 whitespace-nowrap"
            >
              <Settings2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Settings</span>
            </button>
          </div>
        </div>
      </section>

      {/* Watchlist & Case Lists (with Sort/Filter, Edit Mode, Delete All, 50-row Back/Next) */}
      <section className="space-y-4">
        <div className="bg-white border border-[#e2e4ea] p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-lg font-extrabold tracking-tight text-[#111111]">Watchlist</h2>
            <span className="text-xs font-bold text-[#555a66] tabular-nums">
              {config.keywords.length} KW · {config.tmNumbers.length} TMs · {config.caseEntries.length} Cases
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => setBulkModalOpen(true)}
              className="builty-btn h-[38px] pl-4 pr-3 gap-2 text-xs whitespace-nowrap"
            >
              <Layers className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Bulk Update</span>
            </button>
            <button
              type="button"
              onClick={() => openWizard('watchlist')}
              className="h-[38px] px-4 border border-[#cbd0da] bg-[#f8f9fb] hover:border-[#111111] hover:bg-white text-xs font-bold text-[#111111] inline-flex items-center gap-2 whitespace-nowrap"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Import Watchlist</span>
            </button>
            <button
              type="button"
              onClick={() => openWizard('casemap')}
              className="h-[38px] px-4 border border-[#111111] bg-white hover:bg-[#f6f7f9] text-xs font-bold text-[#111111] inline-flex items-center gap-2 whitespace-nowrap"
            >
              <Database className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Sync Case Map</span>
            </button>
          </div>
        </div>

        {bulkModalOpen && (
          <WatchlistBulkModal
            existingKeywords={config.keywords}
            existingTmNumbers={config.tmNumbers}
            onMergeWatchlist={handleMergeBulkWatchlist}
            onClose={() => setBulkModalOpen(false)}
          />
        )}

        {wizardOpen && (
          <WatchlistImportWizard
            initialTab={wizardTab}
            config={config}
            pageSize={safePageSize}
            onApplyWatchlist={handleApplyWatchlistImport}
            onApplyCaseEntries={handleApplyCaseEntries}
            onClose={() => setWizardOpen(false)}
          />
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Card 1: Keywords */}
          <div className="bg-white border border-[#e2e4ea] p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-[#eceef2] pb-3">
              <h3 className="text-base font-extrabold text-[#111111]">Keywords</h3>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  data-sfx="filter"
                  onClick={() => setKwSort((s) => cycleSort(s))}
                  title="Sort Keywords"
                  className={`px-2 py-0.5 border text-[10.5px] font-bold inline-flex items-center gap-1 ${
                    kwSort !== 'default'
                      ? 'bg-[#ffee00] border-[#111111] text-[#111111]'
                      : 'bg-[#f8f9fb] border-[#cbd0da] text-[#555a66]'
                  }`}
                >
                  <ArrowDownUp className="w-3 h-3" aria-hidden="true" />
                  <span>{kwSort === 'default' ? 'Sort' : kwSort.toUpperCase()}</span>
                </button>
                <button
                  type="button"
                  data-sfx="filter"
                  onClick={() => setKwEditMode((m) => !m)}
                  title="Toggle Edit Mode"
                  className={`px-2 py-0.5 border text-[10.5px] font-bold inline-flex items-center gap-1 ${
                    kwEditMode
                      ? 'bg-[#111111] border-[#111111] text-[#ffee00]'
                      : 'bg-[#f8f9fb] border-[#cbd0da] text-[#555a66]'
                  }`}
                >
                  <Edit3 className="w-3 h-3" aria-hidden="true" />
                  <span>Edit</span>
                </button>
                <button
                  type="button"
                  disabled={config.keywords.length === 0}
                  onClick={() => setDeleteConfirm('keywords')}
                  title="Delete All Keywords"
                  className="px-2 py-0.5 border border-red-300 bg-red-50 text-red-700 hover:bg-red-600 hover:text-white text-[10.5px] font-bold disabled:opacity-40"
                >
                  Del All
                </button>
                <span className="text-xs text-[#111111] bg-[#ffee00] px-2 py-0.5 font-extrabold tabular-nums">
                  {config.keywords.length}
                </span>
              </div>
            </div>

            <form onSubmit={handleAddKeyword} className="flex gap-2">
              <input
                type="text"
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                placeholder="Add keyword…"
                aria-label="Add watchlist keyword"
                className="flex-1 min-w-0 bg-[#f8f9fb] border border-[#cbd0da] px-3 py-2 text-xs text-[#111111] focus:bg-white focus:outline-none focus:border-[#111111]"
              />
              <button
                type="submit"
                className="px-3 py-2 bg-[#ffee00] text-[#111111] text-xs font-bold hover:bg-[#f2e000] inline-flex items-center gap-1 shrink-0"
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Add</span>
              </button>
            </form>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#6b7280] absolute left-2.5 top-1/2 -translate-y-1/2" aria-hidden="true" />
              <input
                type="text"
                value={kwSearch}
                onChange={(e) => {
                  setKwSearch(e.target.value);
                  setKwPage(1);
                }}
                placeholder="Filter keywords…"
                aria-label="Filter watchlist keywords"
                className="w-full bg-[#f8f9fb] border border-[#e2e4ea] pl-8 pr-2.5 py-1.5 text-xs text-[#111111]"
              />
            </div>

            <ul className="divide-y divide-[#eceef2] max-h-[260px] overflow-y-auto flex-1">
              {kwSlice.map((kw, idx) => (
                <li key={`${kw}_${idx}`} className="py-1.5 flex items-center justify-between gap-2 text-xs text-[#111111]">
                  {kwEditMode ? (
                    <input
                      type="text"
                      defaultValue={kw}
                      onBlur={(e) => handleRenameKeyword(kw, e.target.value)}
                      className="flex-1 min-w-0 bg-[#fffef0] border border-[#cbd0da] px-1.5 py-0.5 font-mono text-xs"
                    />
                  ) : (
                    <span
                      contentEditable
                      suppressContentEditableWarning
                      onBlur={(e) => handleRenameKeyword(kw, e.currentTarget.innerText)}
                      className="font-mono font-medium truncate outline-none focus:bg-[#fffef0] focus:px-1"
                      title={kw}
                    >
                      {kw}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => handleRemoveKeyword(kw)}
                    aria-label={`Remove keyword ${kw}`}
                    className="p-1 text-[#6b7280] hover:text-red-600 shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
              {kwSlice.length === 0 && (
                <li className="py-4 text-center text-xs text-[#555a66]">No keywords.</li>
              )}
            </ul>
            {renderCardPagination(filteredKeywords.length, safeKwPage, kwTotalPages, setKwPage)}
          </div>

          {/* Card 2: TM Numbers */}
          <div className="bg-white border border-[#e2e4ea] p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-[#eceef2] pb-3">
              <h3 className="text-base font-extrabold text-[#111111]">TM Numbers</h3>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  data-sfx="filter"
                  onClick={() => setTmSort((s) => cycleSort(s))}
                  title="Sort TMs"
                  className={`px-2 py-0.5 border text-[10.5px] font-bold inline-flex items-center gap-1 ${
                    tmSort !== 'default'
                      ? 'bg-[#ffee00] border-[#111111] text-[#111111]'
                      : 'bg-[#f8f9fb] border-[#cbd0da] text-[#555a66]'
                  }`}
                >
                  <ArrowDownUp className="w-3 h-3" aria-hidden="true" />
                  <span>{tmSort === 'default' ? 'Sort' : tmSort.toUpperCase()}</span>
                </button>
                <button
                  type="button"
                  data-sfx="filter"
                  onClick={() => setTmEditMode((m) => !m)}
                  title="Toggle Edit Mode"
                  className={`px-2 py-0.5 border text-[10.5px] font-bold inline-flex items-center gap-1 ${
                    tmEditMode
                      ? 'bg-[#111111] border-[#111111] text-[#ffee00]'
                      : 'bg-[#f8f9fb] border-[#cbd0da] text-[#555a66]'
                  }`}
                >
                  <Edit3 className="w-3 h-3" aria-hidden="true" />
                  <span>Edit</span>
                </button>
                <button
                  type="button"
                  disabled={config.tmNumbers.length === 0}
                  onClick={() => setDeleteConfirm('tms')}
                  title="Delete All TMs"
                  className="px-2 py-0.5 border border-red-300 bg-red-50 text-red-700 hover:bg-red-600 hover:text-white text-[10.5px] font-bold disabled:opacity-40"
                >
                  Del All
                </button>
                <span className="text-xs text-[#111111] bg-[#ffee00] px-2 py-0.5 font-extrabold tabular-nums">
                  {config.tmNumbers.length}
                </span>
              </div>
            </div>

            <form onSubmit={handleAddTm} className="space-y-1.5">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newTm}
                  onChange={(e) => setNewTm(e.target.value)}
                  placeholder="6-digit TM No…"
                  aria-label="Add 6-digit TM number"
                  className="flex-1 min-w-0 bg-[#f8f9fb] border border-[#cbd0da] px-3 py-2 text-xs text-[#111111] font-mono focus:bg-white focus:outline-none focus:border-[#111111]"
                />
                <button
                  type="submit"
                  className="px-3 py-2 bg-[#ffee00] text-[#111111] text-xs font-bold hover:bg-[#f2e000] inline-flex items-center gap-1 shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Add</span>
                </button>
              </div>
              {tmError && <p className="text-[11px] font-semibold text-red-600">{tmError}</p>}
            </form>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#6b7280] absolute left-2.5 top-1/2 -translate-y-1/2" aria-hidden="true" />
              <input
                type="text"
                value={tmSearch}
                onChange={(e) => {
                  setTmSearch(e.target.value);
                  setTmPage(1);
                }}
                placeholder="Filter TM numbers…"
                aria-label="Filter 6-digit TM numbers"
                className="w-full bg-[#f8f9fb] border border-[#e2e4ea] pl-8 pr-2.5 py-1.5 text-xs font-mono text-[#111111]"
              />
            </div>

            <ul className="divide-y divide-[#eceef2] max-h-[260px] overflow-y-auto flex-1">
              {tmSlice.map((tm, idx) => (
                <li key={`${tm}_${idx}`} className="py-1.5 flex items-center justify-between gap-2 text-xs text-[#111111]">
                  {tmEditMode ? (
                    <input
                      type="text"
                      defaultValue={tm}
                      onBlur={(e) => handleRenameTm(tm, e.target.value)}
                      className="flex-1 min-w-0 bg-[#fffef0] border border-[#cbd0da] px-1.5 py-0.5 font-mono text-xs tabular-nums"
                    />
                  ) : (
                    <span
                      contentEditable
                      suppressContentEditableWarning
                      onBlur={(e) => handleRenameTm(tm, e.currentTarget.innerText)}
                      className="font-mono font-medium tabular-nums outline-none focus:bg-[#fffef0] focus:px-1"
                    >
                      {tm}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => handleRemoveTm(tm)}
                    aria-label={`Remove TM ${tm}`}
                    className="p-1 text-[#6b7280] hover:text-red-600 shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
              {tmSlice.length === 0 && (
                <li className="py-4 text-center text-xs text-[#555a66]">No TM numbers.</li>
              )}
            </ul>
            {renderCardPagination(filteredTms.length, safeTmPage, tmTotalPages, setTmPage)}
          </div>

          {/* Card 3: Case Lookup Map */}
          <div className="bg-white border border-[#e2e4ea] p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-[#eceef2] pb-3">
              <h3 className="text-base font-extrabold text-[#111111]">Case Map</h3>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  data-sfx="filter"
                  onClick={() => setCaseSort((s) => cycleSort(s))}
                  title="Sort Case Map"
                  className={`px-2 py-0.5 border text-[10.5px] font-bold inline-flex items-center gap-1 ${
                    caseSort !== 'default'
                      ? 'bg-[#ffee00] border-[#111111] text-[#111111]'
                      : 'bg-[#f8f9fb] border-[#cbd0da] text-[#555a66]'
                  }`}
                >
                  <ArrowDownUp className="w-3 h-3" aria-hidden="true" />
                  <span>{caseSort === 'default' ? 'Sort' : caseSort.toUpperCase()}</span>
                </button>
                <button
                  type="button"
                  data-sfx="filter"
                  onClick={() => setCaseEditMode((m) => !m)}
                  title="Toggle Edit Mode"
                  className={`px-2 py-0.5 border text-[10.5px] font-bold inline-flex items-center gap-1 ${
                    caseEditMode
                      ? 'bg-[#111111] border-[#111111] text-[#ffee00]'
                      : 'bg-[#f8f9fb] border-[#cbd0da] text-[#555a66]'
                  }`}
                >
                  <Edit3 className="w-3 h-3" aria-hidden="true" />
                  <span>Edit</span>
                </button>
                <button
                  type="button"
                  disabled={config.caseEntries.length === 0}
                  onClick={() => setDeleteConfirm('cases')}
                  title="Delete All Case Entries"
                  className="px-2 py-0.5 border border-red-300 bg-red-50 text-red-700 hover:bg-red-600 hover:text-white text-[10.5px] font-bold disabled:opacity-40"
                >
                  Del All
                </button>
                <button
                  type="button"
                  data-sfx="filter"
                  onClick={() => onGoToTab('database')}
                  className="builty-filter-btn text-xs text-[#111111] bg-[#ffee00] px-2 py-0.5 font-extrabold tabular-nums hover:bg-[#f2e000]"
                >
                  {config.caseEntries.length}
                </button>
              </div>
            </div>

            <form onSubmit={handleAddCaseEntry} className="space-y-1.5">
              <div className="grid grid-cols-3 gap-1.5">
                <input
                  type="text"
                  value={caseTm}
                  onChange={(e) => setCaseTm(e.target.value)}
                  placeholder="TM No"
                  aria-label="Case TM Number"
                  className="bg-[#f8f9fb] border border-[#cbd0da] px-2 py-2 text-xs text-[#111111] font-mono"
                />
                <input
                  type="text"
                  value={caseNo}
                  onChange={(e) => setCaseNo(e.target.value)}
                  placeholder="Case No"
                  aria-label="Case Number"
                  className="bg-[#f8f9fb] border border-[#cbd0da] px-2 py-2 text-xs text-[#111111]"
                />
                <div className="flex gap-1">
                  <input
                    type="text"
                    value={caseClient}
                    onChange={(e) => setCaseClient(e.target.value)}
                    placeholder="Client"
                    aria-label="Client Name"
                    className="flex-1 min-w-0 bg-[#f8f9fb] border border-[#cbd0da] px-2 py-2 text-xs text-[#111111]"
                  />
                  <button
                    type="submit"
                    aria-label="Add case mapping"
                    className="px-2.5 bg-[#ffee00] text-[#111111] text-xs font-bold hover:bg-[#f2e000]"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              {caseError && <p className="text-[11px] font-semibold text-red-600">{caseError}</p>}
            </form>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#6b7280] absolute left-2.5 top-1/2 -translate-y-1/2" aria-hidden="true" />
              <input
                type="text"
                value={caseSearch}
                onChange={(e) => {
                  setCaseSearch(e.target.value);
                  setCasePage(1);
                }}
                placeholder="Filter TM, Case No, or Client…"
                aria-label="Filter case lookup map"
                className="w-full bg-[#f8f9fb] border border-[#e2e4ea] pl-8 pr-2.5 py-1.5 text-xs text-[#111111]"
              />
            </div>

            <ul className="divide-y divide-[#eceef2] max-h-[260px] overflow-y-auto flex-1">
              {caseSlice.map((c, idx) => {
                const entryKey = getCaseEntryKey(c, (safeCasePage - 1) * safePageSize + idx);
                return (
                  <li
                    key={`${entryKey}_${idx}`}
                    className="py-1.5 flex items-center justify-between gap-2 text-xs"
                  >
                    {caseEditMode ? (
                      <div className="flex-1 grid grid-cols-3 gap-1">
                        <input
                          type="text"
                          value={c.tmNumber}
                          onChange={(e) => handleUpdateCaseEntry(entryKey, { tmNumber: e.target.value })}
                          className="bg-[#fffef0] border border-[#cbd0da] px-1 py-0.5 font-mono text-[11px]"
                        />
                        <input
                          type="text"
                          value={c.caseNo}
                          onChange={(e) => handleUpdateCaseEntry(entryKey, { caseNo: e.target.value })}
                          className="bg-[#fffef0] border border-[#cbd0da] px-1 py-0.5 text-[11px]"
                        />
                        <input
                          type="text"
                          value={c.clientName}
                          onChange={(e) => handleUpdateCaseEntry(entryKey, { clientName: e.target.value })}
                          className="bg-[#fffef0] border border-[#cbd0da] px-1 py-0.5 text-[11px]"
                        />
                      </div>
                    ) : (
                      <div
                        className="min-w-0 truncate"
                        title={`${c.tmNumber} · ${c.caseNo} — ${c.applicationName || c.clientName}`}
                      >
                        <span
                          contentEditable
                          suppressContentEditableWarning
                          onBlur={(e) =>
                            handleUpdateCaseEntry(entryKey, {
                              tmNumber: e.currentTarget.innerText.trim(),
                            })
                          }
                          className="font-mono font-bold text-[#111111] tabular-nums outline-none focus:bg-[#fffef0]"
                        >
                          {c.tmNumber || '—'}
                        </span>
                        <span className="text-[#9ca3af]"> · </span>
                        <span
                          contentEditable
                          suppressContentEditableWarning
                          onBlur={(e) =>
                            handleUpdateCaseEntry(entryKey, {
                              caseNo: e.currentTarget.innerText.trim(),
                            })
                          }
                          className="text-[#111111] font-semibold outline-none focus:bg-[#fffef0]"
                        >
                          {c.caseNo}
                        </span>
                        {(c.applicationName || c.clientName) && (
                          <span className="text-[#555a66]"> — {c.applicationName || c.clientName}</span>
                        )}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateConfig({
                          ...config,
                          caseEntries: config.caseEntries.filter(
                            (item, itemIdx) => getCaseEntryKey(item, itemIdx) !== entryKey
                          ),
                        })
                      }
                      aria-label={`Remove ${c.tmNumber || c.caseNo}`}
                      className="p-1 text-[#6b7280] hover:text-red-600 shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </li>
                );
              })}
              {caseSlice.length === 0 && (
                <li className="py-4 text-center text-xs text-[#555a66]">No case entries.</li>
              )}
            </ul>
            {renderCardPagination(filteredCases.length, safeCasePage, caseTotalPages, setCasePage)}
          </div>
        </div>
      </section>

      <DeleteAllConfirmModal
        open={deleteConfirm !== null}
        title={
          deleteConfirm === 'keywords'
            ? 'Delete All Keywords?'
            : deleteConfirm === 'tms'
            ? 'Delete All TM Numbers?'
            : 'Delete All Case Entries?'
        }
        message={
          deleteConfirm === 'keywords'
            ? `Remove all ${config.keywords.length} watchlist keyword(s)?`
            : deleteConfirm === 'tms'
            ? `Remove all ${config.tmNumbers.length} watchlist TM number(s)?`
            : `Remove all ${config.caseEntries.length} Case Map record(s)?`
        }
        onConfirm={() => {
          if (deleteConfirm === 'keywords') {
            onUpdateConfig({ ...config, keywords: [] });
            onNotify('Deleted all keywords.');
          } else if (deleteConfirm === 'tms') {
            onUpdateConfig({ ...config, tmNumbers: [] });
            onNotify('Deleted all TM numbers.');
          } else if (deleteConfirm === 'cases') {
            onUpdateConfig({ ...config, caseEntries: [] });
            onNotify('Deleted all Case Map records.');
          }
          setDeleteConfirm(null);
        }}
        onCancel={() => setDeleteConfirm(null)}
      />
    </div>
  );
}
