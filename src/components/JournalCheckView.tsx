import { useMemo, useState } from 'react';
import { CalendarClock, FileUp, Play, Plus, Trash2 } from 'lucide-react';
import { JournalCheckRow, UniversalSettings } from '../types/journal';
import { BrandexButtonIcon } from './BrandexButtonIcon';
import { deduplicateJournalCheckRows } from '../lib/journal/engine';
import { JournalImportWizard } from './JournalImportWizard';
import {
  DeleteAllConfirmModal,
  TableControlsBar,
  TableSortInlinePanel,
} from './TableControlsBar';

interface JournalCheckViewProps {
  rows: JournalCheckRow[];
  pageSize?: number;
  defaultEditMode?: boolean;
  themeSettings?: UniversalSettings;
  onChangeRows: (rows: JournalCheckRow[]) => void;
  onNormalizeDates: () => void;
  onRunScan: () => void;
  onDeleteAllRows?: () => void;
  onNotify?: (message: string) => void;
}

type JournalSortField =
  | 'applicationNo'
  | 'title'
  | 'classNo'
  | 'applicant'
  | 'agent'
  | 'dateOfFiling'
  | 'pageNo';

export function JournalCheckView({
  rows,
  pageSize = 50,
  defaultEditMode = false,
  themeSettings,
  onChangeRows,
  onNormalizeDates,
  onRunScan,
  onDeleteAllRows,
  onNotify,
}: JournalCheckViewProps) {
  const safePageSize = Math.max(1, pageSize || 50);
  const [showWizard, setShowWizard] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [classFilter, setClassFilter] = useState('ALL');
  const [sortField, setSortField] = useState<JournalSortField>('applicationNo');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [sortFilterOpen, setSortFilterOpen] = useState(false);
  const [editMode, setEditMode] = useState(defaultEditMode);
  const [currentPage, setCurrentPage] = useState(1);
  const [confirmDeleteAllOpen, setConfirmDeleteAllOpen] = useState(false);

  const classOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      if (r.classNo.trim()) set.add(r.classNo.trim());
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [rows]);

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        if (classFilter !== 'ALL' && r.classNo.trim() !== classFilter) return false;
        const q = searchText.trim().toLowerCase();
        if (!q) return true;
        return (
          r.applicationNo.toLowerCase().includes(q) ||
          r.title.toLowerCase().includes(q) ||
          r.applicant.toLowerCase().includes(q) ||
          r.agent.toLowerCase().includes(q) ||
          r.pageNo.toLowerCase().includes(q)
        );
      }),
    [rows, searchText, classFilter]
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
    setCurrentPage(1);
  };

  const handleDeleteRow = (id: string) => {
    onChangeRows(rows.filter((r) => r.id !== id));
  };

  const handleDeleteAll = () => {
    const count = rows.length;
    if (onDeleteAllRows) {
      onDeleteAllRows();
    } else {
      onChangeRows([]);
      onNotify?.(`Deleted all ${count} JournalCheck row(s).`);
    }
    setConfirmDeleteAllOpen(false);
    setCurrentPage(1);
  };

  const handleWizardImport = (importedRows: JournalCheckRow[], mode: 'append' | 'replace') => {
    if (mode === 'replace') {
      const { uniqueRows, skippedDuplicates } = deduplicateJournalCheckRows(importedRows, []);
      onChangeRows(uniqueRows);
      onNotify?.(
        `Replaced JournalCheck with ${uniqueRows.length} row(s)${
          skippedDuplicates > 0 ? ` (${skippedDuplicates} duplicate skipped)` : ''
        }.`
      );
    } else {
      const { uniqueRows, skippedDuplicates } = deduplicateJournalCheckRows(importedRows, rows);
      onChangeRows([...uniqueRows, ...rows]);
      onNotify?.(
        `Appended ${uniqueRows.length} row(s) to JournalCheck${
          skippedDuplicates > 0 ? ` (${skippedDuplicates} duplicate skipped)` : ''
        }.`
      );
    }
    setCurrentPage(1);
    setShowWizard(false);
  };

  const renderEditableCell = (
    row: JournalCheckRow,
    field: keyof Omit<JournalCheckRow, 'id'>,
    className = ''
  ) => {
    const val = row[field];
    if (editMode) {
      return (
        <input
          type="text"
          value={val}
          onChange={(e) => handleCellChange(row.id, field, e.target.value)}
          className={`w-full bg-[#fffef0] border border-[#cbd0da] focus:border-[#111111] px-2 py-1 ${className}`}
        />
      );
    }
    return (
      <div
        contentEditable
        suppressContentEditableWarning
        onBlur={(e) => {
          const next = e.currentTarget.innerText.trim();
          if (next !== val.trim()) {
            handleCellChange(row.id, field, next === '—' ? '' : next);
          }
        }}
        className={`w-full min-h-[24px] px-2 py-1 outline-none focus:bg-[#fffef0] focus:ring-1 focus:ring-[#111111] ${className}`}
      >
        {val || '—'}
      </div>
    );
  };

  const activeFilterCount = (searchText.trim() ? 1 : 0) + (classFilter !== 'ALL' ? 1 : 0);

  return (
    <div className="space-y-5">
      <div className="bg-white border border-[#e2e4ea] p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <BrandexButtonIcon
            name="journalcheck"
            size={34}
            colorMode={themeSettings?.imageColorMode}
          />
          <h2 className="text-xl font-extrabold tracking-tight text-[#111111]">
            JournalCheck Table
          </h2>
          <span className="bg-[#ffee00] text-[#111111] px-2.5 py-0.5 text-xs font-extrabold tabular-nums">
            {rows.length} Rows
          </span>
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
            <span>Normalize Dates</span>
          </button>

          <button
            type="button"
            onClick={onRunScan}
            className="builty-btn h-[38px] pl-3 pr-2 gap-2 text-xs whitespace-nowrap"
          >
            <BrandexButtonIcon
              name="journalScan"
              variant="square"
              size={20}
              colorMode={themeSettings?.imageColorMode}
            />
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
          pageSize={safePageSize}
          onImport={handleWizardImport}
          onClose={() => setShowWizard(false)}
        />
      )}

      <div className="bg-white border border-[#e2e4ea] overflow-hidden">
        <div className="p-3.5 border-b border-[#e2e4ea] flex flex-wrap items-center justify-between gap-3">
          <input
            type="search"
            value={searchText}
            onChange={(e) => {
              setSearchText(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Filter by App No, Title, Applicant, Agent, or Page…"
            aria-label="Filter JournalCheck rows"
            className="w-full max-w-md bg-[#f8f9fb] border border-[#cbd0da] px-3.5 py-2 text-xs text-[#111111] focus:bg-white focus:outline-none focus:border-[#111111]"
          />
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
          onRequestDeleteAll={() => setConfirmDeleteAllOpen(true)}
          deleteAllDisabled={rows.length === 0}
        />

        {sortFilterOpen && (
          <div className="px-4 pb-3 pt-1 bg-[#f8f9fb] border-b border-[#e2e4ea]">
            <TableSortInlinePanel
              sortField={sortField}
              sortDir={sortDir}
              options={[
                { value: 'applicationNo', label: 'App No' },
                { value: 'title', label: 'Title' },
                { value: 'classNo', label: 'Class' },
                { value: 'applicant', label: 'Applicant' },
                { value: 'agent', label: 'Agent' },
                { value: 'dateOfFiling', label: 'Date of Filing' },
                { value: 'pageNo', label: 'Page No' },
              ]}
              onChangeSortField={(f) => {
                setSortField(f as JournalSortField);
                setCurrentPage(1);
              }}
              onToggleSortDir={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
              onResetFilters={() => {
                setSearchText('');
                setClassFilter('ALL');
                setSortField('applicationNo');
                setSortDir('asc');
                setCurrentPage(1);
              }}
            >
              <select
                value={classFilter}
                onChange={(e) => {
                  setClassFilter(e.target.value);
                  setCurrentPage(1);
                }}
                aria-label="Filter by Class"
                className="bg-white border border-[#cbd0da] px-2.5 py-1 text-xs font-bold text-[#111111]"
              >
                <option value="ALL">All Classes</option>
                {classOptions.map((c) => (
                  <option key={c} value={c}>
                    Class {c}
                  </option>
                ))}
              </select>
            </TableSortInlinePanel>
          </div>
        )}

        <div className="overflow-x-auto">
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
              {visibleRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-[#555a66]">
                    No rows match your filter. Click Import Wizard or Add Row above.
                  </td>
                </tr>
              ) : (
                visibleRows.map((row) => (
                  <tr key={row.id} className="hover:bg-[#f7f8fa]">
                    <td className="p-2">
                      {renderEditableCell(row, 'applicationNo', 'font-mono font-bold text-[#111111] tabular-nums')}
                    </td>
                    <td className="p-2">
                      {renderEditableCell(row, 'title', 'font-bold text-[#111111]')}
                    </td>
                    <td className="p-2">
                      {renderEditableCell(row, 'classNo', 'text-center font-mono text-[#111111] tabular-nums')}
                    </td>
                    <td className="p-2">
                      {renderEditableCell(row, 'applicant', 'text-[#374151]')}
                    </td>
                    <td className="p-2">
                      {renderEditableCell(row, 'agent', 'text-[#374151]')}
                    </td>
                    <td className="p-2">
                      {renderEditableCell(row, 'dateOfFiling', 'font-mono text-[#111111] tabular-nums')}
                    </td>
                    <td className="p-2">
                      {renderEditableCell(row, 'pageNo', 'text-center font-mono text-[#111111] tabular-nums')}
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

      <DeleteAllConfirmModal
        open={confirmDeleteAllOpen}
        title="Delete All JournalCheck Rows?"
        message={`This will remove all ${rows.length} row(s) from JournalCheck.`}
        onConfirm={handleDeleteAll}
        onCancel={() => setConfirmDeleteAllOpen(false)}
      />
    </div>
  );
}
