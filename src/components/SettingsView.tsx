import { useRef } from 'react';
import { Database, RotateCcw, Settings2, ShieldCheck, X } from 'lucide-react';
import { CaseSheetConfig, JournalConfig, KeywordMatchMode } from '../types/journal';
import {
  DEFAULT_APPS_SCRIPT_CASE_SHEET_ID,
  DEFAULT_APPS_SCRIPT_CASE_SHEET_NAME,
  USER_WATCHLIST_KEYWORDS,
  USER_WATCHLIST_TM_NUMBERS,
} from '../lib/journal/watchlistSeed';
import { formatCompositeCaseNo } from '../lib/journal/engine';

interface SettingsViewProps {
  config: JournalConfig;
  onUpdateConfig: (next: JournalConfig) => void;
  onResetSampleData: () => void;
  onNotify: (message: string) => void;
  onOpenDatabase: () => void;
}

export function SettingsView({
  config,
  onUpdateConfig,
  onResetSampleData,
  onNotify,
  onOpenDatabase,
}: SettingsViewProps) {
  const journalNoInputRef = useRef<HTMLInputElement>(null);
  const sheetCfg: CaseSheetConfig = config.caseSheetConfig || {
    sheetUrlOrId: DEFAULT_APPS_SCRIPT_CASE_SHEET_ID,
    sheetName: DEFAULT_APPS_SCRIPT_CASE_SHEET_NAME,
    keyCol: 8,
    prefixCol: 3,
    clientCodeCol: 4,
    caseCol: 5,
    clientCol: 6,
    appNameCol: 7,
    caseSeparator: '-',
  };

  const updateSheetConfig = (patch: Partial<CaseSheetConfig>) => {
    onUpdateConfig({
      ...config,
      caseSheetConfig: {
        ...sheetCfg,
        ...patch,
      },
    });
  };

  const handleRestoreSeedWatchlist = () => {
    const mergedKeywords = Array.from(
      new Set([...config.keywords, ...USER_WATCHLIST_KEYWORDS])
    );
    const mergedTms = Array.from(
      new Set([...config.tmNumbers, ...USER_WATCHLIST_TM_NUMBERS])
    );
    onUpdateConfig({
      ...config,
      keywords: mergedKeywords,
      tmNumbers: mergedTms,
    });
    onNotify(
      `Watchlist restored: ${mergedKeywords.length} keywords and ${mergedTms.length} 6-digit TM numbers active.`
    );
  };

  const sepPreview = formatCompositeCaseNo('A', '32', '4', sheetCfg.caseSeparator || '-');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-[#e2e4ea] p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight text-[#111111]">
            Workspace &amp; Scanner Settings (CFG)
          </h2>
          <p className="text-xs text-[#555a66] mt-1">
            Configure Journal metadata, match rules, serial numbering, and Database column mapping.
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenDatabase}
          className="h-[38px] px-4 border border-[#111111] bg-white hover:bg-[#f6f7f9] text-xs font-bold text-[#111111] inline-flex items-center gap-2 self-start sm:self-auto"
        >
          <Database className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Open Database Tab</span>
        </button>
      </div>

      {/* Main 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Card 1: Dashboard Settings (CFG) */}
        <section className="bg-white border border-[#e2e4ea] p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-[#eceef2] pb-3">
            <div className="flex items-center gap-2.5">
              <span className="w-7 h-7 bg-[#ffee00] text-[#111111] flex items-center justify-center">
                <Settings2 className="w-4 h-4" aria-hidden="true" />
              </span>
              <h3 className="text-base font-extrabold text-[#111111]">
                Journal &amp; Scan Settings (CFG)
              </h3>
            </div>
            <span className="text-xs font-mono text-[#555a66]">
              {config.serialPrefix}001
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="settings-journal-no" className="block text-xs font-bold text-[#374151] mb-1.5">
                Journal No (Dashboard B2)
              </label>
              <div className="relative">
                <input
                  id="settings-journal-no"
                  ref={journalNoInputRef}
                  type="text"
                  value={config.journalNo}
                  onChange={(e) => onUpdateConfig({ ...config, journalNo: e.target.value })}
                  className="w-full bg-[#f8f9fb] border border-[#cbd0da] pl-3 pr-8 py-2.5 text-sm text-[#111111] focus:bg-white focus:outline-none focus:border-[#111111]"
                />
                {config.journalNo && (
                  <button
                    type="button"
                    aria-label="Clear Journal No"
                    onClick={() => {
                      onUpdateConfig({ ...config, journalNo: '' });
                      journalNoInputRef.current?.focus();
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[#6b7280] hover:text-[#111111]"
                  >
                    <X className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>

            <div>
              <label htmlFor="settings-journal-date" className="block text-xs font-bold text-[#374151] mb-1.5">
                Journal Date (Dashboard B3)
              </label>
              <input
                id="settings-journal-date"
                type="text"
                value={config.journalDate}
                onChange={(e) => onUpdateConfig({ ...config, journalDate: e.target.value })}
                placeholder="26-Nov-2026"
                className="w-full bg-[#f8f9fb] border border-[#cbd0da] px-3 py-2.5 text-sm text-[#111111] focus:bg-white focus:outline-none focus:border-[#111111]"
              />
            </div>

            <div>
              <label htmlFor="settings-match-mode" className="block text-xs font-bold text-[#374151] mb-1.5">
                Keyword Match Mode
              </label>
              <select
                id="settings-match-mode"
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

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label htmlFor="settings-serial-prefix" className="block text-xs font-bold text-[#374151] mb-1.5">
                  Serial Prefix
                </label>
                <input
                  id="settings-serial-prefix"
                  type="text"
                  value={config.serialPrefix}
                  onChange={(e) => onUpdateConfig({ ...config, serialPrefix: e.target.value })}
                  className="w-full bg-[#f8f9fb] border border-[#cbd0da] px-3 py-2.5 text-sm font-mono text-[#111111] focus:bg-white focus:outline-none focus:border-[#111111]"
                />
              </div>

              <div>
                <label htmlFor="settings-serial-pad" className="block text-xs font-bold text-[#374151] mb-1.5">
                  Serial Pad
                </label>
                <input
                  id="settings-serial-pad"
                  type="number"
                  min={1}
                  max={6}
                  value={config.serialPad}
                  onChange={(e) =>
                    onUpdateConfig({
                      ...config,
                      serialPad: Math.max(1, Math.min(6, Number(e.target.value) || 3)),
                    })
                  }
                  className="w-full bg-[#f8f9fb] border border-[#cbd0da] px-3 py-2.5 text-sm font-mono text-[#111111] focus:bg-white focus:outline-none focus:border-[#111111]"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Card 2: Database Matching & 3-Col Case Number Rules */}
        <section className="bg-white border border-[#e2e4ea] p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-[#eceef2] pb-3">
            <div className="flex items-center gap-2.5">
              <span className="w-7 h-7 bg-[#ffee00] text-[#111111] flex items-center justify-center">
                <Database className="w-4 h-4" aria-hidden="true" />
              </span>
              <h3 className="text-base font-extrabold text-[#111111]">
                Database Match &amp; Case Format
              </h3>
            </div>
            <span className="text-xs font-mono font-bold text-[#111111] bg-[#fffef0] border border-[#111111] px-2 py-0.5">
              Preview: {sepPreview}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label htmlFor="settings-sheet-id" className="block text-xs font-bold text-[#374151] mb-1.5">
                Google Sheet URL, Sheet ID, or Published CSV Link
              </label>
              <input
                id="settings-sheet-id"
                type="text"
                value={sheetCfg.sheetUrlOrId}
                onChange={(e) => updateSheetConfig({ sheetUrlOrId: e.target.value })}
                className="w-full bg-[#f8f9fb] border border-[#cbd0da] px-3 py-2 text-xs font-mono text-[#111111] focus:bg-white focus:outline-none focus:border-[#111111]"
              />
            </div>

            <div>
              <label htmlFor="settings-sheet-tab" className="block text-xs font-bold text-[#374151] mb-1.5">
                Database Sheet Tab Name
              </label>
              <input
                id="settings-sheet-tab"
                type="text"
                value={sheetCfg.sheetName}
                onChange={(e) => updateSheetConfig({ sheetName: e.target.value })}
                className="w-full bg-[#f8f9fb] border border-[#cbd0da] px-3 py-2 text-xs text-[#111111] focus:bg-white focus:outline-none focus:border-[#111111]"
              />
            </div>

            <div>
              <label htmlFor="settings-case-sep" className="block text-xs font-bold text-[#374151] mb-1.5">
                Case Number Separator
              </label>
              <input
                id="settings-case-sep"
                type="text"
                value={sheetCfg.caseSeparator || '-'}
                onChange={(e) => updateSheetConfig({ caseSeparator: e.target.value || '-' })}
                className="w-full bg-[#f8f9fb] border border-[#cbd0da] px-3 py-2 text-xs font-mono text-[#111111] focus:bg-white focus:outline-none focus:border-[#111111]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
            <div>
              <label htmlFor="settings-key-col" className="block text-[11px] font-bold text-[#374151] mb-1">
                Match TM Col #
              </label>
              <input
                id="settings-key-col"
                type="number"
                min={1}
                value={sheetCfg.keyCol}
                onChange={(e) => updateSheetConfig({ keyCol: Math.max(1, Number(e.target.value) || 8) })}
                className="w-full bg-[#f8f9fb] border border-[#cbd0da] px-2.5 py-2 text-xs font-mono text-[#111111]"
              />
            </div>

            <div>
              <label htmlFor="settings-prefix-col" className="block text-[11px] font-bold text-[#374151] mb-1">
                Prefix Col #
              </label>
              <input
                id="settings-prefix-col"
                type="number"
                min={1}
                value={sheetCfg.prefixCol ?? 3}
                onChange={(e) =>
                  updateSheetConfig({ prefixCol: Math.max(1, Number(e.target.value) || 3) })
                }
                className="w-full bg-[#f8f9fb] border border-[#cbd0da] px-2.5 py-2 text-xs font-mono text-[#111111]"
              />
            </div>

            <div>
              <label htmlFor="settings-code-col" className="block text-[11px] font-bold text-[#374151] mb-1">
                Client Code Col #
              </label>
              <input
                id="settings-code-col"
                type="number"
                min={1}
                value={sheetCfg.clientCodeCol ?? 4}
                onChange={(e) =>
                  updateSheetConfig({ clientCodeCol: Math.max(1, Number(e.target.value) || 4) })
                }
                className="w-full bg-[#f8f9fb] border border-[#cbd0da] px-2.5 py-2 text-xs font-mono text-[#111111]"
              />
            </div>

            <div>
              <label htmlFor="settings-case-col" className="block text-[11px] font-bold text-[#374151] mb-1">
                Case No Col #
              </label>
              <input
                id="settings-case-col"
                type="number"
                min={1}
                value={sheetCfg.caseCol}
                onChange={(e) => updateSheetConfig({ caseCol: Math.max(1, Number(e.target.value) || 5) })}
                className="w-full bg-[#f8f9fb] border border-[#cbd0da] px-2.5 py-2 text-xs font-mono text-[#111111]"
              />
            </div>
          </div>
        </section>
      </div>

      {/* Maintenance & Watchlist Defaults */}
      <section className="bg-white border border-[#e2e4ea] p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="w-8 h-8 bg-[#ffee00] text-[#111111] flex items-center justify-center shrink-0">
            <ShieldCheck className="w-4 h-4" aria-hidden="true" />
          </span>
          <div>
            <h3 className="text-sm font-extrabold text-[#111111]">
              Watchlist Seed &amp; Workspace Defaults
            </h3>
            <p className="text-xs text-[#555a66] mt-0.5 tabular-nums">
              Active Watchlist: {config.keywords.length} keywords · {config.tmNumbers.length} 6-digit TMs ·{' '}
              {config.caseEntries.length} Database rows
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2.5">
          <button
            type="button"
            onClick={handleRestoreSeedWatchlist}
            className="h-[38px] px-4 border border-[#111111] bg-white hover:bg-[#f6f7f9] text-xs font-bold text-[#111111]"
          >
            Merge Default Watchlist ({USER_WATCHLIST_KEYWORDS.length} KW / {USER_WATCHLIST_TM_NUMBERS.length} TMs)
          </button>
          <button
            type="button"
            onClick={onResetSampleData}
            className="h-[38px] px-4 border border-[#cbd0da] bg-[#f8f9fb] hover:border-[#111111] hover:bg-white text-xs font-bold text-[#111111] inline-flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Reset Sample Data</span>
          </button>
        </div>
      </section>
    </div>
  );
}
