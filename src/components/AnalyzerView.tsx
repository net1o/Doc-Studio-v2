import { useState } from 'react';
import {
  Check,
  FileText,
  FolderSearch,
  Play,
  Plus,
  Printer,
  SearchCheck,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import { CaseEntry, JournalConfig, JournalStats, KeywordMatchMode } from '../types/journal';

interface AnalyzerViewProps {
  config: JournalConfig;
  stats: JournalStats;
  journalRowCount: number;
  onUpdateConfig: (next: JournalConfig) => void;
  onRunScan: () => void;
  onGoToTab: (tab: 'journalcheck' | 'review' | 'generator') => void;
}

export function AnalyzerView({
  config,
  stats,
  journalRowCount,
  onUpdateConfig,
  onRunScan,
  onGoToTab,
}: AnalyzerViewProps) {
  const [newKeyword, setNewKeyword] = useState('');
  const [newTm, setNewTm] = useState('');
  const [tmError, setTmError] = useState<string | null>(null);
  const [caseTm, setCaseTm] = useState('');
  const [caseNo, setCaseNo] = useState('');
  const [caseClient, setCaseClient] = useState('');

  const handleAddKeyword = (e: React.FormEvent) => {
    e.preventDefault();
    const parts = newKeyword
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length === 0) return;
    const merged = Array.from(new Set([...config.keywords, ...parts]));
    onUpdateConfig({ ...config, keywords: merged });
    setNewKeyword('');
  };

  const handleRemoveKeyword = (kw: string) => {
    onUpdateConfig({
      ...config,
      keywords: config.keywords.filter((k) => k !== kw),
    });
  };

  const handleAddTm = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = newTm.trim();
    if (!/^\d{6}$/.test(cleaned)) {
      setTmError('Enter an exact 6-digit TM number (e.g. 548291).');
      return;
    }
    setTmError(null);
    if (!config.tmNumbers.includes(cleaned)) {
      onUpdateConfig({
        ...config,
        tmNumbers: [...config.tmNumbers, cleaned],
      });
    }
    setNewTm('');
  };

  const handleRemoveTm = (tm: string) => {
    onUpdateConfig({
      ...config,
      tmNumbers: config.tmNumbers.filter((t) => t !== tm),
    });
  };

  const handleAddCaseEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!caseTm.trim() || !caseNo.trim()) return;
    const entry: CaseEntry = {
      tmNumber: caseTm.trim(),
      caseNo: caseNo.trim(),
      clientName: caseClient.trim(),
    };
    onUpdateConfig({
      ...config,
      caseEntries: [entry, ...config.caseEntries.filter((c) => c.tmNumber !== entry.tmNumber)],
    });
    setCaseTm('');
    setCaseNo('');
    setCaseClient('');
  };

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
      sub: 'Journal 909 Legal 8.5×14 output',
      icon: Printer,
    },
  ];

  const checklistItems = [
    `Journal ${config.journalNo || '909'} (${config.journalDate}) metadata configured`,
    `${journalRowCount} rows loaded in JournalCheck input table`,
    `${config.keywords.length} keywords and ${config.tmNumbers.length} 6-digit TM numbers armed`,
    `${stats.total} matches queued in Review (${stats.issue} flagged Issue / Oppose)`,
    `Legal 8.5×14 Journal 909 template bound to MAILMERGE generator`,
  ];

  return (
    <div className="space-y-8">
      {/* 2x2 Architectural Stat Cards inspired by Builty Sectors/Owner/Square Feet/Date grid */}
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

      {/* Two-Column Split: Workflow Checklist + Journal Configuration */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-5 bg-white border border-[#e2e4ea] p-6 flex flex-col justify-between gap-5">
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
              className="h-[40px] px-4 border border-[#cbd0da] bg-[#f8f9fb] text-xs font-bold text-[#111111] hover:border-[#111111] hover:bg-white transition-colors whitespace-nowrap"
            >
              Edit JournalCheck Data
            </button>
            <button
              type="button"
              onClick={() => onGoToTab('review')}
              className="h-[40px] px-4 border border-[#cbd0da] bg-[#f8f9fb] text-xs font-bold text-[#111111] hover:border-[#111111] hover:bg-white transition-colors whitespace-nowrap"
            >
              Open Review Queue
            </button>
          </div>
        </div>

        <div className="lg:col-span-7 bg-white border border-[#e2e4ea] p-6 space-y-5">
          <div className="flex items-center justify-between gap-2 border-b border-[#eceef2] pb-3">
            <h2 className="text-lg font-extrabold tracking-tight text-[#111111]">
              Dashboard Settings (CFG)
            </h2>
            <span className="text-xs font-semibold text-[#555a66] tabular-nums">
              Serial prefix: <span className="text-[#111111] font-mono">{config.serialPrefix}</span>
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="cfg-journal-no" className="block text-xs font-bold text-[#374151] mb-1.5">
                Journal No (Dashboard B2)
              </label>
              <input
                id="cfg-journal-no"
                type="text"
                value={config.journalNo}
                onChange={(e) => onUpdateConfig({ ...config, journalNo: e.target.value })}
                className="w-full bg-[#f8f9fb] border border-[#cbd0da] px-3 py-2.5 text-sm text-[#111111] focus:bg-white focus:outline-none focus:border-[#111111]"
              />
            </div>

            <div>
              <label htmlFor="cfg-journal-date" className="block text-xs font-bold text-[#374151] mb-1.5">
                Journal Date (Dashboard B3)
              </label>
              <input
                id="cfg-journal-date"
                type="text"
                value={config.journalDate}
                onChange={(e) => onUpdateConfig({ ...config, journalDate: e.target.value })}
                placeholder="26-Nov-2026"
                className="w-full bg-[#f8f9fb] border border-[#cbd0da] px-3 py-2.5 text-sm text-[#111111] focus:bg-white focus:outline-none focus:border-[#111111]"
              />
            </div>

            <div>
              <label htmlFor="cfg-match-mode" className="block text-xs font-bold text-[#374151] mb-1.5">
                Keyword Match Mode
              </label>
              <select
                id="cfg-match-mode"
                value={config.keywordMatchMode}
                onChange={(e) =>
                  onUpdateConfig({
                    ...config,
                    keywordMatchMode: e.target.value as KeywordMatchMode,
                  })
                }
                className="w-full bg-[#f8f9fb] border border-[#cbd0da] px-3 py-2.5 text-sm text-[#111111] focus:bg-white focus:outline-none focus:border-[#111111]"
              >
                <option value="word">Word Boundary (Recommended)</option>
                <option value="contains">Substring Contains</option>
              </select>
            </div>

            <div>
              <label htmlFor="cfg-serial-prefix" className="block text-xs font-bold text-[#374151] mb-1.5">
                Serial Prefix
              </label>
              <input
                id="cfg-serial-prefix"
                type="text"
                value={config.serialPrefix}
                onChange={(e) => onUpdateConfig({ ...config, serialPrefix: e.target.value })}
                className="w-full bg-[#f8f9fb] border border-[#cbd0da] px-3 py-2.5 text-sm text-[#111111] focus:bg-white focus:outline-none focus:border-[#111111]"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Watchlist Section: Keywords + 6-Digit TM Numbers + Case Lookup */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Keywords */}
        <div className="bg-white border border-[#e2e4ea] p-5 flex flex-col gap-4">
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

          <ul className="divide-y divide-[#eceef2] max-h-[240px] overflow-y-auto">
            {config.keywords.map((kw) => (
              <li
                key={kw}
                className="py-2 flex items-center justify-between gap-2 text-xs text-[#111111]"
              >
                <span className="font-mono font-medium">{kw}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveKeyword(kw)}
                  aria-label={`Remove keyword ${kw}`}
                  className="p-1 text-[#6b7280] hover:text-red-600"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* 6-Digit TM Numbers */}
        <div className="bg-white border border-[#e2e4ea] p-5 flex flex-col gap-4">
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
                placeholder="6-digit TM No (e.g. 548291)"
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

          <ul className="divide-y divide-[#eceef2] max-h-[240px] overflow-y-auto">
            {config.tmNumbers.map((tm) => (
              <li
                key={tm}
                className="py-2 flex items-center justify-between gap-2 text-xs text-[#111111]"
              >
                <span className="font-mono font-medium tabular-nums">{tm}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveTm(tm)}
                  aria-label={`Remove TM ${tm}`}
                  className="p-1 text-[#6b7280] hover:text-red-600"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* Case Lookup Directory */}
        <div className="bg-white border border-[#e2e4ea] p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-[#eceef2] pb-3">
            <h3 className="text-base font-extrabold text-[#111111]">Case Lookup Map</h3>
            <span className="text-xs text-[#111111] bg-[#ffee00] px-2 py-0.5 font-extrabold tabular-nums">
              {config.caseEntries.length}
            </span>
          </div>

          <form onSubmit={handleAddCaseEntry} className="grid grid-cols-3 gap-1.5">
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
          </form>

          <ul className="divide-y divide-[#eceef2] max-h-[240px] overflow-y-auto">
            {config.caseEntries.map((c) => (
              <li
                key={c.tmNumber}
                className="py-2 flex items-center justify-between gap-2 text-xs"
              >
                <div className="min-w-0">
                  <span className="font-mono font-bold text-[#111111] tabular-nums">{c.tmNumber}</span>
                  <span className="text-[#9ca3af]"> · </span>
                  <span className="text-[#111111] font-semibold">{c.caseNo}</span>
                  {c.clientName && (
                    <span className="text-[#555a66]"> — {c.clientName}</span>
                  )}
                </div>
                <FileText className="w-3.5 h-3.5 text-[#6b7280] shrink-0" aria-hidden="true" />
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
