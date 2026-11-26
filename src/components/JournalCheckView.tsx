import { useRef, useState } from 'react';
import { CalendarClock, ClipboardPaste, FileUp, Play, Plus, Trash2 } from 'lucide-react';
import { JournalCheckRow } from '../types/journal';
import { parseDelimitedJournalInput } from '../lib/journal/engine';

interface JournalCheckViewProps {
  rows: JournalCheckRow[];
  onChangeRows: (rows: JournalCheckRow[]) => void;
  onNormalizeDates: () => void;
  onRunScan: () => void;
}

export function JournalCheckView({
  rows,
  onChangeRows,
  onNormalizeDates,
  onRunScan,
}: JournalCheckViewProps) {
  const [showPasteBox, setShowPasteBox] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [searchText, setSearchText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filtered = rows.filter((r) => {
    const q = searchText.trim().toLowerCase();
    if (!q) return true;
    return (
      r.applicationNo.toLowerCase().includes(q) ||
      r.title.toLowerCase().includes(q) ||
      r.applicant.toLowerCase().includes(q) ||
      r.agent.toLowerCase().includes(q)
    );
  });

  const handleCellChange = (
    id: string,
    field: keyof JournalCheckRow,
    value: string
  ) => {
    onChangeRows(rows.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  };

  const handleAddRow = () => {
    const newRow: JournalCheckRow = {
      id: `jc_${Date.now().toString(36)}`,
      applicationNo: '',
      title: '',
      classNo: '',
      applicant: '',
      agent: '',
      dateOfFiling: '',
      pageNo: '',
    };
    onChangeRows([newRow, ...rows]);
  };

  const handleDeleteRow = (id: string) => {
    onChangeRows(rows.filter((r) => r.id !== id));
  };

  const handleImportPaste = (replaceExisting: boolean) => {
    const parsed = parseDelimitedJournalInput(pasteText);
    if (parsed.length === 0) return;
    onChangeRows(replaceExisting ? parsed : [...parsed, ...rows]);
    setPasteText('');
    setShowPasteBox(false);
  };

  const handleUploadCsv = async (file: File) => {
    const text = await file.text();
    const parsed = parseDelimitedJournalInput(text);
    if (parsed.length > 0) {
      onChangeRows([...parsed, ...rows]);
    }
  };

  return (
    <div className="space-y-5">
      <div className="bg-[#0c0c0e] border border-[#2a2a30] p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">JournalCheck Input Table</h2>
          <p className="text-xs text-[#9c9ca6] mt-1">
            Paste VBA ConvertJournal2() output, upload CSV/TSV, normalize filing dates (dd-MMM-yy), and run the scan.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleAddRow}
            className="h-[38px] px-3.5 border border-[#3a3a42] bg-[#16161a] text-xs font-semibold text-white hover:border-[#ffee00] hover:text-[#ffee00] inline-flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Add Row</span>
          </button>

          <button
            type="button"
            onClick={() => setShowPasteBox((prev) => !prev)}
            className="h-[38px] px-3.5 border border-[#3a3a42] bg-[#16161a] text-xs font-semibold text-white hover:border-[#ffee00] hover:text-[#ffee00] inline-flex items-center gap-1.5"
          >
            <ClipboardPaste className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Paste CSV / TSV</span>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.tsv,.txt"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) {
                handleUploadCsv(f);
                e.target.value = '';
              }
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="h-[38px] px-3.5 border border-[#3a3a42] bg-[#16161a] text-xs font-semibold text-white hover:border-[#ffee00] hover:text-[#ffee00] inline-flex items-center gap-1.5"
          >
            <FileUp className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Import CSV</span>
          </button>

          <button
            type="button"
            onClick={onNormalizeDates}
            className="h-[38px] px-3.5 border border-[#3a3a42] bg-[#16161a] text-xs font-semibold text-white hover:border-[#ffee00] hover:text-[#ffee00] inline-flex items-center gap-1.5"
          >
            <CalendarClock className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Re-normalize Dates</span>
          </button>

          <button
            type="button"
            onClick={onRunScan}
            className="builty-btn h-[38px] pl-4 pr-2 gap-2 text-xs"
          >
            <span>Run Scan</span>
            <span className="builty-btn-icon-tab w-6 h-6">
              <Play className="w-3 h-3 fill-current" aria-hidden="true" />
            </span>
          </button>
        </div>
      </div>

      {showPasteBox && (
        <div className="bg-[#0c0c0e] border border-[#ffee00]/60 p-5 space-y-3">
          <p className="text-xs text-[#d0d0d8]">
            Paste tab-separated or comma-separated rows matching the 7 columns:
            <span className="text-[#ffee00] font-mono">
              {' '}Application No, Title, Class, Applicant Name and Address, Agent Name and Address, Date of Filing, Page No
            </span>
          </p>
          <textarea
            rows={5}
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder="554120&#9;NOVA SHIELD&#9;9&#9;Nova Labs Lahore&#9;Ali & Co&#9;18/11/2026&#9;212"
            className="w-full bg-[#16161a] border border-[#2f2f36] p-3 text-xs font-mono text-white focus:outline-none focus:border-[#ffee00]"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => handleImportPaste(false)}
              className="px-4 py-2 bg-[#ffee00] text-black text-xs font-bold hover:bg-[#e6d600]"
            >
              Append Rows
            </button>
            <button
              type="button"
              onClick={() => handleImportPaste(true)}
              className="px-4 py-2 border border-[#3a3a42] text-white text-xs font-semibold hover:border-[#ffee00]"
            >
              Replace Table
            </button>
            <button
              type="button"
              onClick={() => setShowPasteBox(false)}
              className="px-3 py-2 text-xs text-[#9c9ca6] hover:text-white"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-4">
        <input
          type="search"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          placeholder="Filter JournalCheck rows by App No, Title, Applicant, or Agent…"
          aria-label="Filter JournalCheck rows"
          className="w-full max-w-md bg-[#0c0c0e] border border-[#2a2a30] px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#ffee00]"
        />
        <span className="text-xs text-[#9c9ca6] tabular-nums shrink-0">
          Showing {filtered.length} of {rows.length} rows
        </span>
      </div>

      <div className="bg-[#0c0c0e] border border-[#2a2a30] overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[980px]">
          <thead>
            <tr className="bg-[#ffee00] text-black text-xs font-extrabold uppercase tracking-wider">
              <th className="py-2.5 px-3 w-[110px]">App No</th>
              <th className="py-2.5 px-3 w-[180px]">Title</th>
              <th className="py-2.5 px-3 w-[70px]">Class</th>
              <th className="py-2.5 px-3">Applicant Name and Address</th>
              <th className="py-2.5 px-3">Agent Name and Address</th>
              <th className="py-2.5 px-3 w-[115px]">Date of Filing</th>
              <th className="py-2.5 px-3 w-[80px]">Page No</th>
              <th className="py-2.5 px-3 w-[48px] text-center">Del</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1f1f24] text-xs">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-[#9c9ca6]">
                  No rows match your filter. Add a row or paste CSV/TSV data above.
                </td>
              </tr>
            ) : (
              filtered.map((row) => (
                <tr key={row.id} className="hover:bg-[#141418]">
                  <td className="p-2">
                    <input
                      type="text"
                      value={row.applicationNo}
                      onChange={(e) => handleCellChange(row.id, 'applicationNo', e.target.value)}
                      className="w-full bg-transparent border border-transparent focus:border-[#ffee00] px-2 py-1 font-mono text-white tabular-nums"
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="text"
                      value={row.title}
                      onChange={(e) => handleCellChange(row.id, 'title', e.target.value)}
                      className="w-full bg-transparent border border-transparent focus:border-[#ffee00] px-2 py-1 font-semibold text-white"
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="text"
                      value={row.classNo}
                      onChange={(e) => handleCellChange(row.id, 'classNo', e.target.value)}
                      className="w-full bg-transparent border border-transparent focus:border-[#ffee00] px-2 py-1 text-center text-white tabular-nums"
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="text"
                      value={row.applicant}
                      onChange={(e) => handleCellChange(row.id, 'applicant', e.target.value)}
                      className="w-full bg-transparent border border-transparent focus:border-[#ffee00] px-2 py-1 text-[#d0d0d8]"
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="text"
                      value={row.agent}
                      onChange={(e) => handleCellChange(row.id, 'agent', e.target.value)}
                      className="w-full bg-transparent border border-transparent focus:border-[#ffee00] px-2 py-1 text-[#d0d0d8]"
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="text"
                      value={row.dateOfFiling}
                      onChange={(e) => handleCellChange(row.id, 'dateOfFiling', e.target.value)}
                      className="w-full bg-transparent border border-transparent focus:border-[#ffee00] px-2 py-1 font-mono text-white tabular-nums"
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="text"
                      value={row.pageNo}
                      onChange={(e) => handleCellChange(row.id, 'pageNo', e.target.value)}
                      className="w-full bg-transparent border border-transparent focus:border-[#ffee00] px-2 py-1 text-center font-mono text-white tabular-nums"
                    />
                  </td>
                  <td className="p-2 text-center">
                    <button
                      type="button"
                      onClick={() => handleDeleteRow(row.id)}
                      aria-label={`Delete row ${row.applicationNo || row.title}`}
                      className="p-1.5 text-[#85858f] hover:text-[#ff5c5c]"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
