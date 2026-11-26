import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, FileSpreadsheet, Layers, X } from 'lucide-react';
import { parseWatchlistImport } from '../lib/journal/engine';

interface WatchlistBulkModalProps {
  existingKeywords: string[];
  existingTmNumbers: string[];
  onMergeWatchlist: (newKeywords: string[], newTms: string[], mode: 'merge' | 'replace') => void;
  onClose: () => void;
}

export function WatchlistBulkModal({
  existingKeywords,
  existingTmNumbers,
  onMergeWatchlist,
  onClose,
}: WatchlistBulkModalProps) {
  const [inputMode, setInputMode] = useState<'split' | 'csv'>('split');
  const [keywordsText, setKeywordsText] = useState('');
  const [tmText, setTmText] = useState('');
  const [csvText, setCsvText] = useState('');
  const [applyMode, setApplyMode] = useState<'merge' | 'replace'>('merge');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const parsed = useMemo(() => {
    if (inputMode === 'csv') {
      return parseWatchlistImport(csvText, 'auto');
    }
    const kwParsed = parseWatchlistImport(keywordsText, 'keywords_only');
    const tmParsed = parseWatchlistImport(tmText, 'tm_only');
    return {
      keywords: kwParsed.keywords,
      tmNumbers: tmParsed.tmNumbers,
      skippedHeaders: kwParsed.skippedHeaders + tmParsed.skippedHeaders,
      skippedDuplicates: kwParsed.skippedDuplicates + tmParsed.skippedDuplicates,
      invalidTmTokens: tmParsed.invalidTmTokens,
    };
  }, [inputMode, keywordsText, tmText, csvText]);

  const mergeStats = useMemo(() => {
    const existingKwSet = new Set(existingKeywords.map((k) => k.trim().toLowerCase()));
    const existingTmSet = new Set(existingTmNumbers.map((t) => t.trim()));

    const newKeywords = parsed.keywords.filter((k) => !existingKwSet.has(k.trim().toLowerCase()));
    const dupKeywords = parsed.keywords.length - newKeywords.length;

    const newTms = parsed.tmNumbers.filter((t) => !existingTmSet.has(t.trim()));
    const dupTms = parsed.tmNumbers.length - newTms.length;

    return {
      newKeywords,
      dupKeywords,
      newTms,
      dupTms,
    };
  }, [parsed, existingKeywords, existingTmNumbers]);

  const hasAnyInput = parsed.keywords.length > 0 || parsed.tmNumbers.length > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="bulk-watchlist-modal-title"
        className="w-full max-w-3xl bg-white border border-[#111111] shadow-xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 bg-[#111111] text-white flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[#ffee00] text-[#111111] flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-4 h-4" aria-hidden="true" />
            </div>
            <div>
              <h2 id="bulk-watchlist-modal-title" className="text-sm font-extrabold tracking-tight">
                Bulk Update Watchlist Criteria
              </h2>
              <p className="text-xs text-[#c7c9d1]">
                Paste comma-separated lists or CSV text of Keywords and 6-digit TM Numbers (duplicates merged automatically)
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 text-[#c7c9d1] hover:text-[#ffee00]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode Tabs */}
        <div className="px-6 pt-4 flex gap-2 border-b border-[#e2e4ea] shrink-0">
          <button
            type="button"
            data-sfx="filter"
            data-active={inputMode === 'split'}
            onClick={() => setInputMode('split')}
            className={`builty-filter-btn px-4 py-2 text-xs font-extrabold border-b-2 ${
              inputMode === 'split'
                ? 'border-[#111111] text-[#111111] bg-[#fffef0]'
                : 'border-transparent text-[#555a66] hover:text-[#111111]'
            }`}
          >
            Comma / Line Lists (Keywords &amp; TM Numbers)
          </button>
          <button
            type="button"
            data-sfx="filter"
            data-active={inputMode === 'csv'}
            onClick={() => setInputMode('csv')}
            className={`builty-filter-btn px-4 py-2 text-xs font-extrabold border-b-2 ${
              inputMode === 'csv'
                ? 'border-[#111111] text-[#111111] bg-[#fffef0]'
                : 'border-transparent text-[#555a66] hover:text-[#111111]'
            }`}
          >
            Combined CSV / Excel Paste
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 overflow-y-auto">
          {inputMode === 'split' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label htmlFor="bulk-kw-input" className="block text-xs font-bold text-[#111111]">
                  Keywords (comma or newline separated)
                </label>
                <textarea
                  id="bulk-kw-input"
                  rows={7}
                  value={keywordsText}
                  onChange={(e) => setKeywordsText(e.target.value)}
                  placeholder="ORAKAL, DELTA STAR, NAEEM INFEX&#10;A2Z CONSULTANTS"
                  className="w-full bg-[#f8f9fb] border border-[#cbd0da] p-3 text-xs font-mono text-[#111111] focus:bg-white focus:outline-none focus:border-[#111111]"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="bulk-tm-input" className="block text-xs font-bold text-[#111111]">
                  TM Numbers — 6-digit (comma, space, or newline separated)
                </label>
                <textarea
                  id="bulk-tm-input"
                  rows={7}
                  value={tmText}
                  onChange={(e) => setTmText(e.target.value)}
                  placeholder="590630, 583969, 583970, 582722"
                  className="w-full bg-[#f8f9fb] border border-[#cbd0da] p-3 text-xs font-mono text-[#111111] focus:bg-white focus:outline-none focus:border-[#111111]"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <label htmlFor="bulk-csv-input" className="block text-xs font-bold text-[#111111]">
                CSV or Tab-Separated Text (Keywords &amp; TM Numbers)
              </label>
              <textarea
                id="bulk-csv-input"
                rows={8}
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                placeholder="Keywords,TM Numbers&#10;ORAKAL,583969&#10;DELTA STAR,583970&#10;,590630"
                className="w-full bg-[#f8f9fb] border border-[#cbd0da] p-3 text-xs font-mono text-[#111111] focus:bg-white focus:outline-none focus:border-[#111111]"
              />
            </div>
          )}

          {/* Merge Mode Selection */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-[#f6f7f9] border border-[#e2e4ea] p-3.5 text-xs">
            <div className="flex items-center gap-2 font-bold text-[#111111]">
              <Layers className="w-4 h-4" aria-hidden="true" />
              <span>Update Behavior:</span>
            </div>
            <div className="flex flex-wrap gap-4">
              <label className="inline-flex items-center gap-2 cursor-pointer font-semibold text-[#111111]">
                <input
                  type="radio"
                  name="bulk-apply-mode"
                  checked={applyMode === 'merge'}
                  onChange={() => setApplyMode('merge')}
                  className="accent-[#111111]"
                />
                <span>Merge &amp; Deduplicate (Keep Existing)</span>
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer font-semibold text-[#111111]">
                <input
                  type="radio"
                  name="bulk-apply-mode"
                  checked={applyMode === 'replace'}
                  onChange={() => setApplyMode('replace')}
                  className="accent-[#111111]"
                />
                <span>Replace Supplied Lists</span>
              </label>
            </div>
          </div>

          {/* Live Summary Preview */}
          {hasAnyInput && (
            <div className="border border-[#e2e4ea] bg-[#fffef0] p-4 space-y-2 text-xs tabular-nums">
              <div className="flex items-center gap-2 font-extrabold text-[#111111]">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />
                <span>Parsed Criteria Summary</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[#111111]">
                <div>
                  Keywords: <span className="font-bold">{parsed.keywords.length}</span> parsed
                  {applyMode === 'merge' && (
                    <span className="text-[#555a66]">
                      {' '}
                      ({mergeStats.newKeywords.length} new · {mergeStats.dupKeywords} duplicate skipped)
                    </span>
                  )}
                </div>
                <div>
                  6-digit TMs: <span className="font-bold">{parsed.tmNumbers.length}</span> parsed
                  {applyMode === 'merge' && (
                    <span className="text-[#555a66]">
                      {' '}
                      ({mergeStats.newTms.length} new · {mergeStats.dupTms} duplicate skipped)
                    </span>
                  )}
                </div>
              </div>
              {parsed.skippedDuplicates > 0 && (
                <p className="text-[#555a66]">
                  Auto-deduplicated {parsed.skippedDuplicates} duplicate item(s) inside pasted text.
                </p>
              )}
              {parsed.invalidTmTokens.length > 0 && (
                <p className="text-amber-800">
                  Ignored non-6-digit TM token(s): {parsed.invalidTmTokens.slice(0, 6).join(', ')}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-[#f6f7f9] border-t border-[#e2e4ea] flex flex-wrap items-center justify-end gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="h-[38px] px-4 border border-[#cbd0da] bg-white text-xs font-bold text-[#4b505c] hover:text-[#111111]"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!hasAnyInput}
            onClick={() => {
              onMergeWatchlist(parsed.keywords, parsed.tmNumbers, applyMode);
              onClose();
            }}
            className="builty-btn h-[38px] pl-4 pr-3 gap-2 text-xs disabled:opacity-40"
          >
            <span>
              {applyMode === 'merge'
                ? `Merge (+${mergeStats.newKeywords.length} KW, +${mergeStats.newTms.length} TMs)`
                : `Replace (${parsed.keywords.length} KW, ${parsed.tmNumbers.length} TMs)`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
