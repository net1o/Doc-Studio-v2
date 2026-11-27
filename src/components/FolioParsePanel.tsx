import { useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  FileSearch,
  FileUp,
  Loader2,
  Play,
  Trash2,
  X,
} from 'lucide-react';
import { JournalCheckRow } from '../types/journal';
import {
  deduplicateJournalCheckRows,
  exportRowsToCsv,
  JOURNAL_IMPORT_COLUMNS,
  triggerFileDownload,
} from '../lib/journal/engine';
import { FOLIO_BUILT_IN_PRESETS } from '../lib/folioparse/presets';
import {
  extractDocumentOffline,
  mapFolioParseResultsToJournalCheckRows,
} from '../lib/folioparse/offlineExtractor';
import type {
  FolioParseDocumentResult,
  OcrMode,
  SupportedMimeType,
} from '../lib/folioparse/types';

interface FolioParsePanelProps {
  existingRows: JournalCheckRow[];
  pageSize?: number;
  onImport: (rows: JournalCheckRow[], mode: 'append' | 'replace') => void;
  onClose: () => void;
}

const SUPPORTED_MIMES = new Set<string>([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/tiff',
]);

function inferMimeType(file: File): SupportedMimeType | null {
  if (SUPPORTED_MIMES.has(file.type)) {
    return file.type as SupportedMimeType;
  }
  const lower = file.name.toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.tif') || lower.endsWith('.tiff')) return 'image/tiff';
  return null;
}

export function FolioParsePanel({
  existingRows,
  pageSize = 50,
  onImport,
  onClose,
}: FolioParsePanelProps) {
  const safePageSize = Math.max(1, pageSize || 50);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedSchemaId, setSelectedSchemaId] = useState<string>('trademark_journal');
  const [startPage, setStartPage] = useState<number>(4);
  const [endPage, setEndPage] = useState<string>('');
  const [ocrMode, setOcrMode] = useState<OcrMode>('high_accuracy');
  const [enhanceScanContrast, setEnhanceScanContrast] = useState<boolean>(true);
  const [normalizeDates, setNormalizeDates] = useState<boolean>(true);

  const [queuedFiles, setQueuedFiles] = useState<Array<{ file: File; mimeType: SupportedMimeType }>>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [progressPct, setProgressPct] = useState(0);
  const [progressLabel, setProgressLabel] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [results, setResults] = useState<FolioParseDocumentResult[]>([]);
  const [previewTab, setPreviewTab] = useState<'table' | 'ocr'>('table');
  const [previewPage, setPreviewPage] = useState(1);

  const activeSchema = useMemo(
    () =>
      FOLIO_BUILT_IN_PRESETS.find((p) => p.id === selectedSchemaId) ||
      FOLIO_BUILT_IN_PRESETS[0],
    [selectedSchemaId]
  );

  const mappedRows = useMemo(
    () => mapFolioParseResultsToJournalCheckRows(results, normalizeDates),
    [results, normalizeDates]
  );

  const dedupeStats = useMemo(() => {
    const batchOnly = deduplicateJournalCheckRows(mappedRows, []);
    const againstExisting = deduplicateJournalCheckRows(mappedRows, existingRows);
    return {
      batchUniqueCount: batchOnly.uniqueRows.length,
      appendUniqueCount: againstExisting.uniqueRows.length,
      appendDupCount: againstExisting.skippedDuplicates,
    };
  }, [mappedRows, existingRows]);

  const detectedMetadata = useMemo(
    () => results.flatMap((r) => r.fields).slice(0, 12),
    [results]
  );

  const allOcrPages = useMemo(
    () =>
      results.flatMap((r) =>
        r.ocrPages.map((p) => ({
          fileName: r.fileName,
          ...p,
        }))
      ),
    [results]
  );

  const totalPages = Math.max(1, Math.ceil(mappedRows.length / safePageSize));
  const safePage = Math.min(previewPage, totalPages);
  const previewRows = useMemo(() => {
    const start = (safePage - 1) * safePageSize;
    return mappedRows.slice(start, start + safePageSize);
  }, [mappedRows, safePage, safePageSize]);

  const handleSelectFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setErrorMsg(null);
    const next: Array<{ file: File; mimeType: SupportedMimeType }> = [];
    const rejected: string[] = [];

    Array.from(fileList).forEach((file) => {
      const mime = inferMimeType(file);
      if (mime) {
        next.push({ file, mimeType: mime });
      } else {
        rejected.push(file.name);
      }
    });

    if (rejected.length > 0) {
      setErrorMsg(`Unsupported format skipped: ${rejected.join(', ')}`);
    }
    if (next.length > 0) {
      setQueuedFiles((prev) => [...prev, ...next]);
    }
  };

  const handleRunParse = async () => {
    if (queuedFiles.length === 0) return;
    setIsParsing(true);
    setErrorMsg(null);
    setProgressPct(0);
    setProgressLabel('Initializing FolioParse offline PDF/OCR engine…');

    const parsedDocs: FolioParseDocumentResult[] = [];
    const parsedEnd = endPage.trim() ? Math.max(startPage, Number(endPage) || startPage) : undefined;

    try {
      for (let idx = 0; idx < queuedFiles.length; idx++) {
        const item = queuedFiles[idx];
        const basePct = Math.round((idx / queuedFiles.length) * 100);
        const spanPct = Math.round(100 / queuedFiles.length);

        const doc = await extractDocumentOffline({
          file: item.file,
          mimeType: item.mimeType,
          schema: activeSchema,
          startPage: Math.max(1, startPage),
          endPage: parsedEnd,
          ocrMode,
          enhanceScanContrast,
          normalizeDates,
          onProgress: (pct, stage) => {
            setProgressPct(Math.min(100, basePct + Math.round((pct / 100) * spanPct)));
            setProgressLabel(`[${idx + 1}/${queuedFiles.length}] ${item.file.name}: ${stage}`);
          },
        });
        parsedDocs.push(doc);
      }

      setResults(parsedDocs);
      setPreviewPage(1);
      setPreviewTab('table');
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'FolioParse encountered an error while parsing the file.'
      );
    } finally {
      setIsParsing(false);
    }
  };

  const handleExportCsv = () => {
    if (mappedRows.length === 0) return;
    const csv = exportRowsToCsv(
      [...JOURNAL_IMPORT_COLUMNS],
      mappedRows.map((r) => [
        r.applicationNo,
        r.title,
        r.classNo,
        r.applicant,
        r.agent,
        r.dateOfFiling,
        r.pageNo,
      ])
    );
    triggerFileDownload(csv, 'FolioParse_JournalCheck.csv', 'text/csv;charset=utf-8');
  };

  return (
    <section
      aria-label="FolioParse PDF and OCR Journal Extractor"
      className="bg-white border border-[#111111] shadow-sm"
    >
      <div className="px-6 py-4 bg-[#111111] text-white flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[#ffee00] text-[#111111] flex items-center justify-center shrink-0">
            <FileSearch className="w-4 h-4" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-sm font-extrabold tracking-tight">
              FolioParse — PDF &amp; OCR Journal Extractor
            </h3>
            <p className="text-[11px] text-[#c7c9d1]">
              Offline multi-page Trade Marks Journal PDF &amp; scanned image parser mapped directly to JournalCheck
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close FolioParse panel"
          className="p-1.5 text-[#c7c9d1] hover:text-[#ffee00] transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-6 space-y-5">
        {/* Extraction Settings Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end bg-[#f8f9fb] border border-[#e2e4ea] p-4">
          <div className="md:col-span-4">
            <label htmlFor="fp-schema-select" className="block text-xs font-bold text-[#111111] mb-1">
              Schema Preset
            </label>
            <select
              id="fp-schema-select"
              value={selectedSchemaId}
              onChange={(e) => {
                const nextId = e.target.value;
                setSelectedSchemaId(nextId);
                const preset = FOLIO_BUILT_IN_PRESETS.find((p) => p.id === nextId);
                if (preset?.defaultStartPage) {
                  setStartPage(preset.defaultStartPage);
                }
              }}
              className="w-full bg-white border border-[#cbd0da] px-3 py-2 text-xs font-bold text-[#111111]"
            >
              {FOLIO_BUILT_IN_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label htmlFor="fp-start-page" className="block text-xs font-bold text-[#111111] mb-1">
              Start Page
            </label>
            <input
              id="fp-start-page"
              type="number"
              min={1}
              value={startPage}
              onChange={(e) => setStartPage(Math.max(1, Number(e.target.value) || 1))}
              className="w-full bg-white border border-[#cbd0da] px-2.5 py-2 text-xs font-mono font-bold text-[#111111]"
            />
          </div>

          <div className="md:col-span-2">
            <label htmlFor="fp-end-page" className="block text-xs font-bold text-[#111111] mb-1">
              End Page (Opt.)
            </label>
            <input
              id="fp-end-page"
              type="number"
              min={startPage}
              value={endPage}
              placeholder="All"
              onChange={(e) => setEndPage(e.target.value)}
              className="w-full bg-white border border-[#cbd0da] px-2.5 py-2 text-xs font-mono text-[#111111]"
            />
          </div>

          <div className="md:col-span-2">
            <label htmlFor="fp-ocr-mode" className="block text-xs font-bold text-[#111111] mb-1">
              OCR Mode
            </label>
            <select
              id="fp-ocr-mode"
              value={ocrMode}
              onChange={(e) => setOcrMode(e.target.value as OcrMode)}
              className="w-full bg-white border border-[#cbd0da] px-2.5 py-2 text-xs font-semibold text-[#111111]"
            >
              <option value="high_accuracy">High Accuracy</option>
              <option value="fast">Fast Scan</option>
            </select>
          </div>

          <div className="md:col-span-2 flex flex-col gap-1.5 text-[11px] font-semibold text-[#111111]">
            <label className="inline-flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={enhanceScanContrast}
                onChange={(e) => setEnhanceScanContrast(e.target.checked)}
                className="w-3.5 h-3.5 accent-[#111111]"
              />
              <span>Contrast OCR</span>
            </label>
            <label className="inline-flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={normalizeDates}
                onChange={(e) => setNormalizeDates(e.target.checked)}
                className="w-3.5 h-3.5 accent-[#111111]"
              />
              <span>dd-MMM-yy Dates</span>
            </label>
          </div>
        </div>

        {/* File Drop / Pick Area */}
        <div className="border-2 border-dashed border-[#cbd0da] bg-[#f8f9fb] p-5 space-y-3">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.png,.jpg,.jpeg,.webp,.tif,.tiff,application/pdf,image/*"
            className="hidden"
            onChange={(e) => {
              handleSelectFiles(e.target.files);
              e.target.value = '';
            }}
          />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="builty-btn h-[38px] pl-4 pr-3 gap-2 text-xs"
              >
                <FileUp className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Add Journal PDF / Scan Image</span>
              </button>

              {queuedFiles.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setQueuedFiles([]);
                    setResults([]);
                    setErrorMsg(null);
                  }}
                  className="h-[38px] px-3 border border-[#cbd0da] bg-white hover:border-[#111111] text-xs font-bold text-[#555a66] hover:text-[#111111]"
                >
                  Clear Files
                </button>
              )}
            </div>

            <button
              type="button"
              disabled={queuedFiles.length === 0 || isParsing}
              onClick={handleRunParse}
              className="h-[38px] px-4 bg-[#111111] text-[#ffee00] hover:bg-[#222222] disabled:opacity-40 text-xs font-extrabold inline-flex items-center gap-1.5"
            >
              {isParsing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Play className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
              )}
              <span>
                {isParsing
                  ? `Extracting (${progressPct}%)…`
                  : `Parse ${queuedFiles.length} File${queuedFiles.length === 1 ? '' : 's'}`}
              </span>
            </button>
          </div>

          {queuedFiles.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {queuedFiles.map((item, idx) => (
                <div
                  key={`${item.file.name}_${idx}`}
                  className="bg-white border border-[#cbd0da] px-2.5 py-1 text-xs flex items-center gap-2"
                >
                  <span className="font-mono font-bold text-[#111111] max-w-[220px] truncate">
                    {item.file.name}
                  </span>
                  <span className="text-[10.5px] text-[#555a66] font-mono">
                    {(item.file.size / 1024).toFixed(0)} KB
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setQueuedFiles((prev) => prev.filter((_, i) => i !== idx))
                    }
                    aria-label={`Remove ${item.file.name}`}
                    className="text-[#6b7280] hover:text-red-600"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {isParsing && (
            <div className="space-y-1.5 pt-1">
              <div className="flex justify-between text-[11px] font-bold text-[#111111]">
                <span>{progressLabel}</span>
                <span className="font-mono">{progressPct}%</span>
              </div>
              <div className="h-2 bg-[#e2e4ea] overflow-hidden">
                <div
                  className="h-full bg-[#111111] transition-all duration-200"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {errorMsg && (
          <div className="p-3 bg-red-50 border border-red-300 text-xs font-semibold text-red-800">
            {errorMsg}
          </div>
        )}

        {/* Results Section */}
        {results.length > 0 && (
          <div className="space-y-4">
            {detectedMetadata.length > 0 && (
              <div className="flex flex-wrap gap-2 bg-[#fffef0] border border-[#e2e4ea] p-3 text-xs">
                {detectedMetadata.map((f, i) => (
                  <span
                    key={`${f.key}_${i}`}
                    className="bg-white border border-[#cbd0da] px-2 py-0.5 text-[11px]"
                  >
                    <strong className="text-[#555a66] uppercase">{f.key}:</strong>{' '}
                    <span className="font-mono font-bold text-[#111111]">{f.value}</span>
                  </span>
                ))}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2 text-xs text-[#111111] tabular-nums">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />
                <span className="font-bold">
                  {mappedRows.length} JournalCheck record(s) extracted across {results.length} file(s)
                  {results.some((r) => r.ocrUsed) ? ' (OCR applied)' : ''}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex border border-[#cbd0da] bg-white">
                  <button
                    type="button"
                    data-sfx="filter"
                    onClick={() => setPreviewTab('table')}
                    className={`px-3 py-1 text-[11px] font-bold ${
                      previewTab === 'table'
                        ? 'bg-[#ffee00] text-[#111111]'
                        : 'text-[#555a66] hover:text-[#111111]'
                    }`}
                  >
                    Extracted Rows ({mappedRows.length})
                  </button>
                  <button
                    type="button"
                    data-sfx="filter"
                    onClick={() => setPreviewTab('ocr')}
                    className={`px-3 py-1 text-[11px] font-bold ${
                      previewTab === 'ocr'
                        ? 'bg-[#ffee00] text-[#111111]'
                        : 'text-[#555a66] hover:text-[#111111]'
                    }`}
                  >
                    Page Text ({allOcrPages.length})
                  </button>
                </div>

                {previewTab === 'table' && (
                  <div className="inline-flex items-center border border-[#cbd0da] bg-white">
                    <button
                      type="button"
                      disabled={safePage <= 1}
                      onClick={() => setPreviewPage((p) => Math.max(1, p - 1))}
                      className="h-[28px] px-2 text-[11px] font-bold text-[#111111] hover:bg-[#ffee00] disabled:opacity-40 inline-flex items-center gap-0.5 border-r border-[#cbd0da]"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Back</span>
                    </button>
                    <span className="px-2 text-[11px] font-mono font-bold text-[#111111]">
                      {safePage} / {totalPages}
                    </span>
                    <button
                      type="button"
                      disabled={safePage >= totalPages}
                      onClick={() => setPreviewPage((p) => Math.min(totalPages, p + 1))}
                      className="h-[28px] px-2 text-[11px] font-bold text-[#111111] hover:bg-[#ffee00] disabled:opacity-40 inline-flex items-center gap-0.5 border-l border-[#cbd0da]"
                    >
                      <span>Next</span>
                      <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleExportCsv}
                  disabled={mappedRows.length === 0}
                  className="h-[30px] px-3 border border-[#cbd0da] bg-white hover:border-[#111111] text-xs font-semibold text-[#111111] inline-flex items-center gap-1.5 disabled:opacity-40"
                >
                  <Download className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Export CSV</span>
                </button>
              </div>
            </div>

            {previewTab === 'table' ? (
              <div className="border border-[#e2e4ea] overflow-x-auto max-h-[320px]">
                <table className="w-full text-left border-collapse min-w-[920px] text-xs">
                  <thead className="sticky top-0 bg-[#111111] text-white text-[11px] uppercase tracking-wider">
                    <tr>
                      <th className="py-2 px-3">App No</th>
                      <th className="py-2 px-3">Title</th>
                      <th className="py-2 px-3 text-center">Class</th>
                      <th className="py-2 px-3">Applicant</th>
                      <th className="py-2 px-3">Agent</th>
                      <th className="py-2 px-3">Filing Date</th>
                      <th className="py-2 px-3 text-center">Page No</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#eceef2] bg-white">
                    {previewRows.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-[#555a66]">
                          No structured rows matched the selected schema. Check &quot;Page Text&quot; tab or adjust Start Page.
                        </td>
                      </tr>
                    ) : (
                      previewRows.map((row) => (
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
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="border border-[#e2e4ea] max-h-[320px] overflow-y-auto divide-y divide-[#eceef2] bg-[#f8f9fb]">
                {allOcrPages.map((p, i) => (
                  <div key={`${p.fileName}_${p.pageNumber}_${i}`} className="p-3 space-y-1">
                    <div className="flex justify-between text-[11px] font-bold text-[#111111]">
                      <span>
                        {p.fileName} — Page {p.pageNumber}
                      </span>
                      <span className="font-mono text-[#555a66]">{p.confidenceNote}</span>
                    </div>
                    <pre className="text-[11px] font-mono whitespace-pre-wrap text-[#374151] bg-white border border-[#e2e4ea] p-2">
                      {p.text || '—'}
                    </pre>
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <span className="text-xs text-[#555a66] tabular-nums">
                Append adds{' '}
                <strong className="text-[#111111]">{dedupeStats.appendUniqueCount} new</strong> (
                {dedupeStats.appendDupCount} duplicate skipped)
              </span>
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="h-[38px] px-4 border border-[#cbd0da] bg-white text-xs font-semibold text-[#4b505c] hover:text-[#111111]"
                >
                  Close
                </button>
                <button
                  type="button"
                  disabled={dedupeStats.appendUniqueCount === 0}
                  onClick={() => onImport(mappedRows, 'append')}
                  className="h-[38px] px-4 border border-[#111111] bg-white text-xs font-bold text-[#111111] hover:bg-[#f6f7f9] disabled:opacity-40"
                >
                  Append {dedupeStats.appendUniqueCount} New
                </button>
                <button
                  type="button"
                  disabled={dedupeStats.batchUniqueCount === 0}
                  onClick={() => onImport(mappedRows, 'replace')}
                  className="builty-btn h-[38px] pl-4 pr-3 gap-2 text-xs disabled:opacity-40"
                >
                  <span>Replace JournalCheck ({dedupeStats.batchUniqueCount})</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
