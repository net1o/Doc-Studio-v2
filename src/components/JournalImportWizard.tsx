import { useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  ClipboardPaste,
  Download,
  FileSpreadsheet,
  FileText,
  FileUp,
  Layers,
  X,
} from 'lucide-react';
import { JournalCheckRow } from '../types/journal';
import {
  detectJournalInputFormat,
  exportRowsToCsv,
  JOURNAL_IMPORT_COLUMNS,
  parseDelimitedJournalInput,
  parseRawJournalTextConvertJournal2,
  triggerFileDownload,
} from '../lib/journal/engine';

type WizardMode = 'file' | 'paste_table' | 'convert_text';

interface JournalImportWizardProps {
  existingCount: number;
  onImport: (rows: JournalCheckRow[], mode: 'append' | 'replace') => void;
  onClose: () => void;
}

const SAMPLE_CSV_URL = '/assets/aistudio/Journal_Pub_909_-_JournalCheck_b78c2532.csv';

export function JournalImportWizard({
  existingCount,
  onImport,
  onClose,
}: JournalImportWizardProps) {
  const [wizardMode, setWizardMode] = useState<WizardMode>('file');
  const [rawInput, setRawInput] = useState('');
  const [sourceLabel, setSourceLabel] = useState<string>('');
  const [normalizeDates, setNormalizeDates] = useState(true);
  const [extractEmbeddedPageNo, setExtractEmbeddedPageNo] = useState(true);
  const [loadingSample, setLoadingSample] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parsedResult = useMemo(() => {
    if (!rawInput.trim()) {
      return {
        detectedFormat: null as 'journal_text' | 'csv_tsv' | null,
        rows: [] as JournalCheckRow[],
        totalSegments: 0,
        skippedEmpty: 0,
        elapsedMs: 0,
      };
    }

    const effectiveFormat =
      wizardMode === 'convert_text'
        ? 'journal_text'
        : wizardMode === 'paste_table'
        ? 'csv_tsv'
        : detectJournalInputFormat(rawInput);

    if (effectiveFormat === 'journal_text') {
      const res = parseRawJournalTextConvertJournal2(rawInput, {
        normalizeDates,
        extractEmbeddedPageNo,
      });
      return {
        detectedFormat: 'journal_text' as const,
        rows: res.rows,
        totalSegments: res.totalSegments,
        skippedEmpty: res.skippedEmpty,
        elapsedMs: res.elapsedMs,
      };
    }

    const start = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const rows = parseDelimitedJournalInput(rawInput, {
      normalizeDates,
      extractEmbeddedPageNo,
    });
    const elapsedMs = Math.max(
      1,
      Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - start)
    );
    return {
      detectedFormat: 'csv_tsv' as const,
      rows,
      totalSegments: rows.length,
      skippedEmpty: 0,
      elapsedMs,
    };
  }, [rawInput, wizardMode, normalizeDates, extractEmbeddedPageNo]);

  const handleFilePicked = async (file: File) => {
    setErrorMsg(null);
    try {
      const text = await file.text();
      setRawInput(text);
      setSourceLabel(file.name);
      const detected = detectJournalInputFormat(text);
      setWizardMode(detected === 'journal_text' ? 'convert_text' : 'file');
    } catch {
      setErrorMsg('Unable to read the selected file. Ensure it is a valid UTF-8 CSV, TSV, or TXT file.');
    }
  };

  const handleLoadAttachedSample = async () => {
    setLoadingSample(true);
    setErrorMsg(null);
    try {
      const res = await fetch(SAMPLE_CSV_URL);
      if (!res.ok) throw new Error('Sample file not reachable');
      const text = await res.text();
      setRawInput(text);
      setSourceLabel('Journal_Pub_909_-_JournalCheck.csv');
      setWizardMode('file');
    } catch {
      setErrorMsg('Could not load the attached Journal 909 CSV asset.');
    } finally {
      setLoadingSample(false);
    }
  };

  const handleDownloadConvertedCsv = () => {
    if (parsedResult.rows.length === 0) return;
    const csv = exportRowsToCsv(
      [...JOURNAL_IMPORT_COLUMNS],
      parsedResult.rows.map((r) => [
        r.applicationNo,
        r.title,
        r.classNo,
        r.applicant,
        r.agent,
        r.dateOfFiling,
        r.pageNo,
      ])
    );
    triggerFileDownload(csv, 'JournalCheck_Converted.csv', 'text/csv;charset=utf-8');
  };

  const previewRows = parsedResult.rows.slice(0, 50);

  return (
    <section
      aria-label="JournalCheck Import Wizard"
      className="bg-white border border-[#d4d7e0] shadow-sm"
    >
      {/* Wizard Top Bar */}
      <div className="px-6 py-4 bg-[#111111] text-white flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[#ffee00] text-[#111111] flex items-center justify-center shrink-0">
            <FileSpreadsheet className="w-4 h-4" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-sm font-extrabold tracking-tight">
              JournalCheck Import &amp; ConvertJournal2 Wizard
            </h3>
            <p className="text-xs text-[#c7c9d1]">
              Supports 7-column CSV/TSV (multiline quoted titles) and raw PDF-to-Text Journal conversion
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close import wizard"
          className="p-1.5 text-[#c7c9d1] hover:text-[#ffee00] transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-6 space-y-6">
        {/* Expected 7-column schema bar */}
        <div className="bg-[#f6f7f9] border border-[#e2e4ea] p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div className="space-y-1">
            <div className="text-xs font-bold text-[#111111]">
              Required Import Column Schema (7 Columns)
            </div>
            <div className="text-xs font-mono text-[#4b505c] break-words">
              {JOURNAL_IMPORT_COLUMNS.join(' , ')}
            </div>
          </div>

          <button
            type="button"
            onClick={handleLoadAttachedSample}
            disabled={loadingSample}
            className="h-[36px] px-3.5 bg-white border border-[#cbd0da] hover:border-[#111111] text-xs font-bold text-[#111111] inline-flex items-center gap-2 shrink-0 whitespace-nowrap"
          >
            <Layers className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{loadingSample ? 'Loading CSV…' : 'Load Journal 909 Sample CSV'}</span>
          </button>
        </div>

        {/* Step 1: Source Mode Tabs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            type="button"
            onClick={() => setWizardMode('file')}
            className={`p-3.5 border text-left transition-colors flex items-start gap-3 ${
              wizardMode === 'file'
                ? 'bg-[#fffef0] border-[#111111] text-[#111111]'
                : 'bg-white border-[#e2e4ea] text-[#4b505c] hover:border-[#cbd0da]'
            }`}
          >
            <FileUp className="w-4 h-4 shrink-0 mt-0.5 text-[#111111]" aria-hidden="true" />
            <div>
              <div className="text-xs font-extrabold text-[#111111]">1. Upload CSV / TSV / TXT</div>
              <div className="text-[11.5px] text-[#555a66] mt-0.5">
                Auto-detects formatted CSV or raw Journal .txt
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setWizardMode('paste_table')}
            className={`p-3.5 border text-left transition-colors flex items-start gap-3 ${
              wizardMode === 'paste_table'
                ? 'bg-[#fffef0] border-[#111111] text-[#111111]'
                : 'bg-white border-[#e2e4ea] text-[#4b505c] hover:border-[#cbd0da]'
            }`}
          >
            <ClipboardPaste className="w-4 h-4 shrink-0 mt-0.5 text-[#111111]" aria-hidden="true" />
            <div>
              <div className="text-xs font-extrabold text-[#111111]">2. Paste Excel / CSV Rows</div>
              <div className="text-[11.5px] text-[#555a66] mt-0.5">
                Handles Excel copy-paste &amp; multiline quoted cells
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setWizardMode('convert_text')}
            className={`p-3.5 border text-left transition-colors flex items-start gap-3 ${
              wizardMode === 'convert_text'
                ? 'bg-[#fffef0] border-[#111111] text-[#111111]'
                : 'bg-white border-[#e2e4ea] text-[#4b505c] hover:border-[#cbd0da]'
            }`}
          >
            <FileText className="w-4 h-4 shrink-0 mt-0.5 text-[#111111]" aria-hidden="true" />
            <div>
              <div className="text-xs font-extrabold text-[#111111]">
                3. PDF-to-Text (ConvertJournal2)
              </div>
              <div className="text-[11.5px] text-[#555a66] mt-0.5">
                Direct browser equivalent of VBA ConvertJournal2()
              </div>
            </div>
          </button>
        </div>

        {/* Input Zone */}
        {wizardMode === 'file' && (
          <div className="border-2 border-dashed border-[#cbd0da] bg-[#f8f9fb] p-6 text-center space-y-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.tsv,.txt"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  handleFilePicked(f);
                  e.target.value = '';
                }
              }}
            />
            <p className="text-xs text-[#4b505c]">
              Select a <span className="font-semibold text-[#111111]">.csv / .tsv</span> spreadsheet export
              or a UTF-8 <span className="font-semibold text-[#111111]">.txt</span> file from your PDF-to-Text converter.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="builty-btn h-[38px] pl-4 pr-3 gap-2 text-xs"
              >
                <FileUp className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Choose File (.csv, .tsv, .txt)</span>
              </button>
              {sourceLabel && (
                <span className="text-xs font-semibold text-[#111111]">
                  Loaded: {sourceLabel}
                </span>
              )}
            </div>
          </div>
        )}

        {(wizardMode === 'paste_table' || wizardMode === 'convert_text') && (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="import-wizard-textarea"
                className="text-xs font-bold text-[#111111]"
              >
                {wizardMode === 'convert_text'
                  ? 'Paste raw PDF-to-Text output (records separated by "Advertised under section 28(1) of Trade Mark Ordinance 2001.")'
                  : 'Paste CSV or Tab-Separated Excel rows'}
              </label>
              {rawInput && (
                <button
                  type="button"
                  onClick={() => {
                    setRawInput('');
                    setSourceLabel('');
                  }}
                  className="text-xs text-[#555a66] hover:text-[#111111] underline"
                >
                  Clear Input
                </button>
              )}
            </div>
            <textarea
              id="import-wizard-textarea"
              rows={6}
              value={rawInput}
              onChange={(e) => {
                setRawInput(e.target.value);
                setSourceLabel('Pasted text');
              }}
              placeholder={
                wizardMode === 'convert_text'
                  ? 'Advertised under section 28(1) of Trade Mark Ordinance 2001.\nApplication No: 741275\nTitle ZINGO 15\nClass: 1\nName and address of Applicant: Gharbeen Seeds (Pvt.) Ltd...\nAgent’s name And address: A.A & Associates...\nDate of filing: 06/02/2024'
                  : 'Application No,Title,Class,Applicant Name and Address,Agent Name and Address,Date of Filing,Page No\n438315,"FEEDER",1,"Fakhshad Mahmood...",,"24-Nov-16",'
              }
              className="w-full bg-[#f8f9fb] border border-[#cbd0da] p-3 text-xs font-mono text-[#111111] focus:bg-white focus:outline-none focus:border-[#111111]"
            />
          </div>
        )}

        {errorMsg && (
          <div className="p-3 bg-red-50 border border-red-300 text-xs font-semibold text-red-800">
            {errorMsg}
          </div>
        )}

        {/* Cleaning / Normalization Options */}
        <div className="flex flex-wrap items-center gap-6 border-t border-b border-[#eceef2] py-3 text-xs text-[#111111]">
          <label className="inline-flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={normalizeDates}
              onChange={(e) => setNormalizeDates(e.target.checked)}
              className="w-4 h-4 accent-[#111111]"
            />
            <span className="font-semibold">Normalize Filing Dates to dd-MMM-yy</span>
          </label>

          <label className="inline-flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={extractEmbeddedPageNo}
              onChange={(e) => setExtractEmbeddedPageNo(e.target.checked)}
              className="w-4 h-4 accent-[#111111]"
            />
            <span className="font-semibold">
              Extract embedded Journal Page No &amp; strip page header artifacts
            </span>
          </label>
        </div>

        {/* Step 2: Live Preview */}
        {parsedResult.rows.length > 0 ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2 text-xs text-[#111111] tabular-nums">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />
                <span className="font-bold">
                  {parsedResult.rows.length} record(s) parsed
                </span>
                <span aria-hidden="true" className="text-[#9ca3af]">·</span>
                <span className="text-[#555a66]">
                  Parser:{' '}
                  {parsedResult.detectedFormat === 'journal_text'
                    ? 'ConvertJournal2 Raw Text'
                    : '7-Column CSV / TSV'}
                </span>
                <span aria-hidden="true" className="text-[#9ca3af]">·</span>
                <span className="text-[#555a66]">{parsedResult.elapsedMs} ms</span>
              </div>

              <button
                type="button"
                onClick={handleDownloadConvertedCsv}
                className="h-[34px] px-3 border border-[#cbd0da] bg-white hover:border-[#111111] text-xs font-semibold text-[#111111] inline-flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Download Formatted CSV</span>
              </button>
            </div>

            <div className="border border-[#e2e4ea] overflow-x-auto max-h-[300px]">
              <table className="w-full text-left border-collapse min-w-[920px] text-xs">
                <thead className="sticky top-0 bg-[#111111] text-white text-[11px] uppercase tracking-wider">
                  <tr>
                    <th className="py-2 px-3">App No</th>
                    <th className="py-2 px-3">Title</th>
                    <th className="py-2 px-3 text-center">Class</th>
                    <th className="py-2 px-3">Applicant Name and Address</th>
                    <th className="py-2 px-3">Agent Name and Address</th>
                    <th className="py-2 px-3">Date of Filing</th>
                    <th className="py-2 px-3 text-center">Page No</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eceef2] bg-white">
                  {previewRows.map((row) => (
                    <tr key={row.id} className="hover:bg-[#f7f8fa]">
                      <td className="py-2 px-3 font-mono font-bold text-[#111111] tabular-nums whitespace-nowrap">
                        {row.applicationNo || '—'}
                      </td>
                      <td className="py-2 px-3 font-semibold text-[#111111] max-w-[180px] truncate" title={row.title}>
                        {row.title || '—'}
                      </td>
                      <td className="py-2 px-3 text-center font-mono tabular-nums text-[#111111]">
                        {row.classNo || '—'}
                      </td>
                      <td className="py-2 px-3 text-[#4b505c] max-w-[260px] truncate" title={row.applicant}>
                        {row.applicant || '—'}
                      </td>
                      <td className="py-2 px-3 text-[#4b505c] max-w-[220px] truncate" title={row.agent}>
                        {row.agent || '—'}
                      </td>
                      <td className="py-2 px-3 font-mono tabular-nums text-[#111111] whitespace-nowrap">
                        {row.dateOfFiling || '—'}
                      </td>
                      <td className="py-2 px-3 text-center font-mono tabular-nums text-[#111111]">
                        {row.pageNo || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {parsedResult.rows.length > 50 && (
              <p className="text-[11.5px] text-[#555a66] tabular-nums">
                Showing first 50 of {parsedResult.rows.length} parsed rows in preview.
              </p>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <span className="text-xs text-[#555a66] tabular-nums">
                Current JournalCheck table has {existingCount} row(s).
              </span>
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="h-[38px] px-4 border border-[#cbd0da] bg-white text-xs font-semibold text-[#4b505c] hover:text-[#111111]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => onImport(parsedResult.rows, 'append')}
                  className="h-[38px] px-4 border border-[#111111] bg-white text-xs font-bold text-[#111111] hover:bg-[#f6f7f9]"
                >
                  Append {parsedResult.rows.length} Rows
                </button>
                <button
                  type="button"
                  onClick={() => onImport(parsedResult.rows, 'replace')}
                  className="builty-btn h-[38px] pl-4 pr-3 gap-2 text-xs"
                >
                  <span>Replace Table with {parsedResult.rows.length} Rows</span>
                </button>
              </div>
            </div>
          </div>
        ) : rawInput.trim() ? (
          <div className="p-4 bg-amber-50 border border-amber-300 text-xs text-amber-900">
            No valid trademark rows were detected in the current input. Switch input mode above or verify the column headers / section delimiter.
          </div>
        ) : null}
      </div>
    </section>
  );
}
