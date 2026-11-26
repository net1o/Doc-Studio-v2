import { useState } from 'react';
import { Download, RotateCcw, Search } from 'lucide-react';
import { JournalCheckRow, JournalConfig, RecordRow, ReviewRow } from '../types/journal';
import { buildCaseMap, exportRowsToCsv, triggerFileDownload } from '../lib/journal/engine';

interface BackupToolsViewProps {
  config: JournalConfig;
  journalRows: JournalCheckRow[];
  reviewRows: ReviewRow[];
  records: RecordRow[];
  onResetSampleData: () => void;
}

export function BackupToolsView({
  config,
  journalRows,
  reviewRows,
  records,
  onResetSampleData,
}: BackupToolsViewProps) {
  const [lookupInput, setLookupInput] = useState('');
  const caseMap = buildCaseMap(config.caseEntries);
  const lookupKeys = Object.keys(caseMap);
  const lookupResult = lookupInput.trim() ? caseMap[lookupInput.trim()] || 'NOT FOUND' : null;

  const exportDataset = (
    name: string,
    headers: string[],
    matrix: (string | number | boolean)[][],
    jsonPayload: unknown,
    format: 'csv' | 'json'
  ) => {
    const jn = config.journalNo || '909';
    if (format === 'csv') {
      const csv = exportRowsToCsv(headers, matrix);
      triggerFileDownload(csv, `${name}_Journal_${jn}.csv`, 'text/csv;charset=utf-8');
    } else {
      triggerFileDownload(
        JSON.stringify(jsonPayload, null, 2),
        `${name}_Journal_${jn}.json`,
        'application/json;charset=utf-8'
      );
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-[#e2e4ea] p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h2 className="text-xl font-extrabold tracking-tight text-[#111111]">
          Backup &amp; Export
        </h2>
        <button
          type="button"
          onClick={onResetSampleData}
          className="h-[38px] px-4 border border-[#cbd0da] bg-[#f8f9fb] hover:border-[#111111] hover:bg-white text-xs font-bold text-[#111111] inline-flex items-center gap-2 self-start sm:self-auto whitespace-nowrap"
        >
          <RotateCcw className="w-3.5 h-3.5 text-[#111111]" aria-hidden="true" />
          <span>Reset Sample Data</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white border border-[#e2e4ea] p-5 space-y-4">
          <div>
            <h3 className="text-base font-extrabold text-[#111111]">JournalCheck</h3>
            <p className="text-xs text-[#555a66] mt-1 tabular-nums">{journalRows.length} rows</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() =>
                exportDataset(
                  'JournalCheck',
                  ['Application No', 'Title', 'Class', 'Applicant Name and Address', 'Agent Name and Address', 'Date of Filing', 'Page No'],
                  journalRows.map((r) => [
                    r.applicationNo,
                    r.title,
                    r.classNo,
                    r.applicant,
                    r.agent,
                    r.dateOfFiling,
                    r.pageNo,
                  ]),
                  journalRows,
                  'csv'
                )
              }
              className="flex-1 py-2 bg-[#ffee00] text-[#111111] text-xs font-bold hover:bg-[#f2e000] inline-flex items-center justify-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" aria-hidden="true" />
              <span>CSV</span>
            </button>
            <button
              type="button"
              onClick={() => exportDataset('JournalCheck', [], [], journalRows, 'json')}
              className="flex-1 py-2 border border-[#cbd0da] bg-[#f8f9fb] text-[#111111] text-xs font-bold hover:border-[#111111] hover:bg-white"
            >
              JSON
            </button>
          </div>
        </div>

        <div className="bg-white border border-[#e2e4ea] p-5 space-y-4">
          <div>
            <h3 className="text-base font-extrabold text-[#111111]">Review Queue</h3>
            <p className="text-xs text-[#555a66] mt-1 tabular-nums">{reviewRows.length} rows</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() =>
                exportDataset(
                  'Review',
                  ['Journal No', 'Journal Date', 'Application No', 'Case No', 'Title', 'Class', 'Matched Term', 'Match Type', 'Decision', 'Status', 'Page No'],
                  reviewRows.map((r) => [
                    r.journalNo,
                    r.journalDate,
                    r.applicationNo,
                    r.caseNo,
                    r.title,
                    r.classNo,
                    r.matchedTerm,
                    r.matchType,
                    r.decision,
                    r.status,
                    r.pageNo,
                  ]),
                  reviewRows,
                  'csv'
                )
              }
              className="flex-1 py-2 bg-[#ffee00] text-[#111111] text-xs font-bold hover:bg-[#f2e000] inline-flex items-center justify-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" aria-hidden="true" />
              <span>CSV</span>
            </button>
            <button
              type="button"
              onClick={() => exportDataset('Review', [], [], reviewRows, 'json')}
              className="flex-1 py-2 border border-[#cbd0da] bg-[#f8f9fb] text-[#111111] text-xs font-bold hover:border-[#111111] hover:bg-white"
            >
              JSON
            </button>
          </div>
        </div>

        <div className="bg-white border border-[#e2e4ea] p-5 space-y-4">
          <div>
            <h3 className="text-base font-extrabold text-[#111111]">Records Ledger</h3>
            <p className="text-xs text-[#555a66] mt-1 tabular-nums">{records.length} records</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() =>
                exportDataset(
                  'Records',
                  ['Journal No', 'Journal Date', 'TM No', 'Case No', 'Class', 'Title', 'Decision', 'PDF Ready', 'Page No'],
                  records.map((r) => [
                    r.journalNo,
                    r.journalDate,
                    r.tmNo,
                    r.caseNo,
                    r.classNo,
                    r.title,
                    r.decision,
                    r.pdfReady,
                    r.pageNo,
                  ]),
                  records,
                  'csv'
                )
              }
              className="flex-1 py-2 bg-[#ffee00] text-[#111111] text-xs font-bold hover:bg-[#f2e000] inline-flex items-center justify-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" aria-hidden="true" />
              <span>CSV</span>
            </button>
            <button
              type="button"
              onClick={() => exportDataset('Records', [], [], records, 'json')}
              className="flex-1 py-2 border border-[#cbd0da] bg-[#f8f9fb] text-[#111111] text-xs font-bold hover:border-[#111111] hover:bg-white"
            >
              JSON
            </button>
          </div>
        </div>
      </div>

      {/* Test Case Lookup */}
      <div className="bg-white border border-[#e2e4ea] p-6 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-base font-extrabold text-[#111111]">Case Lookup Check</h3>
          <span className="text-xs text-[#111111] bg-[#ffee00] px-2 py-0.5 font-extrabold tabular-nums">
            {lookupKeys.length} keys
          </span>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          <div className="relative flex-1 max-w-sm">
            <Search
              className="w-4 h-4 text-[#6b7280] absolute left-3 top-1/2 -translate-y-1/2"
              aria-hidden="true"
            />
            <input
              type="text"
              value={lookupInput}
              onChange={(e) => setLookupInput(e.target.value)}
              placeholder="Enter 6-digit TM number…"
              className="w-full bg-[#f8f9fb] border border-[#cbd0da] pl-9 pr-3 py-2 text-xs text-[#111111] font-mono"
            />
          </div>
          {lookupResult && (
            <div className="px-3.5 py-2 bg-[#fffef0] border border-[#111111] text-xs">
              <span className="text-[#555a66]">Result: </span>
              <span className="font-bold text-[#111111]">{lookupResult}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
