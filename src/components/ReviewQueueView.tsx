import { useMemo, useState } from 'react';
import { CheckSquare, CopyCheck, FilePlus2, FileText } from 'lucide-react';
import { ReviewDecision, ReviewRow, ReviewStatus, UniversalSettings } from '../types/journal';
import { BrandexButtonIcon } from './BrandexButtonIcon';
import {
  DeleteAllConfirmModal,
  TableControlsBar,
  TableSortInlinePanel,
} from './TableControlsBar';

interface ReviewQueueViewProps {
  rows: ReviewRow[];
  pageSize?: number;
  defaultEditMode?: boolean;
  themeSettings?: UniversalSettings;
  onUpdateRow: (id: string, patch: Partial<ReviewRow>) => void;
  onBulkApplyStatusByAppNo: (
    applicationNo: string,
    status: ReviewStatus,
    visibleRowIds: string[]
  ) => void;
  onMarkIssuesMailmerge: () => void;
  onGenerateDocsFromMailmerge: () => void;
  onOpenDocInGenerator: (row: ReviewRow) => void;
  onDeleteAllRows?: () => void;
}

type ReviewSortField =
  | 'journalNo'
  | 'applicationNo'
  | 'caseNo'
  | 'title'
  | 'classNo'
  | 'matchedTerm'
  | 'pageNo'
  | 'decision'
  | 'status';

export function ReviewQueueView({
  rows,
  pageSize = 50,
  defaultEditMode = false,
  themeSettings,
  onUpdateRow,
  onBulkApplyStatusByAppNo,
  onMarkIssuesMailmerge,
  onGenerateDocsFromMailmerge,
  onOpenDocInGenerator,
  onDeleteAllRows,
}: ReviewQueueViewProps) {
  const safePageSize = Math.max(1, pageSize || 50);
  const [search, setSearch] = useState('');
  const [journalFilter, setJournalFilter] = useState<string>('ALL');
  const [matchFilter, setMatchFilter] = useState<'ALL' | 'TM' | 'KEYWORD'>('ALL');
  const [decisionFilter, setDecisionFilter] = useState<'ALL' | ReviewDecision>('ALL');
  const [sortField, setSortField] = useState<ReviewSortField>('applicationNo');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [sortFilterOpen, setSortFilterOpen] = useState(false);
  const [editMode, setEditMode] = useState(defaultEditMode);
  const [currentPage, setCurrentPage] = useState(1);
  const [confirmDeleteAllOpen, setConfirmDeleteAllOpen] = useState(false);
  const [openMenuRowId, setOpenMenuRowId] = useState<string | null>(null);

  const journalOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of rows) {
      const jn = r.journalNo.trim() || 'Unknown';
      counts.set(jn, (counts.get(jn) || 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([journalNo, count]) => ({ journalNo, count }))
      .sort((a, b) => b.journalNo.localeCompare(a.journalNo, undefined, { numeric: true }));
  }, [rows]);

  const mailmergeReadyCount = rows.filter(
    (r) => r.status === 'MAILMERGE' && !r.generatedDocId
  ).length;

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        if (journalFilter !== 'ALL' && (r.journalNo.trim() || 'Unknown') !== journalFilter) {
          return false;
        }
        if (matchFilter !== 'ALL' && r.matchType !== matchFilter) return false;
        if (decisionFilter !== 'ALL' && r.decision !== decisionFilter) return false;
        const q = search.trim().toLowerCase();
        if (!q) return true;
        return (
          r.applicationNo.toLowerCase().includes(q) ||
          r.caseNo.toLowerCase().includes(q) ||
          r.title.toLowerCase().includes(q) ||
          r.matchedTerm.toLowerCase().includes(q) ||
          r.applicant.toLowerCase().includes(q) ||
          r.journalNo.toLowerCase().includes(q)
        );
      }),
    [rows, journalFilter, matchFilter, decisionFilter, search]
  );

  const sorted = useMemo(() => {
    const copy = [...filtered];
    const dir = sortDir === 'asc' ? 1 : -1;
    copy.sort((a, b) => {
      const va = String(a[sortField] || '').trim();
      const vb = String(b[sortField] || '').trim();
      return va.localeCompare(vb, undefined, { numeric: true, sensitivity: 'base' }) * dir;
    });
    return copy;
  }, [filtered, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / safePageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const visibleRows = useMemo(() => {
    const start = (safePage - 1) * safePageSize;
    return sorted.slice(start, start + safePageSize);
  }, [sorted, safePage, safePageSize]);

  const visibleRowIds = useMemo(() => sorted.map((r) => r.id), [sorted]);

  const appNoCountsInView = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of sorted) {
      const key = r.applicationNo.trim();
      if (key) counts[key] = (counts[key] || 0) + 1;
    }
    return counts;
  }, [sorted]);

  const renderInlineCell = (
    row: ReviewRow,
    field: 'caseNo' | 'title' | 'applicant' | 'classNo' | 'matchedTerm' | 'pageNo',
    className = ''
  ) => {
    const val = row[field];
    if (editMode) {
      return (
        <input
          type="text"
          value={val}
          onChange={(e) => onUpdateRow(row.id, { [field]: e.target.value })}
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
            onUpdateRow(row.id, { [field]: next === '—' ? '' : next });
          }
        }}
        className={`outline-none focus:bg-[#fffef0] focus:px-1 ${className}`}
      >
        {val || '—'}
      </span>
    );
  };

  const activeFilterCount =
    (search.trim() ? 1 : 0) +
    (journalFilter !== 'ALL' ? 1 : 0) +
    (matchFilter !== 'ALL' ? 1 : 0) +
    (decisionFilter !== 'ALL' ? 1 : 0);

  return (
    <div className="space-y-5">
      <div className="bg-white border border-[#e2e4ea] p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <BrandexButtonIcon
            name="review"
            size={34}
            colorMode={themeSettings?.imageColorMode}
          />
          <h2 className="text-xl font-extrabold tracking-tight text-[#111111]">Review Queue</h2>
          <span className="bg-[#ffee00] text-[#111111] px-2.5 py-0.5 text-xs font-extrabold tabular-nums">
            {rows.length} Matches
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={onMarkIssuesMailmerge}
            className="h-[38px] px-3.5 border border-[#cbd0da] bg-[#f8f9fb] text-xs font-bold text-[#111111] hover:border-[#111111] hover:bg-white inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <CheckSquare className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Mark Issue MAILMERGE</span>
          </button>

          <button
            type="button"
            onClick={onGenerateDocsFromMailmerge}
            disabled={mailmergeReadyCount === 0}
            className="builty-btn h-[38px] pl-3 pr-2 gap-2 text-xs whitespace-nowrap"
          >
            <BrandexButtonIcon
              name="generator"
              size={20}
              colorMode={themeSettings?.imageColorMode}
            />
            <span>Generate Docs ({mailmergeReadyCount})</span>
            <span className="builty-btn-icon-tab w-6 h-6">
              <FilePlus2 className="w-3.5 h-3.5" aria-hidden="true" />
            </span>
          </button>
        </div>
      </div>

      <div className="bg-white border border-[#e2e4ea] overflow-hidden">
        {/* Filter Strip */}
        <div className="p-3.5 border-b border-[#e2e4ea] flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[260px]">
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search App No, Case No, Title, or Matched Term…"
              aria-label="Search Review rows"
              className="w-full max-w-sm bg-[#f8f9fb] border border-[#cbd0da] px-3 py-2 text-xs text-[#111111] focus:bg-white focus:outline-none focus:border-[#111111]"
            />

            <div className="flex items-center border border-[#cbd0da] bg-white">
              {(['ALL', 'TM', 'KEYWORD'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  data-sfx="filter"
                  data-active={matchFilter === t}
                  onClick={() => {
                    setMatchFilter(t);
                    setCurrentPage(1);
                  }}
                  className={`builty-filter-btn px-3 py-2 text-xs font-bold whitespace-nowrap ${
                    matchFilter === t
                      ? 'bg-[#ffee00] text-[#111111]'
                      : 'text-[#555a66] hover:text-[#111111] hover:bg-[#f6f7f9]'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            <select
              aria-label="Filter by journal number"
              value={journalFilter}
              onChange={(e) => {
                setJournalFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-white border border-[#cbd0da] px-3 py-2 text-xs font-bold text-[#111111]"
            >
              <option value="ALL">All Journals ({rows.length})</option>
              {journalOptions.map((opt) => (
                <option key={opt.journalNo} value={opt.journalNo}>
                  Journal {opt.journalNo} ({opt.count})
                </option>
              ))}
            </select>

            <select
              aria-label="Filter by decision"
              value={decisionFilter}
              onChange={(e) => {
                setDecisionFilter(e.target.value as 'ALL' | ReviewDecision);
                setCurrentPage(1);
              }}
              className="bg-white border border-[#cbd0da] px-3 py-2 text-xs font-semibold text-[#111111]"
            >
              <option value="ALL">All Decisions</option>
              <option value="PENDING REVIEW">PENDING REVIEW</option>
              <option value="ISSUE - OPPOSE">ISSUE - OPPOSE</option>
              <option value="NO ISSUE - CLEAR">NO ISSUE - CLEAR</option>
            </select>
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
          onToggleEditMode={() => setEditMode((m) => !m)}
          onRequestDeleteAll={onDeleteAllRows ? () => setConfirmDeleteAllOpen(true) : undefined}
          deleteAllDisabled={rows.length === 0}
        />

        {sortFilterOpen && (
          <div className="px-4 pb-3 pt-1 bg-[#f8f9fb] border-b border-[#e2e4ea]">
            <TableSortInlinePanel
              sortField={sortField}
              sortDir={sortDir}
              options={[
                { value: 'applicationNo', label: 'App No' },
                { value: 'journalNo', label: 'Journal No' },
                { value: 'caseNo', label: 'Case No' },
                { value: 'title', label: 'Title' },
                { value: 'classNo', label: 'Class' },
                { value: 'matchedTerm', label: 'Matched Term' },
                { value: 'pageNo', label: 'Page No' },
                { value: 'decision', label: 'Decision' },
                { value: 'status', label: 'Status' },
              ]}
              onChangeSortField={(f) => {
                setSortField(f as ReviewSortField);
                setCurrentPage(1);
              }}
              onToggleSortDir={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
              onResetFilters={() => {
                setSearch('');
                setJournalFilter('ALL');
                setMatchFilter('ALL');
                setDecisionFilter('ALL');
                setSortField('applicationNo');
                setSortDir('asc');
                setCurrentPage(1);
              }}
            />
          </div>
        )}

        {/* Review Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1120px]">
            <thead>
              <tr className="bg-[#111111] text-white text-[11.5px] font-extrabold uppercase tracking-wider">
                <th className="py-2.5 px-3">Jrn</th>
                <th className="py-2.5 px-3">App No</th>
                <th className="py-2.5 px-3">Case No</th>
                <th className="py-2.5 px-3">Title</th>
                <th className="py-2.5 px-3 text-center">Class</th>
                <th className="py-2.5 px-3">Matched</th>
                <th className="py-2.5 px-3 text-center">Page</th>
                <th className="py-2.5 px-3">Decision</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Doc</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eceef2] text-xs">
              {visibleRows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-10 text-center text-[#555a66]">
                    No Review rows found. Load JournalCheck data and click Run Scan.
                  </td>
                </tr>
              ) : (
                visibleRows.map((row) => (
                  <tr key={row.id} className="hover:bg-[#f7f8fa]">
                    <td className="py-2.5 px-3 font-mono text-[#555a66] tabular-nums">
                      {row.journalNo}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold text-[#111111] tabular-nums">
                      {row.applicationNo}
                    </td>
                    <td className="py-2.5 px-3 text-[#374151] max-w-[180px]" title={row.caseNo}>
                      {renderInlineCell(row, 'caseNo', 'font-semibold')}
                    </td>
                    <td className="py-2.5 px-3 space-y-0.5">
                      <div>{renderInlineCell(row, 'title', 'font-bold text-[#111111]')}</div>
                      <div className="text-[11px] text-[#555a66] max-w-[230px]">
                        {renderInlineCell(row, 'applicant')}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono font-semibold text-[#111111] tabular-nums">
                      {renderInlineCell(row, 'classNo', 'text-center')}
                    </td>
                    <td className="py-2.5 px-3">
                      <div>{renderInlineCell(row, 'matchedTerm', 'font-mono font-bold text-[#111111]')}</div>
                      <div className="text-[11px] text-[#555a66]">{row.matchType}</div>
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono text-[#555a66] tabular-nums">
                      {renderInlineCell(row, 'pageNo', 'text-center')}
                    </td>
                    <td className="py-2.5 px-3">
                      <select
                        aria-label={`Decision for ${row.applicationNo}`}
                        value={row.decision}
                        onChange={(e) =>
                          onUpdateRow(row.id, { decision: e.target.value as ReviewDecision })
                        }
                        className="bg-[#f8f9fb] border border-[#cbd0da] px-2 py-1.5 text-[11.5px] font-semibold text-[#111111]"
                      >
                        <option value="PENDING REVIEW">PENDING REVIEW</option>
                        <option value="ISSUE - OPPOSE">ISSUE - OPPOSE</option>
                        <option value="NO ISSUE - CLEAR">NO ISSUE - CLEAR</option>
                      </select>
                    </td>
                    <td className="py-2.5 px-3">
                      {(() => {
                        const appKey = row.applicationNo.trim();
                        const matchCount = appKey ? appNoCountsInView[appKey] || 0 : 0;
                        const menuOpen = openMenuRowId === row.id;
                        return (
                          <div className="relative flex items-center gap-1.5">
                            <select
                              aria-label={`Status for ${row.applicationNo}`}
                              value={row.status}
                              onChange={(e) =>
                                onUpdateRow(row.id, { status: e.target.value as ReviewStatus })
                              }
                              className={`border px-2 py-1.5 text-[11.5px] font-bold ${
                                row.status === 'GENERATED'
                                  ? 'bg-emerald-50 border-emerald-400 text-emerald-900'
                                  : row.status === 'MAILMERGE'
                                  ? 'bg-[#fffbeb] border-[#d97706] text-[#92400e]'
                                  : 'bg-[#f8f9fb] border-[#cbd0da] text-[#111111]'
                              }`}
                            >
                              <option value="REVIEW">REVIEW</option>
                              <option value="MAILMERGE">MAILMERGE</option>
                              <option value="GENERATED">GENERATED</option>
                            </select>

                            <button
                              type="button"
                              data-sfx="filter"
                              disabled={!appKey}
                              aria-label={`Bulk apply status for Application ${row.applicationNo}`}
                              onClick={() => setOpenMenuRowId(menuOpen ? null : row.id)}
                              className={`px-1.5 py-1.5 border text-[10.5px] font-bold inline-flex items-center gap-1 whitespace-nowrap ${
                                matchCount > 1
                                  ? 'border-[#111111] bg-[#fffef0] text-[#111111] hover:bg-[#ffee00]'
                                  : 'border-[#cbd0da] bg-[#f8f9fb] text-[#555a66] hover:border-[#111111] hover:text-[#111111]'
                              } disabled:opacity-40`}
                            >
                              <CopyCheck className="w-3.5 h-3.5" aria-hidden="true" />
                              {matchCount > 1 && <span className="tabular-nums">{matchCount}</span>}
                            </button>

                            {menuOpen && appKey && (
                              <div
                                role="menu"
                                className="absolute right-0 top-full mt-1 z-30 w-56 bg-white border border-[#111111] shadow-lg p-2 space-y-1.5"
                              >
                                <div className="text-[10.5px] font-extrabold text-[#111111] border-b border-[#eceef2] pb-1">
                                  App No {appKey} ({matchCount})
                                </div>
                                <button
                                  type="button"
                                  role="menuitem"
                                  onClick={() => {
                                    onBulkApplyStatusByAppNo(appKey, row.status, visibleRowIds);
                                    setOpenMenuRowId(null);
                                  }}
                                  className="w-full text-left px-2 py-1.5 bg-[#ffee00] hover:bg-[#f2e000] text-[#111111] text-[11px] font-extrabold"
                                >
                                  Apply &quot;{row.status}&quot; to all {matchCount}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setOpenMenuRowId(null)}
                                  className="w-full text-left px-2 py-1 text-[10.5px] font-semibold text-[#555a66] hover:text-[#111111]"
                                >
                                  Close
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </td>
                    <td className="py-2.5 px-3 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => onOpenDocInGenerator(row)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 border border-[#cbd0da] bg-[#f8f9fb] hover:border-[#111111] hover:bg-[#ffee00] text-[11.5px] font-bold text-[#111111] transition-colors"
                      >
                        <FileText className="w-3.5 h-3.5 text-[#111111]" aria-hidden="true" />
                        <span>
                          {row.generatedDocId
                            ? row.generatedPdfReady
                              ? 'Open (PDF Ready)'
                              : 'Open Doc'
                            : 'Create Doc'}
                        </span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <DeleteAllConfirmModal
        open={confirmDeleteAllOpen}
        title="Delete All Review Rows?"
        message={`This will clear all ${rows.length} row(s) from the Review Queue.`}
        onConfirm={() => {
          onDeleteAllRows?.();
          setConfirmDeleteAllOpen(false);
          setCurrentPage(1);
        }}
        onCancel={() => setConfirmDeleteAllOpen(false)}
      />
    </div>
  );
}
