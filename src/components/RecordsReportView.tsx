import { useMemo, useState } from 'react';
import { FileText } from 'lucide-react';
import { JournalStats, RecordRow, UniversalSettings } from '../types/journal';
import { BrandexLogo } from './BrandexLogo';
import {
  DeleteAllConfirmModal,
  TableControlsBar,
  TableSortInlinePanel,
} from './TableControlsBar';

interface RecordsReportViewProps {
  records: RecordRow[];
  currentJournalNo: string;
  currentStats: JournalStats;
  allTimeStats: JournalStats;
  pageSize?: number;
  defaultEditMode?: boolean;
  themeSettings?: UniversalSettings;
  onOpenGeneratedDoc: (docId: string) => void;
  onUpdateRecord?: (id: string, patch: Partial<RecordRow>) => void;
  onDeleteAllRecords?: () => void;
}

type RecordSortField =
  | 'journalNo'
  | 'applicationNo'
  | 'caseNo'
  | 'title'
  | 'classNo'
  | 'decision'
  | 'pdfReady'
  | 'createdAt';

export function RecordsReportView({
  records,
  currentJournalNo,
  currentStats,
  allTimeStats,
  pageSize = 50,
  defaultEditMode = false,
  themeSettings,
  onOpenGeneratedDoc,
  onUpdateRecord,
  onDeleteAllRecords,
}: RecordsReportViewProps) {
  const safePageSize = Math.max(1, pageSize || 50);
  const [search, setSearch] = useState('');
  const [journalFilter, setJournalFilter] = useState<string>('ALL');
  const [recordFilter, setRecordFilter] = useState<'ALL' | 'TM' | 'KEYWORD' | 'PDF'>('ALL');
  const [sortField, setSortField] = useState<RecordSortField>('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [sortFilterOpen, setSortFilterOpen] = useState(false);
  const [editMode, setEditMode] = useState(defaultEditMode);
  const [currentPage, setCurrentPage] = useState(1);
  const [confirmDeleteAllOpen, setConfirmDeleteAllOpen] = useState(false);

  const journalSummaryList = (() => {
    const map = new Map<
      string,
      { journalNo: string; matches: number; issue: number; docs: number; records: number }
    >();
    for (const [jn, b] of Object.entries(allTimeStats.byJournal)) {
      map.set(jn, {
        journalNo: jn,
        matches: b.total,
        issue: b.issue,
        docs: b.docs,
        records: 0,
      });
    }
    for (const r of records) {
      const jn = r.journalNo.trim() || 'Unknown';
      const existing = map.get(jn) || {
        journalNo: jn,
        matches: 0,
        issue: 0,
        docs: 0,
        records: 0,
      };
      existing.records++;
      map.set(jn, existing);
    }
    if (!map.has(currentJournalNo)) {
      map.set(currentJournalNo, {
        journalNo: currentJournalNo,
        matches: currentStats.total,
        issue: currentStats.issue,
        docs: currentStats.docsGenerated,
        records: 0,
      });
    }
    return Array.from(map.values()).sort((a, b) =>
      b.journalNo.localeCompare(a.journalNo, undefined, { numeric: true })
    );
  })();

  const filtered = useMemo(
    () =>
      records.filter((r) => {
        if (journalFilter !== 'ALL' && (r.journalNo.trim() || 'Unknown') !== journalFilter) {
          return false;
        }
        if (recordFilter === 'TM' && r.matchType !== 'TM') return false;
        if (recordFilter === 'KEYWORD' && r.matchType !== 'KEYWORD') return false;
        if (recordFilter === 'PDF' && !r.pdfReady) return false;
        const q = search.trim().toLowerCase();
        if (!q) return true;
        return (
          r.applicationNo.toLowerCase().includes(q) ||
          r.caseNo.toLowerCase().includes(q) ||
          r.title.toLowerCase().includes(q) ||
          r.matchedTerm.toLowerCase().includes(q) ||
          r.journalNo.toLowerCase().includes(q)
        );
      }),
    [records, journalFilter, recordFilter, search]
  );

  const sorted = useMemo(() => {
    const copy = [...filtered];
    const dir = sortDir === 'asc' ? 1 : -1;
    copy.sort((a, b) => {
      if (sortField === 'pdfReady') {
        return ((a.pdfReady ? 1 : 0) - (b.pdfReady ? 1 : 0)) * dir;
      }
      const va = String(a[sortField] || '').trim();
      const vb = String(b[sortField] || '').trim();
      return va.localeCompare(vb, undefined, { numeric: true, sensitivity: 'base' }) * dir;
    });
    return copy;
  }, [filtered, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / safePageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const visibleRecords = useMemo(() => {
    const start = (safePage - 1) * safePageSize;
    return sorted.slice(start, start + safePageSize);
  }, [sorted, safePage, safePageSize]);

  const renderEditableCell = (
    rec: RecordRow,
    field: 'caseNo' | 'title' | 'classNo' | 'decision' | 'remarks',
    className = ''
  ) => {
    const val = rec[field];
    if (!onUpdateRecord) {
      return <span className={className}>{val || '—'}</span>;
    }
    if (editMode) {
      return (
        <input
          type="text"
          value={val}
          onChange={(e) => onUpdateRecord(rec.id, { [field]: e.target.value })}
          className={`w-full bg-[#fffef0] border border-[#cbd0da] focus:border-[#111111] px-1.5 py-0.5 text-xs ${className}`}
        />
      );
    }
    return (
      <span
        contentEditable
        suppressContentEditableWarning
        onBlur={(e) => {
          const next = e.currentTarget.innerText.trim();
          if (next !== val.trim()) {
            onUpdateRecord(rec.id, { [field]: next === '—' ? '' : next });
          }
        }}
        className={`outline-none focus:bg-[#fffef0] focus:px-1 ${className}`}
      >
        {val || '—'}
      </span>
    );
  };

  const decisionTotal = Math.max(1, allTimeStats.total);
  const matchTotal = Math.max(1, allTimeStats.tmMatches + allTimeStats.keywordMatches);

  const activeFilterCount =
    (search.trim() ? 1 : 0) +
    (journalFilter !== 'ALL' ? 1 : 0) +
    (recordFilter !== 'ALL' ? 1 : 0);

  return (
    <div className="space-y-8">
      {/* Summary Section */}
      <section className="space-y-4" aria-label="Monitoring report">
        <div className="flex flex-wrap items-center gap-2.5">
          <BrandexLogo
            variant="logo17Icon"
            size="sm"
            discColor={themeSettings?.uiDarkColor || '#111111'}
            accentColor={themeSettings?.uiAccentColor || '#f5c400'}
          />
          <h2 className="text-xl font-extrabold tracking-tight text-[#111111]">
            Monitoring Report
          </h2>
          <span className="bg-[#ffee00] text-[#111111] px-2.5 py-0.5 text-xs font-extrabold tabular-nums">
            Journal {currentJournalNo}
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white border border-[#e2e4ea] p-5 space-y-4">
            <h3 className="text-sm font-extrabold text-[#111111] uppercase tracking-wider border-b border-[#eceef2] pb-2.5">
              Journal {currentJournalNo} vs All-Time
            </h3>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#e2e4ea] text-[#555a66]">
                  <th className="py-2 text-left font-bold">Metric</th>
                  <th className="py-2 text-right font-bold">Journal {currentJournalNo}</th>
                  <th className="py-2 text-right font-bold">All-Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eceef2] tabular-nums">
                <tr>
                  <td className="py-2 text-[#374151]">Total Matches</td>
                  <td className="py-2 text-right font-extrabold text-[#111111]">{currentStats.total}</td>
                  <td className="py-2 text-right text-[#555a66]">{allTimeStats.total}</td>
                </tr>
                <tr>
                  <td className="py-2 text-[#374151]">TM Matches</td>
                  <td className="py-2 text-right font-extrabold text-[#111111]">{currentStats.tmMatches}</td>
                  <td className="py-2 text-right text-[#555a66]">{allTimeStats.tmMatches}</td>
                </tr>
                <tr>
                  <td className="py-2 text-[#374151]">Keyword Matches</td>
                  <td className="py-2 text-right font-extrabold text-[#111111]">{currentStats.keywordMatches}</td>
                  <td className="py-2 text-right text-[#555a66]">{allTimeStats.keywordMatches}</td>
                </tr>
                <tr>
                  <td className="py-2 text-[#374151]">Issue / Oppose</td>
                  <td className="py-2 text-right font-extrabold text-[#b45309]">{currentStats.issue}</td>
                  <td className="py-2 text-right font-bold text-[#b45309]">{allTimeStats.issue}</td>
                </tr>
                <tr>
                  <td className="py-2 text-[#374151]">Docs / PDFs Ready</td>
                  <td className="py-2 text-right font-extrabold text-[#111111]">
                    {currentStats.docsGenerated} / {currentStats.pdfsGenerated}
                  </td>
                  <td className="py-2 text-right text-[#555a66]">
                    {allTimeStats.docsGenerated} / {allTimeStats.pdfsGenerated}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="bg-white border border-[#e2e4ea] p-5 space-y-5">
            <h3 className="text-sm font-extrabold text-[#111111] uppercase tracking-wider border-b border-[#eceef2] pb-2.5">
              Decision &amp; Match Breakdown
            </h3>

            <div className="space-y-3">
              {[
                { label: 'Pending Review', val: allTimeStats.pending, color: 'bg-[#9ca3af]' },
                { label: 'Issue / Oppose', val: allTimeStats.issue, color: 'bg-[#eab308]' },
                { label: 'No Issue / Clear', val: allTimeStats.clear, color: 'bg-[#16a34a]' },
              ].map((item) => (
                <div key={item.label} className="space-y-1">
                  <div className="flex justify-between text-xs tabular-nums">
                    <span className="text-[#374151] font-medium">{item.label}</span>
                    <span className="font-bold text-[#111111]">
                      {item.val} ({Math.round((item.val / decisionTotal) * 100)}%)
                    </span>
                  </div>
                  <div className="h-2 bg-[#eceef2]">
                    <div
                      className={`h-full ${item.color}`}
                      style={{ width: `${Math.round((item.val / decisionTotal) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-[#eceef2] space-y-3">
              {[
                { label: 'TM Number Matches', val: allTimeStats.tmMatches, color: 'bg-[#111111]' },
                { label: 'Keyword Matches', val: allTimeStats.keywordMatches, color: 'bg-[#eab308]' },
              ].map((item) => (
                <div key={item.label} className="space-y-1">
                  <div className="flex justify-between text-xs tabular-nums">
                    <span className="text-[#374151] font-medium">{item.label}</span>
                    <span className="font-bold text-[#111111]">
                      {item.val} ({Math.round((item.val / matchTotal) * 100)}%)
                    </span>
                  </div>
                  <div className="h-2 bg-[#eceef2]">
                    <div
                      className={`h-full ${item.color}`}
                      style={{ width: `${Math.round((item.val / matchTotal) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Journal Archive Chips */}
      <section className="bg-white border border-[#e2e4ea] p-5 space-y-3" aria-label="Monthly Journal Archive">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#eceef2] pb-2.5">
          <h3 className="text-sm font-extrabold text-[#111111] uppercase tracking-wider">
            Journal Archive
          </h3>
          <span className="text-xs font-bold text-[#111111] bg-[#ffee00] px-2.5 py-0.5 tabular-nums">
            {journalSummaryList.length} Editions
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            data-sfx="filter"
            data-active={journalFilter === 'ALL'}
            onClick={() => {
              setJournalFilter('ALL');
              setCurrentPage(1);
            }}
            className={`builty-filter-btn px-3 py-2 border text-xs font-bold tabular-nums ${
              journalFilter === 'ALL'
                ? 'border-[#111111] bg-[#ffee00] text-[#111111]'
                : 'border-[#cbd0da] bg-[#f8f9fb] text-[#555a66] hover:text-[#111111]'
            }`}
          >
            All Journals ({records.length})
          </button>

          {journalSummaryList.map((j) => {
            const active = journalFilter === j.journalNo;
            return (
              <button
                key={j.journalNo}
                type="button"
                data-sfx="filter"
                data-active={active}
                onClick={() => {
                  setJournalFilter(j.journalNo);
                  setCurrentPage(1);
                }}
                className={`builty-filter-btn px-3 py-2 border text-xs font-bold tabular-nums text-left ${
                  active
                    ? 'border-[#111111] bg-[#ffee00] text-[#111111]'
                    : 'border-[#cbd0da] bg-white text-[#111111] hover:border-[#111111]'
                }`}
              >
                <span className="font-mono font-extrabold">Journal {j.journalNo}</span>
                <span className="text-[11px] font-semibold text-[#555a66] ml-2">
                  {j.matches} match · {j.records} rec
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Records Ledger */}
      <section className="space-y-4" aria-label="Generated records log">
        <div className="bg-white border border-[#e2e4ea] overflow-hidden">
          <div className="p-4 border-b border-[#e2e4ea] flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <h2 className="text-xl font-extrabold tracking-tight text-[#111111]">
              Records Ledger {journalFilter !== 'ALL' ? `— Journal ${journalFilter}` : ''}
            </h2>
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex items-center border border-[#cbd0da] bg-white">
                {(['ALL', 'TM', 'KEYWORD', 'PDF'] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    data-sfx="filter"
                    data-active={recordFilter === f}
                    onClick={() => {
                      setRecordFilter(f);
                      setCurrentPage(1);
                    }}
                    className={`builty-filter-btn px-3 py-2 text-xs font-bold whitespace-nowrap ${
                      recordFilter === f
                        ? 'bg-[#ffee00] text-[#111111]'
                        : 'text-[#555a66] hover:text-[#111111] hover:bg-[#f6f7f9]'
                    }`}
                  >
                    {f === 'PDF' ? 'PDF READY' : f}
                  </button>
                ))}
              </div>
              <input
                type="search"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Filter Journal, App No, Case No, or Title…"
                className="w-full sm:w-72 bg-[#f8f9fb] border border-[#cbd0da] px-3 py-2 text-xs text-[#111111] focus:bg-white focus:outline-none focus:border-[#111111]"
              />
            </div>
          </div>

          <TableControlsBar
            totalItems={sorted.length}
            pageSize={safePageSize}
            currentPage={safePage}
            onPageChange={setCurrentPage}
            sortFilterOpen={sortFilterOpen}
            onToggleSortFilter={() => setSortFilterOpen((o) => !o)}
            sortFilterActiveCount={activeFilterCount}
            editMode={editMode}
            onToggleEditMode={onUpdateRecord ? () => setEditMode((m) => !m) : undefined}
            onRequestDeleteAll={onDeleteAllRecords ? () => setConfirmDeleteAllOpen(true) : undefined}
            deleteAllDisabled={records.length === 0}
          />

          {sortFilterOpen && (
            <div className="px-4 pb-3 pt-1 bg-[#f8f9fb] border-b border-[#e2e4ea]">
              <TableSortInlinePanel
                sortField={sortField}
                sortDir={sortDir}
                options={[
                  { value: 'createdAt', label: 'Created Date' },
                  { value: 'journalNo', label: 'Journal No' },
                  { value: 'applicationNo', label: 'App No' },
                  { value: 'caseNo', label: 'Case No' },
                  { value: 'title', label: 'Title' },
                  { value: 'classNo', label: 'Class' },
                  { value: 'decision', label: 'Decision' },
                  { value: 'pdfReady', label: 'PDF Ready' },
                ]}
                onChangeSortField={(f) => {
                  setSortField(f as RecordSortField);
                  setCurrentPage(1);
                }}
                onToggleSortDir={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
                onResetFilters={() => {
                  setSearch('');
                  setJournalFilter('ALL');
                  setRecordFilter('ALL');
                  setSortField('createdAt');
                  setSortDir('desc');
                  setCurrentPage(1);
                }}
              />
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[960px]">
              <thead>
                <tr className="bg-[#111111] text-white text-[11.5px] font-extrabold uppercase tracking-wider">
                  <th className="py-2.5 px-3">Journal</th>
                  <th className="py-2.5 px-3">TM / App No</th>
                  <th className="py-2.5 px-3">Case No</th>
                  <th className="py-2.5 px-3">Title</th>
                  <th className="py-2.5 px-3 text-center">Class</th>
                  <th className="py-2.5 px-3">Decision</th>
                  <th className="py-2.5 px-3">Remarks</th>
                  <th className="py-2.5 px-3">PDF</th>
                  <th className="py-2.5 px-3 text-right">Document</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eceef2] text-xs">
                {visibleRecords.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-10 text-center text-[#555a66]">
                      No records yet. Mark Review rows MAILMERGE and generate documents.
                    </td>
                  </tr>
                ) : (
                  visibleRecords.map((rec) => (
                    <tr key={rec.id} className="hover:bg-[#f7f8fa]">
                      <td className="py-2.5 px-3 font-mono tabular-nums text-[#555a66]">
                        {rec.journalNo} ({rec.journalDate})
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-[#111111] tabular-nums">
                        {rec.applicationNo}
                      </td>
                      <td className="py-2.5 px-3 text-[#374151]">
                        {renderEditableCell(rec, 'caseNo')}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-[#111111]">
                        {renderEditableCell(rec, 'title')}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono tabular-nums text-[#111111]">
                        {renderEditableCell(rec, 'classNo', 'text-center')}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-[#92400e]">
                        {renderEditableCell(rec, 'decision')}
                      </td>
                      <td className="py-2.5 px-3 text-[#555a66]">
                        {renderEditableCell(rec, 'remarks')}
                      </td>
                      <td className="py-2.5 px-3 tabular-nums font-semibold text-[#374151]">
                        {rec.pdfReady ? 'PDF Ready' : 'Doc Only'}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => onOpenGeneratedDoc(rec.docId)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 border border-[#cbd0da] bg-[#f8f9fb] hover:border-[#111111] hover:bg-[#ffee00] text-xs font-bold text-[#111111] transition-colors"
                        >
                          <FileText className="w-3.5 h-3.5 text-[#111111]" aria-hidden="true" />
                          <span>Open Doc</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <DeleteAllConfirmModal
        open={confirmDeleteAllOpen}
        title="Delete All Records?"
        message={`This will permanently remove all ${records.length} record(s) from the Records Ledger.`}
        onConfirm={() => {
          onDeleteAllRecords?.();
          setConfirmDeleteAllOpen(false);
          setCurrentPage(1);
        }}
        onCancel={() => setConfirmDeleteAllOpen(false)}
      />
    </div>
  );
}
