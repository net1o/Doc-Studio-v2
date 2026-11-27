import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
  CheckCircle2,
  Database,
  Download,
  Edit3,
  Eye,
  FileCode2,
  FileSpreadsheet,
  FileText,
  ImagePlus,
  LayoutDashboard,
  ListChecks,
  Palette,
  Plus,
  Printer,
  Trash2,
  X,
} from 'lucide-react';
import {
  AppTab,
  DocExtraDetailRow,
  GeneratedJournalDoc,
  ImageColorMode,
  PaperOrientation,
  PaperSizeConfig,
  PaperSizePreset,
  PaperUnit,
  UniversalSettings,
} from '../types/journal';
import {
  buildJournal909Html,
  buildJournal909WordDoc,
  DEFAULT_PAPER_SIZE,
  resolvePaperDimensionsIn,
  STANDARD_PAPER_SIZES,
} from '../lib/journal/journal909Template';
import { triggerFileDownload } from '../lib/journal/engine';
import { BrandexLogo } from './BrandexLogo';

interface Journal909GeneratorViewProps {
  docs: GeneratedJournalDoc[];
  selectedDocId: string | null;
  paperSize?: PaperSizeConfig;
  universalSettings?: UniversalSettings;
  activeTab: AppTab;
  watchlistCount: number;
  onSelectTab: (tab: AppTab) => void;
  onClearWatchlist: () => void;
  onExportReport: () => void;
  onChangePaperSize: (next: PaperSizeConfig) => void;
  onSelectDoc: (id: string) => void;
  onUpdateDoc: (id: string, patch: Partial<GeneratedJournalDoc>) => void;
  onCreateBlankDoc: () => void;
  onMarkPdfGenerated: (docId: string) => void;
}

export function Journal909GeneratorView({
  docs,
  selectedDocId,
  paperSize,
  universalSettings,
  activeTab,
  watchlistCount,
  onSelectTab,
  onClearWatchlist,
  onExportReport,
  onChangePaperSize,
  onSelectDoc,
  onUpdateDoc,
  onCreateBlankDoc,
  onMarkPdfGenerated,
}: Journal909GeneratorViewProps) {
  const [zoom, setZoom] = useState<'fit' | '75' | '100'>('75');
  const [previewInputMode, setPreviewInputMode] = useState<boolean>(false);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false);
  const [pdfPreviewZoom, setPdfPreviewZoom] = useState<'fit' | '75' | '100'>('75');
  const imageInputRef = useRef<HTMLInputElement>(null);
  const journalNoInputRef = useRef<HTMLInputElement>(null);
  const pdfIframeRef = useRef<HTMLIFrameElement>(null);

  const themePrimary = universalSettings?.docPrimaryColor || '#290076';
  const themeSecondary = universalSettings?.docSecondaryColor || '#4e1cb8';
  const themeAccent = universalSettings?.docAccentColor || '#f4580b';
  const defaultArtworkMode = universalSettings?.imageColorMode || 'theme';

  useEffect(() => {
    if (!confirmClearOpen && !pdfPreviewOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setConfirmClearOpen(false);
        setPdfPreviewOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [confirmClearOpen, pdfPreviewOpen]);

  const activeDoc = docs.find((d) => d.id === selectedDocId) || docs[0] || null;
  const activePaper = paperSize || DEFAULT_PAPER_SIZE;
  const resolvedDims = useMemo(() => resolvePaperDimensionsIn(activePaper), [activePaper]);

  const previewHtml = useMemo(() => {
    if (!pdfPreviewOpen || !activeDoc) return '';
    return buildJournal909Html(activeDoc, activePaper, universalSettings);
  }, [pdfPreviewOpen, activeDoc, activePaper, universalSettings]);

  const sidebarNavItems: { id: AppTab; label: string; icon: typeof LayoutDashboard }[] = [
    { id: 'analyzer', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'database', label: 'Database', icon: Database },
    { id: 'review', label: 'Review', icon: ListChecks },
    { id: 'generator', label: 'Generator', icon: FileText },
  ];

  const updatePaper = (patch: Partial<PaperSizeConfig>) => {
    onChangePaperSize({
      ...activePaper,
      ...patch,
    });
  };

  const handleImageUpload = (file: File) => {
    if (!activeDoc || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onUpdateDoc(activeDoc.id, { imageDataUrl: reader.result });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDownloadHtml = () => {
    if (!activeDoc) return;
    const html = buildJournal909Html(activeDoc, activePaper, universalSettings);
    const safeName = `${activeDoc.caseNo || activeDoc.serialNo}_${activeDoc.applicationNo || '909'}`
      .replace(/[^a-zA-Z0-9_-]+/g, '_');
    triggerFileDownload(html, `${safeName}_Journal909.html`, 'text/html;charset=utf-8');
  };

  const handleDownloadWord = () => {
    if (!activeDoc) return;
    const wordHtml = buildJournal909WordDoc(activeDoc, activePaper, universalSettings);
    const safeName = `${activeDoc.caseNo || activeDoc.serialNo}_${activeDoc.applicationNo || '909'}`
      .replace(/[^a-zA-Z0-9_-]+/g, '_');
    triggerFileDownload(wordHtml, `${safeName}_Journal909.doc`, 'application/msword;charset=utf-8');
  };

  const handlePrintPdf = () => {
    if (!activeDoc) return;
    onMarkPdfGenerated(activeDoc.id);
    window.print();
  };

  const handleAppendDetailRow = () => {
    if (!activeDoc) return;
    const nextRows: DocExtraDetailRow[] = [
      ...(activeDoc.extraRows || []),
      {
        id: `row_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
        label: 'DETAILS',
        value: '',
      },
    ];
    onUpdateDoc(activeDoc.id, { extraRows: nextRows });
  };

  const handleUpdateExtraRow = (rowId: string, patch: Partial<DocExtraDetailRow>) => {
    if (!activeDoc) return;
    const nextRows = (activeDoc.extraRows || []).map((r) =>
      r.id === rowId ? { ...r, ...patch } : r
    );
    onUpdateDoc(activeDoc.id, { extraRows: nextRows });
  };

  const handleRemoveExtraRow = (rowId: string) => {
    if (!activeDoc) return;
    onUpdateDoc(activeDoc.id, {
      extraRows: (activeDoc.extraRows || []).filter((r) => r.id !== rowId),
    });
  };

  if (!activeDoc) {
    return (
      <div className="bg-white border border-[#e2e4ea] p-10 text-center space-y-4">
        <BrandexLogo
          variant="logo17"
          size="lg"
          primaryColor={themePrimary}
          discColor={universalSettings?.uiDarkColor || '#111111'}
          accentColor={universalSettings?.uiAccentColor || '#f5c400'}
          className="mx-auto"
        />
        <h2 className="text-xl font-extrabold text-[#111111]">No Documents Yet</h2>
        <button
          type="button"
          onClick={onCreateBlankDoc}
          className="builty-btn h-[42px] pl-4 pr-3 gap-2 text-xs mx-auto"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          <span>Create Blank Document</span>
        </button>
      </div>
    );
  }

  const activeArtworkMode: ImageColorMode = activeDoc.imageColorMode || defaultArtworkMode;

  const scaleClass =
    zoom === '100'
      ? 'scale-100'
      : zoom === '75'
      ? 'scale-[0.76] origin-top'
      : 'scale-[0.65] sm:scale-[0.78] xl:scale-[0.88] origin-top';

  const pageCssVars = {
    '--j909-page-w': `${resolvedDims.widthIn}in`,
    '--j909-page-h': `${resolvedDims.heightIn}in`,
    '--j909-theme': themePrimary,
    '--j909-theme-light': themeSecondary,
    '--j909-heading': themeAccent,
    '--j909-content-pad': resolvedDims.compactLayout
      ? '0.42in 0.42in 0.34in 0.42in'
      : '0.62in 0.56in 0.48in 0.56in',
  } as CSSProperties;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
      {/* Dynamic Print Page Size CSS */}
      <style>{`@page { size: ${resolvedDims.widthIn}in ${resolvedDims.heightIn}in; margin: 0; }`}</style>

      {/* Left Control Rail */}
      <aside className="no-print xl:col-span-4 bg-white border border-[#e2e4ea] p-5 space-y-5">
        <div className="flex items-center justify-between gap-2 border-b border-[#eceef2] pb-3">
          <div className="flex items-center gap-2.5">
            <BrandexLogo
              variant="logo17Icon"
              size="sm"
              discColor={universalSettings?.uiDarkColor || '#111111'}
              accentColor={universalSettings?.uiAccentColor || '#f5c400'}
              className="shrink-0"
            />
            <div>
              <h2 className="text-base font-extrabold text-[#111111]">
                Journal {activeDoc.journalNo || '909'} ({resolvedDims.label})
              </h2>
              <p className="text-[11.5px] text-[#555a66]">Document Controls</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handlePrintPdf}
              title="Print Document"
              aria-label="Print Document"
              className="h-[32px] px-2.5 bg-[#111111] text-[#ffee00] hover:bg-[#2a2f3a] text-xs font-extrabold inline-flex items-center gap-1.5"
            >
              <Printer className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Print Document</span>
            </button>
            <button
              type="button"
              onClick={onCreateBlankDoc}
              className="h-[32px] px-2.5 bg-[#ffee00] text-[#111111] text-xs font-bold hover:bg-[#f2e000] inline-flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              <span>New</span>
            </button>
          </div>
        </div>

        {/* Vertical Navigation Menu + Quick Actions */}
        <div className="bg-[#f8f9fb] border border-[#e2e4ea] p-3 space-y-3">
          <nav aria-label="Sidebar quick navigation" className="grid grid-cols-2 gap-1.5">
            {sidebarNavItems.map((nav) => {
              const Icon = nav.icon;
              const isActive = activeTab === nav.id;
              return (
                <button
                  key={nav.id}
                  type="button"
                  data-sfx="filter"
                  data-active={isActive}
                  onClick={() => onSelectTab(nav.id)}
                  className={`builty-nav-tab flex items-center justify-between px-2.5 py-2 text-xs font-bold border text-left ${
                    isActive
                      ? 'bg-[#fffef0] border-[#111111] text-[#111111]'
                      : 'bg-white border-[#e2e4ea] text-[#555a66] hover:text-[#111111]'
                  }`}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>{nav.label}</span>
                  </span>
                </button>
              );
            })}
          </nav>

          <div className="border-t border-[#e2e4ea] pt-2.5 grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={watchlistCount === 0}
              onClick={() => setConfirmClearOpen(true)}
              className="h-[34px] px-2.5 border border-[#cbd0da] bg-white hover:border-red-600 hover:bg-red-50 hover:text-red-700 text-[11.5px] font-bold text-[#111111] inline-flex items-center justify-center gap-1.5 disabled:opacity-45"
            >
              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Clear Watchlist</span>
            </button>
            <button
              type="button"
              onClick={onExportReport}
              className="h-[34px] px-2.5 border border-[#cbd0da] bg-white hover:border-[#111111] hover:bg-[#fffef0] text-[11.5px] font-bold text-[#111111] inline-flex items-center justify-center gap-1.5"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Export Report</span>
            </button>
          </div>
        </div>

        {/* Document Picker */}
        <div>
          <label htmlFor="j909-doc-select" className="block text-xs font-bold text-[#374151] mb-1.5">
            Active Document ({docs.length})
          </label>
          <select
            id="j909-doc-select"
            value={activeDoc.id}
            onChange={(e) => onSelectDoc(e.target.value)}
            className="w-full bg-[#f8f9fb] border border-[#cbd0da] px-3 py-2 text-xs font-semibold text-[#111111] focus:bg-white focus:border-[#111111]"
          >
            {docs.map((d) => (
              <option key={d.id} value={d.id}>
                {d.serialNo} · {d.title || 'Untitled'} ({d.applicationNo || 'No App#'})
              </option>
            ))}
          </select>
        </div>

        {/* Paper Size & Custom Dimensions */}
        <div className="bg-[#f8f9fb] border border-[#e2e4ea] p-3.5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="j909-paper-preset" className="text-xs font-extrabold text-[#111111]">
              Paper Size
            </label>
            <span className="text-[11px] font-mono font-bold text-[#555a66] tabular-nums">
              {resolvedDims.widthIn}&quot; × {resolvedDims.heightIn}&quot;
            </span>
          </div>

          <select
            id="j909-paper-preset"
            value={activePaper.preset}
            onChange={(e) => {
              const preset = e.target.value as PaperSizePreset;
              if (preset !== 'custom') {
                const found = STANDARD_PAPER_SIZES.find((p) => p.id === preset);
                updatePaper({
                  preset,
                  customWidth: found ? found.widthIn : activePaper.customWidth,
                  customHeight: found ? found.heightIn : activePaper.customHeight,
                  customUnit: 'in',
                });
              } else {
                updatePaper({ preset: 'custom' });
              }
            }}
            className="w-full bg-white border border-[#cbd0da] px-2.5 py-2 text-xs font-semibold text-[#111111] focus:border-[#111111]"
          >
            {STANDARD_PAPER_SIZES.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label} — {p.dimensionsLabel}
              </option>
            ))}
            <option value="custom">Custom Dimensions…</option>
          </select>

          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-[#555a66]">Orientation</span>
            <div className="flex border border-[#cbd0da] bg-white">
              {(['portrait', 'landscape'] as PaperOrientation[]).map((ori) => (
                <button
                  key={ori}
                  type="button"
                  data-sfx="filter"
                  data-active={activePaper.orientation === ori}
                  onClick={() => updatePaper({ orientation: ori })}
                  className={`builty-filter-btn px-2.5 py-1 text-[11px] font-bold capitalize ${
                    activePaper.orientation === ori
                      ? 'bg-[#ffee00] text-[#111111]'
                      : 'text-[#555a66] hover:text-[#111111]'
                  }`}
                >
                  {ori}
                </button>
              ))}
            </div>
          </div>

          {activePaper.preset === 'custom' && (
            <div className="grid grid-cols-3 gap-2 pt-1 border-t border-[#e2e4ea]">
              <div>
                <label htmlFor="j909-custom-w" className="block text-[10.5px] font-bold text-[#555a66] mb-1">
                  Width
                </label>
                <input
                  id="j909-custom-w"
                  type="number"
                  step="0.01"
                  min={activePaper.customUnit === 'mm' ? 80 : 3}
                  max={activePaper.customUnit === 'mm' ? 760 : 30}
                  value={activePaper.customWidth}
                  onChange={(e) =>
                    updatePaper({ customWidth: Math.max(1, Number(e.target.value) || 8.5) })
                  }
                  className="w-full bg-white border border-[#cbd0da] px-2 py-1.5 text-xs font-mono text-[#111111]"
                />
              </div>
              <div>
                <label htmlFor="j909-custom-h" className="block text-[10.5px] font-bold text-[#555a66] mb-1">
                  Height
                </label>
                <input
                  id="j909-custom-h"
                  type="number"
                  step="0.01"
                  min={activePaper.customUnit === 'mm' ? 80 : 3}
                  max={activePaper.customUnit === 'mm' ? 915 : 36}
                  value={activePaper.customHeight}
                  onChange={(e) =>
                    updatePaper({ customHeight: Math.max(1, Number(e.target.value) || 14) })
                  }
                  className="w-full bg-white border border-[#cbd0da] px-2 py-1.5 text-xs font-mono text-[#111111]"
                />
              </div>
              <div>
                <label htmlFor="j909-custom-unit" className="block text-[10.5px] font-bold text-[#555a66] mb-1">
                  Unit
                </label>
                <select
                  id="j909-custom-unit"
                  value={activePaper.customUnit}
                  onChange={(e) => {
                    const nextUnit = e.target.value as PaperUnit;
                    if (nextUnit === activePaper.customUnit) return;
                    const factor = nextUnit === 'mm' ? 25.4 : 1 / 25.4;
                    updatePaper({
                      customUnit: nextUnit,
                      customWidth: Number((activePaper.customWidth * factor).toFixed(nextUnit === 'mm' ? 0 : 2)),
                      customHeight: Number((activePaper.customHeight * factor).toFixed(nextUnit === 'mm' ? 0 : 2)),
                    });
                  }}
                  className="w-full bg-white border border-[#cbd0da] px-2 py-1.5 text-xs font-bold text-[#111111]"
                >
                  <option value="in">in</option>
                  <option value="mm">mm</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Primary Generation & Print Controls */}
        <div className="space-y-2 pt-1">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrintPdf}
              className="builty-btn flex-1 justify-between h-[42px] pl-3.5 pr-2 text-xs"
            >
              <span className="truncate">Print / PDF ({resolvedDims.label})</span>
              <span className="builty-btn-icon-tab w-7 h-7 shrink-0">
                <Printer className="w-3.5 h-3.5" aria-hidden="true" />
              </span>
            </button>

            <button
              type="button"
              onClick={handlePrintPdf}
              title="Print Document (.j909-page)"
              aria-label="Print Document"
              className="h-[42px] w-[42px] border border-[#111111] bg-[#111111] text-[#ffee00] hover:bg-[#2a2f3a] inline-flex items-center justify-center shrink-0"
            >
              <Printer className="w-4 h-4" aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={() => setPdfPreviewOpen((prev) => !prev)}
              aria-pressed={pdfPreviewOpen}
              className={`h-[42px] px-3 border text-xs font-extrabold inline-flex items-center justify-center gap-1.5 shrink-0 ${
                pdfPreviewOpen
                  ? 'border-[#111111] bg-[#111111] text-[#ffee00]'
                  : 'border-[#111111] bg-[#fffef0] hover:bg-[#ffee00] text-[#111111]'
              }`}
            >
              <Eye className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Preview</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleDownloadHtml}
              className="h-[38px] px-3 border border-[#cbd0da] bg-[#f8f9fb] hover:border-[#111111] hover:bg-white text-xs font-bold text-[#111111] inline-flex items-center justify-center gap-1.5"
            >
              <FileCode2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Export HTML</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadWord}
              className="h-[38px] px-3 border border-[#cbd0da] bg-[#f8f9fb] hover:border-[#111111] hover:bg-white text-xs font-bold text-[#111111] inline-flex items-center justify-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Export Word</span>
            </button>
          </div>

          {activeDoc.pdfGenerated && (
            <p className="text-[11.5px] font-semibold text-emerald-700 inline-flex items-center gap-1.5 pt-1">
              <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
              PDF ready in Review &amp; Records
            </p>
          )}
        </div>

        {/* Editable Merge Fields */}
        <div className="space-y-3 border-t border-[#eceef2] pt-4">
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label htmlFor="j909-journal-no" className="block text-[11px] font-bold text-[#555a66] mb-1">
                Journal No
              </label>
              <div className="relative">
                <input
                  id="j909-journal-no"
                  ref={journalNoInputRef}
                  type="text"
                  value={activeDoc.journalNo}
                  onChange={(e) => onUpdateDoc(activeDoc.id, { journalNo: e.target.value })}
                  className="w-full bg-[#f8f9fb] border border-[#cbd0da] pl-2.5 pr-7 py-1.5 text-xs text-[#111111] focus:bg-white focus:border-[#111111] focus:outline-none"
                />
                {activeDoc.journalNo && (
                  <button
                    type="button"
                    aria-label="Clear Journal No"
                    onClick={() => {
                      onUpdateDoc(activeDoc.id, { journalNo: '' });
                      journalNoInputRef.current?.focus();
                    }}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 text-[#6b7280] hover:text-[#111111]"
                  >
                    <X className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[#555a66] mb-1">Journal Date</label>
              <input
                type="text"
                value={activeDoc.journalDate}
                onChange={(e) => onUpdateDoc(activeDoc.id, { journalDate: e.target.value })}
                className="w-full bg-[#f8f9fb] border border-[#cbd0da] px-2.5 py-1.5 text-xs text-[#111111] focus:bg-white focus:border-[#111111]"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-[#555a66] mb-1">Publishing Details</label>
            <textarea
              rows={3}
              value={activeDoc.publishingDetails}
              onChange={(e) => onUpdateDoc(activeDoc.id, { publishingDetails: e.target.value })}
              className="w-full bg-[#f8f9fb] border border-[#cbd0da] px-2.5 py-1.5 text-xs text-[#111111] focus:bg-white focus:border-[#111111]"
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[11px] font-bold text-[#555a66] mb-1">TITLE</label>
              <input
                type="text"
                value={activeDoc.title}
                onChange={(e) => onUpdateDoc(activeDoc.id, { title: e.target.value })}
                className="w-full bg-[#f8f9fb] border border-[#cbd0da] px-2.5 py-1.5 text-xs text-[#111111] focus:bg-white focus:border-[#111111]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[#555a66] mb-1">TRADEMARK</label>
              <input
                type="text"
                value={activeDoc.trademarkField}
                onChange={(e) => onUpdateDoc(activeDoc.id, { trademarkField: e.target.value })}
                className="w-full bg-[#f8f9fb] border border-[#cbd0da] px-2.5 py-1.5 text-xs text-[#111111] font-mono focus:bg-white focus:border-[#111111]"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-[11px] font-bold text-[#555a66] mb-1">CLASS</label>
              <input
                type="text"
                value={activeDoc.classNo}
                onChange={(e) => onUpdateDoc(activeDoc.id, { classNo: e.target.value })}
                className="w-full bg-[#f8f9fb] border border-[#cbd0da] px-2.5 py-1.5 text-xs text-[#111111] focus:bg-white focus:border-[#111111]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[#555a66] mb-1">Extra Label</label>
              <input
                type="text"
                value={activeDoc.extraLabel}
                onChange={(e) => onUpdateDoc(activeDoc.id, { extraLabel: e.target.value })}
                className="w-full bg-[#f8f9fb] border border-[#cbd0da] px-2.5 py-1.5 text-xs text-[#111111] focus:bg-white focus:border-[#111111]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[#555a66] mb-1">Extra Value</label>
              <input
                type="text"
                value={activeDoc.extraValue}
                onChange={(e) => onUpdateDoc(activeDoc.id, { extraValue: e.target.value })}
                className="w-full bg-[#f8f9fb] border border-[#cbd0da] px-2.5 py-1.5 text-xs text-[#111111] focus:bg-white focus:border-[#111111]"
              />
            </div>
          </div>
        </div>

        {/* Artwork Upload + Image Theme Color */}
        <div className="border-t border-[#eceef2] pt-4 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-[#374151]">Trademark Artwork</span>
            <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-[#555a66]">
              <Palette className="w-3 h-3" aria-hidden="true" />
              <span>Color: {activeArtworkMode}</span>
            </span>
          </div>
          <input
            ref={imageInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) {
                handleImageUpload(f);
                e.target.value = '';
              }
            }}
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              className="flex-1 h-[36px] px-3 border border-[#cbd0da] bg-[#f8f9fb] hover:border-[#111111] hover:bg-white text-xs font-bold text-[#111111] inline-flex items-center justify-center gap-1.5"
            >
              <ImagePlus className="w-3.5 h-3.5 text-[#111111]" aria-hidden="true" />
              <span>{activeDoc.imageDataUrl ? 'Replace Artwork' : 'Upload Artwork'}</span>
            </button>
            {activeDoc.imageDataUrl && (
              <button
                type="button"
                onClick={() => onUpdateDoc(activeDoc.id, { imageDataUrl: '' })}
                aria-label="Clear artwork"
                className="h-[36px] px-2.5 border border-[#cbd0da] bg-[#f8f9fb] text-[#555a66] hover:text-red-600"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="grid grid-cols-3 border border-[#cbd0da] bg-white">
            {(['theme', 'original', 'grayscale'] as ImageColorMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                data-sfx="filter"
                onClick={() => onUpdateDoc(activeDoc.id, { imageColorMode: mode })}
                className={`py-1.5 text-[11px] font-bold capitalize ${
                  activeArtworkMode === mode
                    ? 'bg-[#ffee00] text-[#111111]'
                    : 'text-[#555a66] hover:text-[#111111]'
                }`}
              >
                {mode === 'theme' ? 'Theme Tint' : mode}
              </button>
            ))}
          </div>
        </div>

        {/* Preview Scale */}
        <div className="border-t border-[#eceef2] pt-3 flex items-center justify-between text-xs">
          <span className="font-semibold text-[#555a66]">Preview Zoom</span>
          <div className="flex border border-[#cbd0da] bg-white">
            {(['fit', '75', '100'] as const).map((z) => (
              <button
                key={z}
                type="button"
                data-sfx="filter"
                data-active={zoom === z}
                onClick={() => setZoom(z)}
                className={`builty-filter-btn px-2.5 py-1 text-[11px] font-bold ${
                  zoom === z ? 'bg-[#ffee00] text-[#111111]' : 'text-[#555a66] hover:text-[#111111]'
                }`}
              >
                {z === 'fit' ? 'Fit' : `${z}%`}
              </button>
            ))}
          </div>
        </div>
      </aside>

      {/* Right Canvas: Document Preview Pane with Direct Inline Editing + Print Button */}
      <div className="xl:col-span-8 flex flex-col gap-3 min-w-0 print:col-span-12 print:block">
        {/* Preview Pane Direct Editing & Print Toolbar */}
        <div className="no-print bg-white border border-[#e2e4ea] px-4 py-2.5 flex flex-wrap items-center justify-between gap-2.5 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              data-sfx="filter"
              onClick={() => setPreviewInputMode((p) => !p)}
              className={`h-[32px] px-3 border text-[11.5px] font-bold inline-flex items-center gap-1.5 ${
                previewInputMode
                  ? 'border-[#111111] bg-[#111111] text-[#ffee00]'
                  : 'border-[#cbd0da] bg-[#f8f9fb] text-[#111111] hover:border-[#111111]'
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{previewInputMode ? 'Input Mode: ON' : 'Input / Override Mode'}</span>
            </button>

            <button
              type="button"
              onClick={handleAppendDetailRow}
              className="h-[32px] px-3 border border-[#cbd0da] bg-white hover:border-[#111111] hover:bg-[#fffef0] text-[11.5px] font-bold text-[#111111] inline-flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Append Detail Row</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-[#555a66] hidden sm:inline">
              Click any cell in the document to override directly
            </span>
            <button
              type="button"
              onClick={handlePrintPdf}
              title="Print Document"
              className="h-[32px] px-3 bg-[#ffee00] hover:bg-[#e6d600] text-[#111111] text-[11.5px] font-extrabold inline-flex items-center gap-1.5"
            >
              <Printer className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Print Document</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto flex justify-center bg-[#e9ebf0] border border-[#d4d7e0] p-4 sm:p-6 min-h-[760px] print:overflow-visible print:block print:bg-white print:border-0 print:p-0 print:min-h-0">
          <div className={`j909-print-wrapper ${scaleClass}`} style={pageCssVars}>
            <div className="j909-page" style={pageCssVars}>
              {/* Outer Frame & Corner Borders SVG colored by Theme */}
              <svg
                className="j909-frame-svg"
                viewBox="0 0 850 1400"
                preserveAspectRatio="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <polygon points="18,18 98,18 18,98" fill={themeSecondary} />
                <polygon points="18,108 108,18 134,18 18,134" fill={themePrimary} />
                <polygon points="776,18 832,18 832,74" fill={themePrimary} />
                <polygon points="750,18 766,18 832,84 832,100" fill="#b8b8b8" />
                <polygon points="18,1326 18,1382 74,1382" fill={themePrimary} />
                <polygon points="18,1300 18,1316 84,1382 100,1382" fill="#b8b8b8" />
                <polygon points="752,1382 832,1382 832,1302" fill={themeSecondary} />
                <polygon points="726,1382 742,1382 832,1292 832,1276" fill={themePrimary} />
                <line x1="138" y1="22" x2="742" y2="22" stroke="#b8b8b8" strokeWidth="2" />
                <line x1="120" y1="32" x2="764" y2="32" stroke={themePrimary} strokeWidth="4" />
                <line x1="86" y1="1368" x2="730" y2="1368" stroke={themePrimary} strokeWidth="4" />
                <line x1="108" y1="1378" x2="712" y2="1378" stroke="#b8b8b8" strokeWidth="2" />
                <line x1="20" y1="145" x2="20" y2="495" stroke={themePrimary} strokeWidth="3" />
                <line x1="20" y1="530" x2="20" y2="660" stroke={themeSecondary} strokeWidth="5" />
                <line x1="20" y1="680" x2="20" y2="715" stroke={themePrimary} strokeWidth="5" />
                <line x1="20" y1="735" x2="20" y2="1285" stroke="#b8b8b8" strokeWidth="2" />
                <line x1="28" y1="125" x2="28" y2="1305" stroke={themePrimary} strokeWidth="2" />
                <line x1="830" y1="115" x2="830" y2="500" stroke="#b8b8b8" strokeWidth="2" />
                <line x1="830" y1="530" x2="830" y2="660" stroke={themeSecondary} strokeWidth="5" />
                <line x1="830" y1="680" x2="830" y2="715" stroke={themePrimary} strokeWidth="5" />
                <line x1="830" y1="735" x2="830" y2="1265" stroke={themePrimary} strokeWidth="3" />
                <line x1="822" y1="95" x2="822" y2="1285" stroke={themePrimary} strokeWidth="2" />
              </svg>

              <div className="j909-content">
                {/* TOP HEADER */}
                <div className="j909-top-header">
                  <div className="j909-brand-left">
                    <svg
                      className="j909-pub-tag"
                      viewBox="0 0 120 165"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M22,2 L118,2 L118,162 L60,130 L2,162 L2,22 Z"
                        fill={themePrimary}
                      />
                      <path
                        d="M6,154 L60,124 L114,154"
                        fill="none"
                        stroke="#ffffff"
                        strokeWidth="1.5"
                      />
                      <circle cx="60" cy="14" r="5" fill="#ffffff" />
                      <text
                        x="60"
                        y="75"
                        textAnchor="middle"
                        fill="#ffffff"
                        fontFamily="Orbitron, sans-serif"
                        fontSize="27"
                        fontWeight="700"
                      >
                        {activeDoc.journalNo || '909'}
                      </text>
                      <line x1="26" y1="84" x2="94" y2="84" stroke="#ffffff" strokeWidth="1" />
                      <text
                        x="60"
                        y="103"
                        textAnchor="middle"
                        fill="#ffffff"
                        fontFamily="Chakra Petch, sans-serif"
                        fontSize="13.5"
                        fontWeight="600"
                        letterSpacing="0.5"
                      >
                        Publication
                      </text>
                    </svg>

                    <div className="j909-journal-info">
                      {previewInputMode ? (
                        <div className="space-y-1 mb-2">
                          <input
                            type="text"
                            value={activeDoc.journalNo}
                            onChange={(e) => onUpdateDoc(activeDoc.id, { journalNo: e.target.value })}
                            aria-label="Edit Journal No"
                            className="w-36 border border-[#cbd0da] px-2 py-0.5 text-sm font-bold text-[#111111]"
                          />
                          <input
                            type="text"
                            value={activeDoc.journalDate}
                            onChange={(e) => onUpdateDoc(activeDoc.id, { journalDate: e.target.value })}
                            aria-label="Edit Journal Date"
                            className="block w-44 border border-[#cbd0da] px-2 py-0.5 text-xs font-bold text-[#111111]"
                          />
                        </div>
                      ) : (
                        <>
                          <h1
                            className="j909-journal-title"
                            contentEditable
                            suppressContentEditableWarning
                            onBlur={(e) => {
                              const raw = e.currentTarget.innerText.replace(/^JOURNAL\s*/i, '').trim();
                              if (raw) onUpdateDoc(activeDoc.id, { journalNo: raw });
                            }}
                          >
                            JOURNAL {activeDoc.journalNo || '909'}
                          </h1>
                          <div
                            className="j909-journal-date"
                            contentEditable
                            suppressContentEditableWarning
                            onBlur={(e) =>
                              onUpdateDoc(activeDoc.id, { journalDate: e.currentTarget.innerText.trim() })
                            }
                          >
                            {activeDoc.journalDate || '26-Nov-2026'}
                          </div>
                        </>
                      )}
                      <div className="j909-accent-bar-wrap">
                        <div className="j909-accent-bar" />
                        <div className="j909-slashes j909-slashes-silver">
                          <span />
                          <span />
                          <span />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Publishing Details */}
                  <div className="j909-pub-details-wrap">
                    <div className="j909-banner-row">
                      <div className="j909-banner-slashes">
                        <span />
                      </div>
                      <div className="j909-banner-box">PUBLISHING DETAILS</div>
                    </div>
                    {previewInputMode ? (
                      <textarea
                        rows={3}
                        value={activeDoc.publishingDetails}
                        onChange={(e) =>
                          onUpdateDoc(activeDoc.id, { publishingDetails: e.target.value })
                        }
                        className="j909-pub-details-input w-full resize-none"
                      />
                    ) : (
                      <div
                        className="j909-pub-details-input"
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={(e) =>
                          onUpdateDoc(activeDoc.id, {
                            publishingDetails: e.currentTarget.innerText,
                          })
                        }
                      >
                        {activeDoc.publishingDetails}
                      </div>
                    )}
                  </div>
                </div>

                {/* APPLICATION DETAILS */}
                <div className="j909-app-section">
                  <div className="j909-app-header">
                    <div className="j909-app-banner">
                      <div className="j909-banner-slashes">
                        <span className="light" />
                      </div>
                      <div className="j909-app-banner-box">APPLICATION DETAILS</div>
                    </div>
                    <div className="j909-app-line" />
                    <div className="j909-slashes j909-slashes-silver">
                      <span />
                      <span />
                      <span />
                    </div>
                  </div>

                  <table className="j909-details-table">
                    <colgroup>
                      <col style={{ width: '13%' }} />
                      <col style={{ width: '40%' }} />
                      <col style={{ width: '18%' }} />
                      <col style={{ width: '29%' }} />
                    </colgroup>
                    <tbody>
                      <tr>
                        <td className="label-cell">TITLE</td>
                        <td className="value-cell">
                          {previewInputMode ? (
                            <input
                              type="text"
                              value={activeDoc.title}
                              onChange={(e) => onUpdateDoc(activeDoc.id, { title: e.target.value })}
                              className="w-full bg-[#fffef0] border border-[#cbd0da] px-1.5 py-0.5 text-sm font-bold text-[#111111]"
                            />
                          ) : (
                            <div
                              contentEditable
                              suppressContentEditableWarning
                              onBlur={(e) =>
                                onUpdateDoc(activeDoc.id, { title: e.currentTarget.innerText })
                              }
                            >
                              {activeDoc.title}
                            </div>
                          )}
                        </td>
                        <td className="label-cell">TRADEMARK</td>
                        <td className="value-cell">
                          {previewInputMode ? (
                            <input
                              type="text"
                              value={activeDoc.trademarkField}
                              onChange={(e) =>
                                onUpdateDoc(activeDoc.id, { trademarkField: e.target.value })
                              }
                              className="w-full bg-[#fffef0] border border-[#cbd0da] px-1.5 py-0.5 text-sm font-mono text-[#111111]"
                            />
                          ) : (
                            <div
                              contentEditable
                              suppressContentEditableWarning
                              onBlur={(e) =>
                                onUpdateDoc(activeDoc.id, {
                                  trademarkField: e.currentTarget.innerText,
                                })
                              }
                            >
                              {activeDoc.trademarkField}
                            </div>
                          )}
                        </td>
                      </tr>
                      <tr>
                        <td className="label-cell">CLASS</td>
                        <td className="value-cell">
                          {previewInputMode ? (
                            <input
                              type="text"
                              value={activeDoc.classNo}
                              onChange={(e) => onUpdateDoc(activeDoc.id, { classNo: e.target.value })}
                              className="w-full bg-[#fffef0] border border-[#cbd0da] px-1.5 py-0.5 text-sm text-[#111111]"
                            />
                          ) : (
                            <div
                              contentEditable
                              suppressContentEditableWarning
                              onBlur={(e) =>
                                onUpdateDoc(activeDoc.id, { classNo: e.currentTarget.innerText })
                              }
                            >
                              {activeDoc.classNo}
                            </div>
                          )}
                        </td>
                        <td
                          className="label-cell"
                          contentEditable={!previewInputMode}
                          suppressContentEditableWarning
                          onBlur={(e) =>
                            onUpdateDoc(activeDoc.id, { extraLabel: e.currentTarget.innerText })
                          }
                        >
                          {previewInputMode ? (
                            <input
                              type="text"
                              value={activeDoc.extraLabel}
                              onChange={(e) =>
                                onUpdateDoc(activeDoc.id, { extraLabel: e.target.value })
                              }
                              className="w-full bg-white/80 border border-[#111111] px-1 py-0.5 text-xs font-bold text-center text-[#111111]"
                            />
                          ) : (
                            activeDoc.extraLabel
                          )}
                        </td>
                        <td className="value-cell">
                          {previewInputMode ? (
                            <input
                              type="text"
                              value={activeDoc.extraValue}
                              onChange={(e) =>
                                onUpdateDoc(activeDoc.id, { extraValue: e.target.value })
                              }
                              className="w-full bg-[#fffef0] border border-[#cbd0da] px-1.5 py-0.5 text-sm text-[#111111]"
                            />
                          ) : (
                            <div
                              contentEditable
                              suppressContentEditableWarning
                              onBlur={(e) =>
                                onUpdateDoc(activeDoc.id, {
                                  extraValue: e.currentTarget.innerText,
                                })
                              }
                            >
                              {activeDoc.extraValue}
                            </div>
                          )}
                        </td>
                      </tr>

                      {/* Appended Custom Detail Rows inside Document Preview */}
                      {(activeDoc.extraRows || []).map((row) => (
                        <tr key={row.id}>
                          <td className="label-cell">
                            {previewInputMode ? (
                              <input
                                type="text"
                                value={row.label}
                                onChange={(e) =>
                                  handleUpdateExtraRow(row.id, { label: e.target.value })
                                }
                                className="w-full bg-white/80 border border-[#111111] px-1 py-0.5 text-xs font-bold text-center text-[#111111]"
                              />
                            ) : (
                              <div
                                contentEditable
                                suppressContentEditableWarning
                                onBlur={(e) =>
                                  handleUpdateExtraRow(row.id, { label: e.currentTarget.innerText })
                                }
                              >
                                {row.label}
                              </div>
                            )}
                          </td>
                          <td className="value-cell" colSpan={3}>
                            <div className="flex items-center justify-between gap-2">
                              {previewInputMode ? (
                                <input
                                  type="text"
                                  value={row.value}
                                  placeholder="Enter detail value…"
                                  onChange={(e) =>
                                    handleUpdateExtraRow(row.id, { value: e.target.value })
                                  }
                                  className="flex-1 bg-[#fffef0] border border-[#cbd0da] px-1.5 py-0.5 text-sm text-[#111111]"
                                />
                              ) : (
                                <div
                                  className="flex-1 min-h-[20px]"
                                  contentEditable
                                  suppressContentEditableWarning
                                  onBlur={(e) =>
                                    handleUpdateExtraRow(row.id, {
                                      value: e.currentTarget.innerText,
                                    })
                                  }
                                >
                                  {row.value}
                                </div>
                              )}
                              <button
                                type="button"
                                onClick={() => handleRemoveExtraRow(row.id)}
                                title="Remove appended row"
                                className="no-print p-1 text-[#9ca3af] hover:text-red-600 shrink-0"
                              >
                                <X className="w-3.5 h-3.5" aria-hidden="true" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* IMAGE HEADING */}
                <div className="j909-image-header">
                  <div className="j909-image-line" />
                  <div className="j909-slashes">
                    <span style={{ background: themeSecondary }} />
                    <span style={{ background: '#b8b8b8' }} />
                    <span style={{ background: themePrimary }} />
                  </div>
                  <h2 className="j909-image-title">IMAGE</h2>
                  <div className="j909-slashes">
                    <span style={{ background: themePrimary }} />
                    <span style={{ background: themeSecondary }} />
                    <span style={{ background: '#b8b8b8' }} />
                  </div>
                  <div className="j909-image-line" />
                </div>

                {/* MAIN IMAGE / ARTWORK SPACE WITH THEME COLOR ADAPTATION + OFFICIAL SEAL */}
                <div className="j909-image-area relative">
                  {activeDoc.imageDataUrl ? (
                    <div className="j909-artwork-wrap" data-color-mode={activeArtworkMode}>
                      <img
                        src={activeDoc.imageDataUrl}
                        alt={activeDoc.title || 'Trademark artwork'}
                        data-color-mode={activeArtworkMode}
                        style={{ maxWidth: '100%', maxHeight: `${resolvedDims.maxImageHeightIn}in` }}
                        className="j909-artwork-img object-contain"
                      />
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => imageInputRef.current?.click()}
                      className="no-print border-2 border-dashed border-[#d4d4d4] hover:border-[#290076] px-8 py-10 text-center text-xs text-[#6e6a7a]"
                    >
                      Click to attach artwork image
                    </button>
                  )}

                  {/* Brandex Circular b(R) Official Stamp */}
                  <div className="absolute right-2 bottom-2 opacity-90 pointer-events-none">
                    <BrandexLogo
                      variant="logo17"
                      size="md"
                      primaryColor={themePrimary}
                      discColor={universalSettings?.uiDarkColor || '#111111'}
                      accentColor={universalSettings?.uiAccentColor || '#f5c400'}
                    />
                  </div>
                </div>

                {/* FOOTER */}
                <div className="j909-footer">
                  {previewInputMode ? (
                    <input
                      type="text"
                      value={
                        activeDoc.noteText ??
                        'NOTE: DEMAND NOTE WILL BE ISSUED AFTER 2 MONTHS FROM THE DATE OF PUBLICATION'
                      }
                      onChange={(e) => onUpdateDoc(activeDoc.id, { noteText: e.target.value })}
                      className="j909-note-bar w-full border-0 outline-none"
                    />
                  ) : (
                    <div
                      className="j909-note-bar"
                      contentEditable
                      suppressContentEditableWarning
                      onBlur={(e) =>
                        onUpdateDoc(activeDoc.id, { noteText: e.currentTarget.innerText })
                      }
                    >
                      {activeDoc.noteText ??
                        'NOTE: DEMAND NOTE WILL BE ISSUED AFTER 2 MONTHS FROM THE DATE OF PUBLICATION'}
                    </div>
                  )}

                  {/* Brandex Logo-Final Footer Branding */}
                  <div className="j909-brandex-row">
                    <div className="j909-brandex-line" />
                    <BrandexLogo
                      variant="logoFinal"
                      size="md"
                      primaryColor={themePrimary}
                      accentColor={themeAccent}
                    />
                    <div className="j909-brandex-line" />
                  </div>

                  <div className="j909-contact-row">
                    <div className="j909-contact-item">
                      <svg
                        className="j909-contact-icon"
                        viewBox="0 0 24 24"
                        fill={themePrimary}
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z" />
                      </svg>
                      <div className="j909-contact-text">
                        <span className="j909-contact-label">Address:</span>
                        DROP AT ABDULLAH CENTRE, JINNAH COLONY BEHIND PTCL EXCHANGE, TARLAI, ISLAMABAD
                      </div>
                    </div>

                    <div className="j909-contact-item">
                      <svg
                        className="j909-contact-icon"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke={themePrimary}
                        strokeWidth="1.8"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path d="M12 2a10 10 0 0 0-8.66 15l-1.1 4 4.1-1.08A10 10 0 1 0 12 2z" />
                        <path
                          d="M9.5 8.5c.3-.6.7-.6 1-.6h.5c.2 0 .5.1.6.5l.7 1.6c.1.3 0 .5-.2.7l-.5.6c.6 1 1.5 1.9 2.5 2.5l.6-.5c.2-.2.4-.3.7-.2l1.6.7c.4.1.5.4.5.6v.5c0 .3 0 .7-.6 1-.5.3-1.4.4-2.5 0-1.6-.6-3.7-2.6-4.4-4.3-.4-1.1-.3-2 .1-2.6z"
                          fill={themePrimary}
                          stroke="none"
                        />
                      </svg>
                      <div className="j909-contact-text">
                        <span className="j909-contact-label">Whatsapp:</span>
                        +92 336 0015004
                      </div>
                    </div>

                    <div className="j909-contact-item">
                      <svg
                        className="j909-contact-icon"
                        viewBox="0 0 24 24"
                        fill={themePrimary}
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path d="M2 5h20v14H2V5zm2 2v.4l8 5.2 8-5.2V7H4zm16 10V9.7l-8 5.2-8-5.2V17h16z" />
                      </svg>
                      <div className="j909-contact-text">
                        <span className="j909-contact-label">Email:</span>
                        info@brandex.pk
                      </div>
                    </div>

                    <div className="j909-contact-item">
                      <svg
                        className="j909-contact-icon"
                        viewBox="0 0 24 24"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <circle cx="12" cy="12" r="10.5" fill={themePrimary} />
                        <path
                          d="M13.5 19v-6h2l.3-2.3h-2.3V9.3c0-.7.2-1.1 1.2-1.1h1.2V6.1c-.2 0-.9-.1-1.8-.1-1.8 0-3 1.1-3 3.1v1.6H9v2.3h2.1v6h2.4z"
                          fill="#ffffff"
                        />
                      </svg>
                      <div className="j909-contact-text">
                        <span className="j909-contact-label">Facebook:</span>
                        https://www.facebook.com/
                        <br />
                        Brandex.pk/
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {confirmClearOpen && (
        <div
          className="no-print fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setConfirmClearOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="clear-watchlist-dialog-title"
            className="w-full max-w-md bg-white border border-[#111111] shadow-xl p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="clear-watchlist-dialog-title" className="text-base font-extrabold text-[#111111]">
              Clear Watchlist?
            </h3>
            <p className="text-xs text-[#555a66]">
              Removes {watchlistCount} watchlist entries. Restore defaults anytime in Settings.
            </p>
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmClearOpen(false)}
                className="h-[36px] px-4 border border-[#cbd0da] bg-white text-xs font-bold text-[#111111]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onClearWatchlist();
                  setConfirmClearOpen(false);
                }}
                className="h-[36px] px-4 bg-red-600 hover:bg-red-700 text-white text-xs font-extrabold"
              >
                Clear Watchlist
              </button>
            </div>
          </div>
        </div>
      )}

      {pdfPreviewOpen && (
        <div
          className="no-print fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 sm:p-6"
          onClick={() => setPdfPreviewOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="pdf-preview-modal-title"
            className="w-full max-w-6xl h-[92vh] bg-[#d8dce4] border border-[#111111] shadow-2xl flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-[#111111] text-white px-5 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div>
                <h3 id="pdf-preview-modal-title" className="text-sm font-extrabold">
                  PDF Preview · {resolvedDims.label}
                </h3>
                <p className="text-[11px] text-[#c7c9d1]">
                  {activeDoc.serialNo} · Journal {activeDoc.journalNo || '909'} · {activeDoc.title || 'Untitled'}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex border border-[#3a3f4b] bg-[#1d2028]">
                  {(['fit', '75', '100'] as const).map((z) => (
                    <button
                      key={z}
                      type="button"
                      data-sfx="filter"
                      data-active={pdfPreviewZoom === z}
                      onClick={() => setPdfPreviewZoom(z)}
                      className={`px-2.5 py-1 text-[11px] font-bold ${
                        pdfPreviewZoom === z
                          ? 'bg-[#ffee00] text-[#111111]'
                          : 'text-[#d1d5db] hover:text-white'
                      }`}
                    >
                      {z === 'fit' ? 'Fit' : `${z}%`}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleDownloadHtml}
                  className="h-[34px] px-3 border border-[#3a3f4b] bg-[#1d2028] hover:bg-[#2a2f3a] text-white text-xs font-bold inline-flex items-center gap-1.5"
                >
                  <FileCode2 className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>HTML</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onMarkPdfGenerated(activeDoc.id);
                    const win = pdfIframeRef.current?.contentWindow;
                    if (win) {
                      win.focus();
                      win.print();
                    } else {
                      window.print();
                    }
                  }}
                  className="h-[34px] px-3.5 bg-[#ffee00] hover:bg-[#e6d600] text-[#111111] text-xs font-extrabold inline-flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Print Document</span>
                </button>

                <button
                  type="button"
                  aria-label="Close PDF preview"
                  onClick={() => setPdfPreviewOpen(false)}
                  className="h-[34px] w-[34px] border border-[#3a3f4b] bg-[#1d2028] hover:bg-[#2a2f3a] text-white inline-flex items-center justify-center"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-4 sm:p-8 flex justify-center items-start">
              <div
                style={{
                  width: `${resolvedDims.widthIn}in`,
                  height: `${resolvedDims.heightIn}in`,
                  transform:
                    pdfPreviewZoom === '100'
                      ? 'scale(1)'
                      : pdfPreviewZoom === '75'
                      ? 'scale(0.75)'
                      : 'scale(0.58)',
                  transformOrigin: 'top center',
                  marginBottom:
                    pdfPreviewZoom === '100'
                      ? '0px'
                      : pdfPreviewZoom === '75'
                      ? `-${resolvedDims.heightIn * 96 * 0.25}px`
                      : `-${resolvedDims.heightIn * 96 * 0.42}px`,
                }}
                className="bg-white shadow-2xl border border-[#9ca3af] shrink-0 overflow-hidden"
              >
                <iframe
                  ref={pdfIframeRef}
                  title="Print-ready PDF preview"
                  srcDoc={previewHtml}
                  className="w-full h-full border-0 block bg-white"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
