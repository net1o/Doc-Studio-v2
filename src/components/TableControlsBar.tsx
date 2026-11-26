import { ReactNode, useEffect } from 'react';
import {
  AlertTriangle,
  ArrowDownUp,
  ChevronLeft,
  ChevronRight,
  Edit3,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react';

interface TableControlsBarProps {
  totalItems: number;
  pageSize: number;
  currentPage: number;
  onPageChange: (page: number) => void;
  sortFilterOpen?: boolean;
  onToggleSortFilter?: () => void;
  sortFilterActiveCount?: number;
  editMode?: boolean;
  onToggleEditMode?: () => void;
  onRequestDeleteAll?: () => void;
  deleteAllDisabled?: boolean;
  deleteAllLabel?: string;
  extraRight?: ReactNode;
  compact?: boolean;
}

export function TableControlsBar({
  totalItems,
  pageSize,
  currentPage,
  onPageChange,
  sortFilterOpen,
  onToggleSortFilter,
  sortFilterActiveCount = 0,
  editMode,
  onToggleEditMode,
  onRequestDeleteAll,
  deleteAllDisabled,
  deleteAllLabel = 'Delete All',
  extraRight,
  compact = false,
}: TableControlsBarProps) {
  const safePageSize = Math.max(1, pageSize || 50);
  const totalPages = Math.max(1, Math.ceil(totalItems / safePageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const startIdx = totalItems === 0 ? 0 : (safePage - 1) * safePageSize + 1;
  const endIdx = Math.min(totalItems, safePage * safePageSize);

  return (
    <div
      className={`bg-[#f8f9fb] border border-[#e2e4ea] ${
        compact ? 'px-3 py-2' : 'px-4 py-2.5'
      } flex flex-wrap items-center justify-between gap-2.5 text-xs`}
    >
      {/* Left: Sort & Filter, Edit Mode, Delete All */}
      <div className="flex flex-wrap items-center gap-2">
        {onToggleSortFilter && (
          <button
            type="button"
            data-sfx="filter"
            data-active={sortFilterOpen}
            onClick={onToggleSortFilter}
            className={`builty-filter-btn h-[32px] px-3 border text-[11.5px] font-bold inline-flex items-center gap-1.5 whitespace-nowrap ${
              sortFilterOpen || sortFilterActiveCount > 0
                ? 'border-[#111111] bg-[#ffee00] text-[#111111]'
                : 'border-[#cbd0da] bg-white text-[#111111] hover:border-[#111111]'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Sort &amp; Filter</span>
            {sortFilterActiveCount > 0 && (
              <span className="px-1.5 py-0.5 bg-[#111111] text-[#ffee00] text-[10px] font-extrabold leading-none tabular-nums">
                {sortFilterActiveCount}
              </span>
            )}
          </button>
        )}

        {onToggleEditMode && (
          <button
            type="button"
            data-sfx="filter"
            data-active={editMode}
            onClick={onToggleEditMode}
            title="Toggle inline Input / contentEditable editing mode"
            className={`builty-filter-btn h-[32px] px-3 border text-[11.5px] font-bold inline-flex items-center gap-1.5 whitespace-nowrap ${
              editMode
                ? 'border-[#111111] bg-[#111111] text-[#ffee00]'
                : 'border-[#cbd0da] bg-white text-[#111111] hover:border-[#111111]'
            }`}
          >
            <Edit3 className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{editMode ? 'Edit Mode: ON' : 'Input / Edit Mode'}</span>
          </button>
        )}

        {onRequestDeleteAll && (
          <button
            type="button"
            disabled={deleteAllDisabled ?? totalItems === 0}
            onClick={onRequestDeleteAll}
            className="h-[32px] px-3 border border-red-300 bg-red-50 hover:border-red-600 hover:bg-red-600 hover:text-white text-[11.5px] font-bold text-red-700 inline-flex items-center gap-1.5 whitespace-nowrap disabled:opacity-40"
          >
            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{deleteAllLabel}</span>
          </button>
        )}

        {extraRight}
      </div>

      {/* Right: 50-Row Summary + Back / Next Pagination */}
      <div className="flex flex-wrap items-center gap-2 ml-auto tabular-nums">
        <span className="text-[11.5px] font-semibold text-[#555a66] mr-1">
          {totalItems === 0
            ? '0 records'
            : `Showing ${startIdx}–${endIdx} of ${totalItems} (${safePageSize}/page)`}
        </span>

        <div className="inline-flex items-center border border-[#cbd0da] bg-white">
          <button
            type="button"
            disabled={safePage <= 1}
            onClick={() => onPageChange(Math.max(1, safePage - 1))}
            className="h-[30px] px-2.5 text-[11.5px] font-bold text-[#111111] hover:bg-[#ffee00] disabled:opacity-40 inline-flex items-center gap-1 border-r border-[#cbd0da]"
          >
            <ChevronLeft className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Back</span>
          </button>

          <span className="px-2.5 text-[11px] font-mono font-bold text-[#111111]">
            Page {safePage} / {totalPages}
          </span>

          <button
            type="button"
            disabled={safePage >= totalPages}
            onClick={() => onPageChange(Math.min(totalPages, safePage + 1))}
            className="h-[30px] px-2.5 text-[11.5px] font-bold text-[#111111] hover:bg-[#ffee00] disabled:opacity-40 inline-flex items-center gap-1 border-l border-[#cbd0da]"
          >
            <span>Next</span>
            <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}

interface SortBarOption {
  value: string;
  label: string;
}

interface TableSortInlinePanelProps {
  sortField: string;
  sortDir: 'asc' | 'desc';
  options: SortBarOption[];
  onChangeSortField: (field: string) => void;
  onToggleSortDir: () => void;
  onResetFilters?: () => void;
  children?: ReactNode;
}

export function TableSortInlinePanel({
  sortField,
  sortDir,
  options,
  onChangeSortField,
  onToggleSortDir,
  onResetFilters,
  children,
}: TableSortInlinePanelProps) {
  return (
    <div className="bg-[#fffef0] border border-[#111111] p-3 flex flex-wrap items-center gap-2.5 text-xs">
      <div className="inline-flex items-center gap-1.5">
        <ArrowDownUp className="w-3.5 h-3.5 text-[#111111]" aria-hidden="true" />
        <span className="font-extrabold text-[#111111]">Sort by:</span>
        <select
          value={sortField}
          onChange={(e) => onChangeSortField(e.target.value)}
          className="bg-white border border-[#cbd0da] px-2.5 py-1 text-xs font-bold text-[#111111] focus:border-[#111111]"
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          data-sfx="filter"
          onClick={onToggleSortDir}
          className="h-[28px] px-2.5 border border-[#111111] bg-white hover:bg-[#ffee00] text-[11px] font-extrabold text-[#111111]"
        >
          {sortDir === 'asc' ? 'ASC ↑' : 'DESC ↓'}
        </button>
      </div>

      {children}

      {onResetFilters && (
        <button
          type="button"
          onClick={onResetFilters}
          className="ml-auto h-[28px] px-2.5 border border-[#cbd0da] bg-white hover:border-[#111111] text-[11px] font-bold text-[#111111]"
        >
          Reset Filters
        </button>
      )}
    </div>
  );
}

interface DeleteAllConfirmModalProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeleteAllConfirmModal({
  open,
  title,
  message,
  confirmLabel = 'Confirm Delete All',
  onConfirm,
  onCancel,
}: DeleteAllConfirmModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="no-print fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md bg-white border border-[#111111] shadow-xl p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 bg-red-100 text-red-700 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-[#111111]">{title}</h3>
            <p className="text-xs text-[#555a66] mt-1">{message}</p>
          </div>
        </div>
        <div className="flex justify-end gap-2.5 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="h-[36px] px-4 border border-[#cbd0da] bg-white text-xs font-bold text-[#111111]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="h-[36px] px-4 bg-red-600 hover:bg-red-700 text-white text-xs font-extrabold"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
