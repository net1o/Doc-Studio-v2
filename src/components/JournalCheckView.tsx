import { useState } from 'react';
import { CalendarClock, FileUp, Play, Plus, Trash2 } from 'lucide-react';
import { JournalCheckRow } from '../types/journal';
import { deduplicateJournalCheckRows } from '../lib/journal/engine';
import { JournalImportWizard } from './JournalImportWizard';

interface JournalCheckViewProps {
  rows: JournalCheckRow[];
  onChangeRows: (rows: JournalCheckRow[]) => void;
  onNormalizeDates: () => void;
  onRunScan: () => void;
  onNotify?: (message: string) => void;
}

export function JournalCheckView({
  rows,
  onChangeRows,
  onNormalizeDates,
  onRunScan,
  onNotify,
}: JournalCheckViewProps) {
  const [showWizard, setShowWizard] = useState(false);
  const [searchText, setSearchText] = useState('');

  const filtered = rows.filter((r) => {
    const q = searchText.trim().toLowerCase();
    if (!q) return true;
    return (
      r.applicationNo.toLowerCase().includes(q) ||
      r.title.toLowerCase().includes(q) ||
      r.applicant.toLowerCase().includes(q) ||
      r.agent.toLowerCase().includes(q) ||
      r.pageNo.toLowerCase().includes(q)
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

  const handleWizardImport = (importedRows: JournalCheckRow[], mode: 'append' | 'replace') => {
    if (mode === 'replace') {
      const { uniqueRows, skippedDuplicates } = deduplicateJournalCheckRows(importedRows, []);
      onChangeRows(uniqueRows);
      onNotify?.(
        `Replaced JournalCheck table with ${uniqueRows.length} unique row(s)${
          skippedDuplicates > 0 ? ` (${skippedDuplicates} duplicate skipped)` : ''
        }.`
      );
    } else {
      const { uniqueRows, skippedDuplicates } = deduplicateJournalCheckRows(importedRows, rows);
      onChangeRows([...uniqueRows, ...rows]);
      onNotify?.(
        `Appended ${uniqueRows.length} new row(s) to JournalCheck${
          skippedDuplicates > 0 ? ` (${skippedDuplicates} duplicate(s) skipped)` : ''
        }.`
      );
    }
    setShowWizard(false);
  };

  return (
    <div className="space-y-5">
      <div className="bg-white border border-[#e2e4ea] p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight text-[#111111]">
            JournalCheck Input Table
          </h2>
          <p className="text-xs text-[#555a66] mt-1">
            Import 7-column CSV/TSV files, convert raw PDF-to-Text journals with ConvertJournal2, normalize filing dates, and run the scan.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleAddRow}
            className="h-[38px] px-3.5 border border-[#cbd0da] bg-[#f8f9fb] text-xs font-bold text-[#111111] hover:border-[#111111] hover:bg-white inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Add Row</span>
          </button>

          <button
            type="button"
            onClick={() => setShowWizard((prev) => !prev)}
            className={`h-[38px] px-3.5 border text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap transition-colors ${
              showWizard
                ? 'border-[#111111] bg-[#ffee00] text-[#111111]'
                : 'border-[#111111] bg-white text-[#111111] hover:bg-[#fffef0]'
            }`}
          >
            <FileUp className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{showWizard ? 'Hide Import Wizard' : 'Import Wizard'}</span>
          </button>

          <button
            type="button"
            onClick={onNormalizeDates}
            className="h-[38px] px-3.5 border border-[#cbd0da] bg-[#f8f9fb] text-xs font-bold text-[#111111] hover:border-[#111111] hover:bg-white inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <CalendarClock className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Re-normalize Dates</span>
          </button>

          <button
            type="button"
            onClick={onRunScan}
            className="builty-btn h-[38px] pl-4 pr-2 gap-2 text-xs whitespace-nowrap"
          >
            <span>Run Scan</span>
            <span className="builty-btn-icon-tab w-6 h-6">
              <Play className="w-3 h-3 fill-current" aria-hidden="true" />
            </span>
          </button>
        </div>
      </div>

      {showWizard && (
        <JournalImportWizard
          existingRows={rows}
          onImport={handleWizardImport}
          onClose={() => setShowWizard(false)}
        />
      )}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <input
          type="search"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          placeholder="Filter JournalCheck rows by App No, Title, Applicant, Agent, or Page…"
          aria-label="Filter JournalCheck rows"
          className="w-full max-w-md bg-white border border-[#cbd0da] px-3.5 py-2 text-xs text-[#111111] focus:outline-none focus:border-[#111111]"
        />
        <span className="text-xs font-semibold text-[#555a66] tabular-nums shrink-0">
          Showing {filtered.length} of {rows.length} rows
        </span>
      </div>

      <div className="bg-white border border-[#e2e4ea] overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[980px]">
          <thead>
            <tr className="bg-[#111111] text-white text-[11.5px] font-extrabold uppercase tracking-wider">
              <th className="py-2.5 px-3 w-[110px]">App No</th>
              <th className="py-2.5 px-3 w-[180px]">Title</th>
              <th className="py-2.5 px-3 w-[70px] text-center">Class</th>
              <th className="py-2.5 px-3">Applicant Name and Address</th>
              <th className="py-2.5 px-3">Agent Name and Address</th>
              <th className="py-2.5 px-3 w-[120px]">Date of Filing</th>
              <th className="py-2.5 px-3 w-[80px] text-center">Page No</th>
              <th className="py-2.5 px-3 w-[48px] text-center">Del</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#eceef2] text-xs">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-10 text-center text-[#555a66]">
                  No rows match your filter. Click <span className="font-bold text-[#111111]">Import Wizard</span> or <span className="font-bold text-[#111111]">Add Row</span> above.
                </td>
              </tr>
            ) : (
              filtered.map((row) => (
                <tr key={row.id} className="hover:bg-[#f7f8fa]">
                  <td className="p-2">
                    <input
                      type="text"
                      value={row.applicationNo}
                      onChange={(e) => handleCellChange(row.id, 'applicationNo', e.target.value)}
                      className="w-full bg-transparent border border-transparent focus:bg-[#fffef0] focus:border-[#111111] px-2 py-1 font-mono font-bold text-[#111111] tabular-nums"
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="text"
                      value={row.title}
                      onChange={(e) => handleCellChange(row.id, 'title', e.target.value)}
                      className="w-full bg-transparent border border-transparent focus:bg-[#fffef0] focus:border-[#111111] px-2 py-1 font-bold text-[#111111]"
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="text"
                      value={row.classNo}
                      onChange={(e) => handleCellChange(row.id, 'classNo', e.target.value)}
                      className="w-full bg-transparent border border-transparent focus:bg-[#fffef0] focus:border-[#111111] px-2 py-1 text-center font-mono text-[#111111] tabular-nums"
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="text"
                      value={row.applicant}
                      onChange={(e) => handleCellChange(row.id, 'applicant', e.target.value)}
                      className="w-full bg-transparent border border-transparent focus:bg-[#fffef0] focus:border-[#111111] px-2 py-1 text-[#374151]"
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="text"
                      value={row.agent}
                      onChange={(e) => handleCellChange(row.id, 'agent', e.target.value)}
                      className="w-full bg-transparent border border-transparent focus:bg-[#fffef0] focus:border-[#111111] px-2 py-1 text-[#374151]"
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="text"
                      value={row.dateOfFiling}
                      onChange={(e) => handleCellChange(row.id, 'dateOfFiling', e.target.value)}
                      className="w-full bg-transparent border border-transparent focus:bg-[#fffef0] focus:border-[#111111] px-2 py-1 font-mono text-[#111111] tabular-nums"
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="text"
                      value={row.pageNo}
                      onChange={(e) => handleCellChange(row.id, 'pageNo', e.target.value)}
                      className="w-full bg-transparent border border-transparent focus:bg-[#fffef0] focus:border-[#111111] px-2 py-1 text-center font-mono text-[#111111] tabular-nums"
                    />
                  </td>
                  <td className="p-2 text-center">
                    <button
                      type="button"
                      onClick={() => handleDeleteRow(row.id)}
                      aria-label={`Delete row ${row.applicationNo || row.title}`}
                      className="p-1.5 text-[#6b7280] hover:text-red-600"
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
