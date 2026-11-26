import { useMemo, useState } from 'react';
import {
  Calendar,
  Check,
  Database,
  FileSpreadsheet,
  FileText,
  FolderSearch,
  Layers,
  Play,
  Plus,
  Printer,
  Search,
  SearchCheck,
  Settings2,
  ShieldAlert,
  ShieldCheck,
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
  mergeDatabaseEntries,
  mergeUniqueKeywords,
  mergeUniqueTmNumbers,
} from '../lib/journal/engine';
import { WatchlistImportWizard, WatchlistWizardTab } from './WatchlistImportWizard';
import { WatchlistBulkModal } from './WatchlistBulkModal';

interface AnalyzerViewProps {
  config: JournalConfig;
  stats: JournalStats;
  allTimeStats?: JournalStats;
  journalRowCount: number;
  onUpdateConfig: (next: JournalConfig) => void;
  onRunScan: () => void;
  onGoToTab: (tab: AppTab) => void;
  onRefreshReviewCases: (entries: CaseEntry[]) => void;
  onNotify: (message: string) => void;
}

const MAX_VISIBLE_LIST = 100;

export function AnalyzerView({
  config,
  stats,
  allTimeStats,
  journalRowCount,
  onUpdateConfig,
  onRunScan,
  onGoToTab,
  onRefreshReviewCases,
  onNotify,
}: AnalyzerViewProps) {
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
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardTab, setWizardTab] = useState<WatchlistWizardTab>('watchlist');
  const [bulkModalOpen, setBulkModalOpen] = useState(false);

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
    if (skippedDuplicates > 0) {
      onNotify(
        `Keywords updated: ${added} added, ${skippedDuplicates} duplicate(s) skipped.`
      );
    }
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
      setTmError(`Duplicate protected: all entered TM number(s) already exist in Watchlist.`);
      onNotify(`Duplicate protected: ${dupCheck.duplicates.length} TM number(s) already watched.`);
      return;
    }

    const { merged, added, skippedDuplicates } = mergeUniqueTmNumbers(
      config.tmNumbers,
      dupCheck.unique,
      true
    );
    onUpdateConfig({
      ...config,
      tmNumbers: merged,
    });
    setNewTm('');
    const totalSkipped = dupCheck.duplicates.length + skippedDuplicates;
    if (totalSkipped > 0) {
      onNotify(
        `TM Numbers updated: ${added} added, ${totalSkipped} duplicate(s) skipped.`
      );
    }
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
      setCaseError(`Duplicate protected: TM ${tm} already maps to ${dup?.caseNo || 'existing'}.`);
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
        `Watchlist replaced: ${nextKwRes.merged.length} keywords and ${nextTmRes.merged.length} 6-digit TMs.`
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
      `Watchlist merged: +${kwRes.added} keywords, +${tmRes.added} 6-digit TMs${
        totalSkipped > 0 ? ` (${totalSkipped} duplicate(s) skipped)` : ''
      }.`
    );
  };

  const handleApplyWatchlistImport = (
    keywords: string[],
    tmNumbers: string[],
    mode: 'append' | 'replace'
  ) => {
    handleMergeBulkWatchlist(
      keywords,
      tmNumbers,
      mode === 'replace' ? 'replace' : 'merge'
    );
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
      msg = `Case Lookup Map replaced: ${nextEntries.length} unique records indexed.`;
    } else {
      const res = mergeDatabaseEntries(config.caseEntries, entries, 'skip');
      nextEntries = res.merged;
      msg = `Case Lookup Map merged: ${res.added} added${
        res.skippedDuplicates > 0 ? `, ${res.skippedDuplicates} duplicate(s) skipped` : ''
      }.`;
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
    onNotify(msg);
  };

  const filteredKeywords = useMemo(() => {
    const q = kwSearch.trim().toLowerCase();
    if (!q) return config.keywords;
    return config.keywords.filter((k) => k.toLowerCase().includes(q));
  }, [config.keywords, kwSearch]);

  const filteredTms = useMemo(() => {
    const q = tmSearch.trim();
    if (!q) return config.tmNumbers;
    return config.tmNumbers.filter((tm) => tm.includes(q));
  }, [config.tmNumbers, tmSearch]);

  const filteredCases = useMemo(() => {
    const q = caseSearch.trim().toLowerCase();
    if (!q) return config.caseEntries;
    return config.caseEntries.filter(
      (c) =>
        c.tmNumber.toLowerCase().includes(q) ||
        c.caseNo.toLowerCase().includes(q) ||
        (c.applicationName || '').toLowerCase().includes(q) ||
        c.clientName.toLowerCase().includes(q)
    );
  }, [config.caseEntries, caseSearch]);

  const totalWatchlistItems = config.keywords.length + config.tmNumbers.length;
  const recentTms = config.tmNumbers.slice(0, 8);
  const sheetCfg = config.caseSheetConfig;

  const statCards = [
    {
      label: 'TM Number Matches',
      value: `${stats.tmMatches} matched`,
      sub: `${config.tmNumbers.length} watched 6-digit TMs`,
      icon: SearchCheck,
    },
    {
      label: 'Keyword Matches',
      value: `${stats.keywordMatches} matched`,
      sub: `${config.keywords.length} terms · ${config.keywordMatchMode} mode`,
      icon: FolderSearch,
    },
    {
      label: 'Review Decisions',
      value: `${stats.pending} / ${stats.issue} / ${stats.clear}`,
      sub: 'Pending / Issue-Oppose / Clear',
      icon: ShieldAlert,
    },
    {
      label: 'Docs & PDFs Ready',
      value: `${stats.docsGenerated} / ${stats.pdfsGenerated}`,
      sub: 'Journal 909 publication output',
      icon: Printer,
    },
  ];

  const checklistItems = [
    `Journal ${config.journalNo || '909'} (${config.journalDate}) metadata configured`,
    `${journalRowCount} rows loaded in JournalCheck input table`,
    `${config.keywords.length} keywords and ${config.tmNumbers.length} 6-digit TM numbers armed`,
    `${stats.total} matches queued in Review (${stats.issue} flagged Issue / Oppose)`,
    `${config.caseEntries.length} Database records indexed (Col ${sheetCfg?.keyCol || 8} match)`,
  ];

  return (
    <div className="space-y-8">
      {/* Watchlist Visual Status Badge */}
      <section aria-label="Watchlist active status">
        <div className="bg-white border border-[#111111] p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-11 h-11 bg-[#ffee00] text-[#111111] flex items-center justify-center shrink-0">
              <ShieldCheck className="w-6 h-6" aria-hidden="true" />
            </div>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-[#111111] text-[#ffee00] text-[11px] font-extrabold uppercase tracking-wider">
                  Watchlist Armed
                </span>
                <span className="text-sm font-extrabold text-[#111111] tabular-nums">
                  {totalWatchlistItems.toLocaleString()} Active Watchlist Criteria
                </span>
                <span className="text-xs font-semibold text-[#555a66] tabular-nums">
                  ({config.keywords.length} Keywords · {config.tmNumbers.length} 6-digit TM Numbers)
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-[#555a66]">
                <span className="font-bold text-[#111111]">Recently Added TMs:</span>
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
              <span>Bulk Paste Keywords / TMs</span>
            </button>
            <button
              type="button"
              onClick={() => onGoToTab('settings')}
              className="h-[38px] px-3.5 border border-[#cbd0da] bg-[#f8f9fb] hover:border-[#111111] hover:bg-white text-xs font-bold text-[#111111] inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <Settings2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Scanner Settings</span>
            </button>
          </div>
        </div>
      </section>

      {/* 2x2 Architectural Stat Cards */}
      <section aria-label="Protection summary">
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

      {/* Two-Column Split: Workflow Checklist + Database & Settings Summary */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-6 bg-white border border-[#e2e4ea] p-6 flex flex-col justify-between gap-5">
          <div className="space-y-4">
            <h2 className="text-xl font-extrabold tracking-tight text-[#111111]">
              What&apos;s Included in Pipeline
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
              <span>Run Scan Now</span>
              <span className="builty-btn-icon-tab w-7 h-7">
                <Play className="w-3 h-3 fill-current" aria-hidden="true" />
              </span>
            </button>
            <button
              type="button"
              onClick={() => onGoToTab('journalcheck')}
              className="h-[40px] px-4 border border-[#cbd0da] bg-[#f8f9fb] text-xs font-bold text-[#111111] hover:border-[#111111] hover:bg-white whitespace-nowrap"
            >
              Edit JournalCheck Data
            </button>
            <button
              type="button"
              onClick={() => onGoToTab('review')}
              className="h-[40px] px-4 border border-[#cbd0da] bg-[#f8f9fb] text-xs font-bold text-[#111111] hover:border-[#111111] hover:bg-white whitespace-nowrap"
            >
              Open Review Queue
            </button>
          </div>
        </div>

        <div className="lg:col-span-6 bg-white border border-[#e2e4ea] p-6 flex flex-col justify-between gap-5">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2 border-b border-[#eceef2] pb-3">
              <h2 className="text-lg font-extrabold tracking-tight text-[#111111]">
                Database Lookup &amp; Active Scanner Config
              </h2>
              <span className="text-xs font-mono font-bold text-[#111111] bg-[#fffef0] border border-[#111111] px-2 py-0.5">
                {config.keywordMatchMode.toUpperCase()} MODE
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="bg-[#f8f9fb] border border-[#e2e4ea] p-3.5 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[#555a66] font-semibold inline-flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-[#111111]" aria-hidden="true" />
                    <span>Monthly Journal Edition</span>
                  </span>
                  <button
                    type="button"
                    data-sfx="filter"
                    onClick={() => {
                      const currNum = parseInt(config.journalNo, 10);
                      const nextNo = Number.isNaN(currNum) ? '910' : String(currNum + 1);
                      onUpdateConfig({ ...config, journalNo: nextNo });
                      onNotify(
                        `Switched active target to Monthly Journal ${nextNo}. Previous Journal records stay archived under their Journal No.`
                      );
                    }}
                    className="px-2 py-0.5 bg-[#ffee00] hover:bg-[#e6d600] text-[#111111] text-[10.5px] font-extrabold"
                  >
                    + Next Month
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
                      className="w-full bg-white border border-[#cbd0da] px-2 py-1 text-xs font-mono font-extrabold text-[#111111] focus:border-[#111111] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label htmlFor="dash-journal-date" className="block text-[10.5px] font-bold text-[#555a66] mb-0.5">
                      Month / Date
                    </label>
                    <input
                      id="dash-journal-date"
                      type="text"
                      value={config.journalDate}
                      onChange={(e) => onUpdateConfig({ ...config, journalDate: e.target.value })}
                      className="w-full bg-white border border-[#cbd0da] px-2 py-1 text-xs font-mono text-[#111111] focus:border-[#111111] focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-[#555a66] font-mono">
                  <span>
                    Serial: {config.serialPrefix}
                    {String(1).padStart(config.serialPad || 3, '0')}
                  </span>
                  {allTimeStats && (
                    <span>
                      {Object.keys(allTimeStats.byJournal).length} Journal(s) archived
                    </span>
                  )}
                </div>
              </div>

              <div className="bg-[#f8f9fb] border border-[#e2e4ea] p-3.5 space-y-1">
                <div className="text-[#555a66] font-semibold">Database Matching Rule</div>
                <div className="font-extrabold text-[#111111] text-sm tabular-nums">
                  Col {sheetCfg?.keyCol || 8} (TM/CPR) · {config.caseEntries.length} rows
                </div>
                <div className="text-[#555a66]">
                  Case Cols {sheetCfg?.prefixCol || 3}-{sheetCfg?.clientCodeCol || 4}-
                  {sheetCfg?.caseCol || 5} → <span className="font-mono font-bold text-[#111111]">A-32-4</span>
                </div>
                <div className="text-[11px] text-[#555a66] pt-1">
                  Sorted by Recent Date · Full 24-Col Sheet
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
              <span>Open Database Tab ({config.caseEntries.length})</span>
            </button>
            <button
              type="button"
              onClick={() => onGoToTab('settings')}
              className="h-[40px] px-4 border border-[#cbd0da] bg-[#f8f9fb] hover:border-[#111111] hover:bg-white text-xs font-bold text-[#111111] inline-flex items-center gap-2 whitespace-nowrap"
            >
              <Settings2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Configure CFG Settings</span>
            </button>
          </div>
        </div>
      </section>

      {/* Watchlist Database Header + Import Actions */}
      <section className="space-y-4">
        <div className="bg-white border border-[#e2e4ea] p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-lg font-extrabold tracking-tight text-[#111111]">
              Watchlist &amp; Case Lookup Database
            </h2>
            <p className="text-xs text-[#555a66] mt-0.5 tabular-nums">
              {config.keywords.length} keywords · {config.tmNumbers.length} 6-digit TM numbers ·{' '}
              {config.caseEntries.length} Case Lookup mappings (duplicate-protected)
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => setBulkModalOpen(true)}
              className="builty-btn h-[38px] pl-4 pr-3 gap-2 text-xs whitespace-nowrap"
            >
              <Layers className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Bulk Update Modal</span>
            </button>
            <button
              type="button"
              onClick={() => openWizard('watchlist')}
              className="h-[38px] px-4 border border-[#cbd0da] bg-[#f8f9fb] hover:border-[#111111] hover:bg-white text-xs font-bold text-[#111111] inline-flex items-center gap-2 whitespace-nowrap"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Import Wizard (File / Sheet)</span>
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
            onApplyWatchlist={handleApplyWatchlistImport}
            onApplyCaseEntries={handleApplyCaseEntries}
            onClose={() => setWizardOpen(false)}
          />
        )}

        {/* Watchlist Section: Keywords + 6-Digit TM Numbers + Case Lookup */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Keywords */}
          <div className="bg-white border border-[#e2e4ea] p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-[#eceef2] pb-3">
              <h3 className="text-base font-extrabold text-[#111111]">Watchlist Keywords</h3>
              <span className="text-xs text-[#111111] bg-[#ffee00] px-2 py-0.5 font-extrabold tabular-nums">
                {config.keywords.length}
              </span>
            </div>

            <form onSubmit={handleAddKeyword} className="flex gap-2">
              <input
                type="text"
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                placeholder="Add keyword (or comma-separated)"
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
              <Search
                className="w-3.5 h-3.5 text-[#6b7280] absolute left-2.5 top-1/2 -translate-y-1/2"
                aria-hidden="true"
              />
              <input
                type="text"
                value={kwSearch}
                onChange={(e) => setKwSearch(e.target.value)}
                placeholder="Filter keywords…"
                aria-label="Filter watchlist keywords"
                className="w-full bg-[#f8f9fb] border border-[#e2e4ea] pl-8 pr-2.5 py-1.5 text-xs text-[#111111] focus:bg-white focus:outline-none focus:border-[#111111]"
              />
            </div>

            <ul className="divide-y divide-[#eceef2] max-h-[250px] overflow-y-auto">
              {filteredKeywords.slice(0, MAX_VISIBLE_LIST).map((kw) => (
                <li
                  key={kw}
                  className="py-2 flex items-center justify-between gap-2 text-xs text-[#111111]"
                >
                  <span className="font-mono font-medium truncate" title={kw}>
                    {kw}
                  </span>
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
              {filteredKeywords.length === 0 && (
                <li className="py-4 text-center text-xs text-[#555a66]">No matching keywords.</li>
              )}
            </ul>
            {filteredKeywords.length > MAX_VISIBLE_LIST && (
              <p className="text-[11px] text-[#555a66] tabular-nums">
                Showing {MAX_VISIBLE_LIST} of {filteredKeywords.length} · filter above to narrow
              </p>
            )}
          </div>

          {/* 6-Digit TM Numbers */}
          <div className="bg-white border border-[#e2e4ea] p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-[#eceef2] pb-3">
              <h3 className="text-base font-extrabold text-[#111111]">TM Numbers (6-digit)</h3>
              <span className="text-xs text-[#111111] bg-[#ffee00] px-2 py-0.5 font-extrabold tabular-nums">
                {config.tmNumbers.length}
              </span>
            </div>

            <form onSubmit={handleAddTm} className="space-y-1.5">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newTm}
                  onChange={(e) => setNewTm(e.target.value)}
                  placeholder="6-digit TM No(s) (e.g. 548291)"
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
              <Search
                className="w-3.5 h-3.5 text-[#6b7280] absolute left-2.5 top-1/2 -translate-y-1/2"
                aria-hidden="true"
              />
              <input
                type="text"
                value={tmSearch}
                onChange={(e) => setTmSearch(e.target.value)}
                placeholder="Filter TM numbers…"
                aria-label="Filter 6-digit TM numbers"
                className="w-full bg-[#f8f9fb] border border-[#e2e4ea] pl-8 pr-2.5 py-1.5 text-xs font-mono text-[#111111] focus:bg-white focus:outline-none focus:border-[#111111]"
              />
            </div>

            <ul className="divide-y divide-[#eceef2] max-h-[250px] overflow-y-auto">
              {filteredTms.slice(0, MAX_VISIBLE_LIST).map((tm) => (
                <li
                  key={tm}
                  className="py-2 flex items-center justify-between gap-2 text-xs text-[#111111]"
                >
                  <span className="font-mono font-medium tabular-nums">{tm}</span>
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
              {filteredTms.length === 0 && (
                <li className="py-4 text-center text-xs text-[#555a66]">No matching TM numbers.</li>
              )}
            </ul>
            {filteredTms.length > MAX_VISIBLE_LIST && (
              <p className="text-[11px] text-[#555a66] tabular-nums">
                Showing {MAX_VISIBLE_LIST} of {filteredTms.length} · filter above to narrow
              </p>
            )}
          </div>

          {/* Case Lookup Directory */}
          <div className="bg-white border border-[#e2e4ea] p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-[#eceef2] pb-3">
              <h3 className="text-base font-extrabold text-[#111111]">Case Lookup Map</h3>
              <button
                type="button"
                data-sfx="filter"
                onClick={() => onGoToTab('database')}
                className="builty-filter-btn text-xs text-[#111111] bg-[#ffee00] px-2 py-0.5 font-extrabold tabular-nums hover:bg-[#f2e000]"
              >
                {config.caseEntries.length} (Open DB)
              </button>
            </div>

            <form onSubmit={handleAddCaseEntry} className="space-y-1.5">
              <div className="grid grid-cols-3 gap-1.5">
                <input
                  type="text"
                  value={caseTm}
                  onChange={(e) => setCaseTm(e.target.value)}
                  placeholder="TM No"
                  aria-label="Case TM Number"
                  className="bg-[#f8f9fb] border border-[#cbd0da] px-2 py-2 text-xs text-[#111111] font-mono focus:bg-white focus:outline-none focus:border-[#111111]"
                />
                <input
                  type="text"
                  value={caseNo}
                  onChange={(e) => setCaseNo(e.target.value)}
                  placeholder="Case No"
                  aria-label="Case Number"
                  className="bg-[#f8f9fb] border border-[#cbd0da] px-2 py-2 text-xs text-[#111111] focus:bg-white focus:outline-none focus:border-[#111111]"
                />
                <div className="flex gap-1">
                  <input
                    type="text"
                    value={caseClient}
                    onChange={(e) => setCaseClient(e.target.value)}
                    placeholder="Client"
                    aria-label="Client Name"
                    className="flex-1 min-w-0 bg-[#f8f9fb] border border-[#cbd0da] px-2 py-2 text-xs text-[#111111] focus:bg-white focus:outline-none focus:border-[#111111]"
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
              <Search
                className="w-3.5 h-3.5 text-[#6b7280] absolute left-2.5 top-1/2 -translate-y-1/2"
                aria-hidden="true"
              />
              <input
                type="text"
                value={caseSearch}
                onChange={(e) => setCaseSearch(e.target.value)}
                placeholder="Filter TM, Case No, or Client…"
                aria-label="Filter case lookup map"
                className="w-full bg-[#f8f9fb] border border-[#e2e4ea] pl-8 pr-2.5 py-1.5 text-xs text-[#111111] focus:bg-white focus:outline-none focus:border-[#111111]"
              />
            </div>

            <ul className="divide-y divide-[#eceef2] max-h-[250px] overflow-y-auto">
              {filteredCases.slice(0, MAX_VISIBLE_LIST).map((c) => (
                <li
                  key={c.tmNumber}
                  className="py-2 flex items-center justify-between gap-2 text-xs"
                >
                  <div
                    className="min-w-0 truncate"
                    title={`${c.tmNumber} · ${c.caseNo} — ${c.applicationName || c.clientName}`}
                  >
                    <span className="font-mono font-bold text-[#111111] tabular-nums">{c.tmNumber}</span>
                    <span className="text-[#9ca3af]"> · </span>
                    <span className="text-[#111111] font-semibold">{c.caseNo}</span>
                    {(c.applicationName || c.clientName) && (
                      <span className="text-[#555a66]"> — {c.applicationName || c.clientName}</span>
                    )}
                  </div>
                  <FileText className="w-3.5 h-3.5 text-[#6b7280] shrink-0" aria-hidden="true" />
                </li>
              ))}
              {filteredCases.length === 0 && (
                <li className="py-4 text-center text-xs text-[#555a66]">No matching case entries.</li>
              )}
            </ul>
            {filteredCases.length > MAX_VISIBLE_LIST && (
              <p className="text-[11px] text-[#555a66] tabular-nums">
                Showing {MAX_VISIBLE_LIST} of {filteredCases.length} · filter above to narrow
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
