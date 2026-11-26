import { useRef, useState } from 'react';
import {
  CheckCircle2,
  Download,
  FileCode2,
  ImagePlus,
  Plus,
  Printer,
  Trash2,
} from 'lucide-react';
import { GeneratedJournalDoc } from '../types/journal';
import {
  buildJournal909Html,
  buildJournal909WordDoc,
} from '../lib/journal/journal909Template';
import { triggerFileDownload } from '../lib/journal/engine';

interface Journal909GeneratorViewProps {
  docs: GeneratedJournalDoc[];
  selectedDocId: string | null;
  onSelectDoc: (id: string) => void;
  onUpdateDoc: (id: string, patch: Partial<GeneratedJournalDoc>) => void;
  onCreateBlankDoc: () => void;
  onMarkPdfGenerated: (docId: string) => void;
}

export function Journal909GeneratorView({
  docs,
  selectedDocId,
  onSelectDoc,
  onUpdateDoc,
  onCreateBlankDoc,
  onMarkPdfGenerated,
}: Journal909GeneratorViewProps) {
  const [zoom, setZoom] = useState<'fit' | '75' | '100'>('75');
  const imageInputRef = useRef<HTMLInputElement>(null);

  const activeDoc = docs.find((d) => d.id === selectedDocId) || docs[0] || null;

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
    const html = buildJournal909Html(activeDoc);
    const safeName = `${activeDoc.caseNo || activeDoc.serialNo}_${activeDoc.applicationNo || '909'}`
      .replace(/[^a-zA-Z0-9_-]+/g, '_');
    triggerFileDownload(html, `${safeName}_Journal909.html`, 'text/html;charset=utf-8');
  };

  const handleDownloadWord = () => {
    if (!activeDoc) return;
    const wordHtml = buildJournal909WordDoc(activeDoc);
    const safeName = `${activeDoc.caseNo || activeDoc.serialNo}_${activeDoc.applicationNo || '909'}`
      .replace(/[^a-zA-Z0-9_-]+/g, '_');
    triggerFileDownload(wordHtml, `${safeName}_Journal909.doc`, 'application/msword;charset=utf-8');
  };

  const handlePrintPdf = () => {
    if (!activeDoc) return;
    onMarkPdfGenerated(activeDoc.id);
    window.print();
  };

  if (!activeDoc) {
    return (
      <div className="bg-white border border-[#e2e4ea] p-10 text-center space-y-4">
        <h2 className="text-xl font-extrabold text-[#111111]">No Generated Journal 909 Documents</h2>
        <p className="text-sm text-[#555a66]">
          Create a blank Legal 8.5×14 sheet or mark rows as MAILMERGE in Review Queue to generate documents.
        </p>
        <button
          type="button"
          onClick={onCreateBlankDoc}
          className="builty-btn h-[42px] pl-4 pr-3 gap-2 text-xs mx-auto"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          <span>Create Blank Journal 909 Doc</span>
        </button>
      </div>
    );
  }

  const scaleClass =
    zoom === '100'
      ? 'scale-100'
      : zoom === '75'
      ? 'scale-[0.76] origin-top'
      : 'scale-[0.65] sm:scale-[0.78] xl:scale-[0.88] origin-top';

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
      {/* Left Control Rail */}
      <aside className="no-print xl:col-span-4 bg-white border border-[#e2e4ea] p-5 space-y-5">
        <div className="flex items-center justify-between gap-2 border-b border-[#eceef2] pb-3">
          <div>
            <h2 className="text-base font-extrabold text-[#111111]">
              Journal 909 Legal (8.5×14)
            </h2>
            <p className="text-[11.5px] text-[#555a66]">
              Editorial Print Sheet · Exact Legal Dimensions
            </p>
          </div>
          <button
            type="button"
            onClick={onCreateBlankDoc}
            className="px-2.5 py-1.5 bg-[#ffee00] text-[#111111] text-xs font-bold hover:bg-[#f2e000] inline-flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            <span>New</span>
          </button>
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

        {/* Primary Export / Print Actions */}
        <div className="space-y-2 pt-1">
          <button
            type="button"
            onClick={handlePrintPdf}
            className="builty-btn w-full justify-between h-[42px] pl-4 pr-2 text-xs"
          >
            <span>Convert / Print PDF (8.5×14 Legal)</span>
            <span className="builty-btn-icon-tab w-8 h-7">
              <Printer className="w-3.5 h-3.5" aria-hidden="true" />
            </span>
          </button>

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
              PDF status marked generated in Review &amp; Records
            </p>
          )}
        </div>

        {/* Editable Merge Fields */}
        <div className="space-y-3 border-t border-[#eceef2] pt-4">
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[11px] font-bold text-[#555a66] mb-1">Journal No</label>
              <input
                type="text"
                value={activeDoc.journalNo}
                onChange={(e) => onUpdateDoc(activeDoc.id, { journalNo: e.target.value })}
                className="w-full bg-[#f8f9fb] border border-[#cbd0da] px-2.5 py-1.5 text-xs text-[#111111] focus:bg-white focus:border-[#111111]"
              />
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
            <label className="block text-[11px] font-bold text-[#555a66] mb-1">Publishing Details Box</label>
            <textarea
              rows={3}
              value={activeDoc.publishingDetails}
              onChange={(e) =>
                onUpdateDoc(activeDoc.id, { publishingDetails: e.target.value })
              }
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
              <label className="block text-[11px] font-bold text-[#555a66] mb-1">TRADEMARK (App No)</label>
              <input
                type="text"
                value={activeDoc.trademarkField}
                onChange={(e) =>
                  onUpdateDoc(activeDoc.id, { trademarkField: e.target.value })
                }
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
              <label className="block text-[11px] font-bold text-[#555a66] mb-1">Cell 4 Label</label>
              <input
                type="text"
                value={activeDoc.extraLabel}
                onChange={(e) => onUpdateDoc(activeDoc.id, { extraLabel: e.target.value })}
                className="w-full bg-[#f8f9fb] border border-[#cbd0da] px-2.5 py-1.5 text-xs text-[#111111] focus:bg-white focus:border-[#111111]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[#555a66] mb-1">Cell 4 Value</label>
              <input
                type="text"
                value={activeDoc.extraValue}
                onChange={(e) => onUpdateDoc(activeDoc.id, { extraValue: e.target.value })}
                className="w-full bg-[#f8f9fb] border border-[#cbd0da] px-2.5 py-1.5 text-xs text-[#111111] focus:bg-white focus:border-[#111111]"
              />
            </div>
          </div>
        </div>

        {/* Artwork Upload for IMAGE section */}
        <div className="border-t border-[#eceef2] pt-4 space-y-2.5">
          <span className="block text-xs font-bold text-[#374151]">
            Trademark Artwork (IMAGE Area)
          </span>
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
        </div>

        {/* Preview Scale */}
        <div className="border-t border-[#eceef2] pt-3 flex items-center justify-between text-xs">
          <span className="font-semibold text-[#555a66]">Preview Zoom</span>
          <div className="flex border border-[#cbd0da] bg-white">
            {(['fit', '75', '100'] as const).map((z) => (
              <button
                key={z}
                type="button"
                onClick={() => setZoom(z)}
                className={`px-2.5 py-1 text-[11px] font-bold ${
                  zoom === z ? 'bg-[#ffee00] text-[#111111]' : 'text-[#555a66] hover:text-[#111111]'
                }`}
              >
                {z === 'fit' ? 'Fit' : `${z}%`}
              </button>
            ))}
          </div>
        </div>
      </aside>

      {/* Right Canvas: Exact Journal 909 - Legal Size (8.5in x 14in) Sheet */}
      <div className="xl:col-span-8 overflow-x-auto flex justify-center bg-[#e9ebf0] border border-[#d4d7e0] p-4 sm:p-6 min-h-[760px] print:col-span-12 print:overflow-visible print:block print:bg-white print:border-0 print:p-0 print:min-h-0">
        <div className={`j909-print-wrapper ${scaleClass}`}>
          <div className="j909-page">
            {/* Exact Outer Frame & Corner Borders SVG */}
            <svg
              className="j909-frame-svg"
              viewBox="0 0 850 1400"
              preserveAspectRatio="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <polygon points="18,18 98,18 18,98" fill="#4e1cb8" />
              <polygon points="18,108 108,18 134,18 18,134" fill="#290076" />
              <polygon points="776,18 832,18 832,74" fill="#290076" />
              <polygon points="750,18 766,18 832,84 832,100" fill="#b8b8b8" />
              <polygon points="18,1326 18,1382 74,1382" fill="#290076" />
              <polygon points="18,1300 18,1316 84,1382 100,1382" fill="#b8b8b8" />
              <polygon points="752,1382 832,1382 832,1302" fill="#4e1cb8" />
              <polygon points="726,1382 742,1382 832,1292 832,1276" fill="#290076" />
              <line x1="138" y1="22" x2="742" y2="22" stroke="#b8b8b8" strokeWidth="2" />
              <line x1="120" y1="32" x2="764" y2="32" stroke="#290076" strokeWidth="4" />
              <line x1="86" y1="1368" x2="730" y2="1368" stroke="#290076" strokeWidth="4" />
              <line x1="108" y1="1378" x2="712" y2="1378" stroke="#b8b8b8" strokeWidth="2" />
              <line x1="20" y1="145" x2="20" y2="495" stroke="#290076" strokeWidth="3" />
              <line x1="20" y1="530" x2="20" y2="660" stroke="#4e1cb8" strokeWidth="5" />
              <line x1="20" y1="680" x2="20" y2="715" stroke="#290076" strokeWidth="5" />
              <line x1="20" y1="735" x2="20" y2="1285" stroke="#b8b8b8" strokeWidth="2" />
              <line x1="28" y1="125" x2="28" y2="1305" stroke="#290076" strokeWidth="2" />
              <line x1="830" y1="115" x2="830" y2="500" stroke="#b8b8b8" strokeWidth="2" />
              <line x1="830" y1="530" x2="830" y2="660" stroke="#4e1cb8" strokeWidth="5" />
              <line x1="830" y1="680" x2="830" y2="715" stroke="#290076" strokeWidth="5" />
              <line x1="830" y1="735" x2="830" y2="1265" stroke="#290076" strokeWidth="3" />
              <line x1="822" y1="95" x2="822" y2="1285" stroke="#290076" strokeWidth="2" />
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
                      fill="#290076"
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
                    <h1 className="j909-journal-title">
                      JOURNAL {activeDoc.journalNo || '909'}
                    </h1>
                    <div className="j909-journal-date">
                      {activeDoc.journalDate || '26-Nov-2026'}
                    </div>
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
                      <td
                        className="value-cell"
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={(e) =>
                          onUpdateDoc(activeDoc.id, { title: e.currentTarget.innerText })
                        }
                      >
                        {activeDoc.title}
                      </td>
                      <td className="label-cell">TRADEMARK</td>
                      <td
                        className="value-cell"
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={(e) =>
                          onUpdateDoc(activeDoc.id, {
                            trademarkField: e.currentTarget.innerText,
                          })
                        }
                      >
                        {activeDoc.trademarkField}
                      </td>
                    </tr>
                    <tr>
                      <td className="label-cell">CLASS</td>
                      <td
                        className="value-cell"
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={(e) =>
                          onUpdateDoc(activeDoc.id, { classNo: e.currentTarget.innerText })
                        }
                      >
                        {activeDoc.classNo}
                      </td>
                      <td className="label-cell">{activeDoc.extraLabel}</td>
                      <td
                        className="value-cell"
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={(e) =>
                          onUpdateDoc(activeDoc.id, {
                            extraValue: e.currentTarget.innerText,
                          })
                        }
                      >
                        {activeDoc.extraValue}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* IMAGE HEADING */}
              <div className="j909-image-header">
                <div className="j909-image-line" />
                <div className="j909-slashes">
                  <span style={{ background: '#4e1cb8' }} />
                  <span style={{ background: '#b8b8b8' }} />
                  <span style={{ background: '#290076' }} />
                </div>
                <h2 className="j909-image-title">IMAGE</h2>
                <div className="j909-slashes">
                  <span style={{ background: '#290076' }} />
                  <span style={{ background: '#4e1cb8' }} />
                  <span style={{ background: '#b8b8b8' }} />
                </div>
                <div className="j909-image-line" />
              </div>

              {/* MAIN IMAGE / ARTWORK SPACE */}
              <div className="j909-image-area">
                {activeDoc.imageDataUrl ? (
                  <img
                    src={activeDoc.imageDataUrl}
                    alt={activeDoc.title || 'Trademark artwork'}
                    className="max-w-full max-h-[5.1in] object-contain"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => imageInputRef.current?.click()}
                    className="no-print border-2 border-dashed border-[#d4d4d4] hover:border-[#290076] px-8 py-12 text-center text-xs text-[#6e6a7a] transition-colors"
                  >
                    Click to attach trademark artwork image (optional)
                  </button>
                )}
              </div>

              {/* FOOTER */}
              <div className="j909-footer">
                <div className="j909-note-bar">
                  NOTE: DEMAND NOTE WILL BE ISSUED AFTER 2 MONTHS FROM THE DATE OF PUBLICATION
                </div>

                <div className="j909-brandex-row">
                  <div className="j909-brandex-line" />
                  <div className="j909-brandex-logo">
                    <div className="j909-brandex-sub">
                      GET LEGAL
                      <span className="reg">&reg;</span>
                    </div>
                    <div className="j909-brandex-wordmark">
                      b<span className="j909-brandex-r-badge">R</span>andex
                    </div>
                  </div>
                  <div className="j909-brandex-line" />
                </div>

                <div className="j909-contact-row">
                  <div className="j909-contact-item">
                    <svg
                      className="j909-contact-icon"
                      viewBox="0 0 24 24"
                      fill="#290076"
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
                      stroke="#290076"
                      strokeWidth="1.8"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path d="M12 2a10 10 0 0 0-8.66 15l-1.1 4 4.1-1.08A10 10 0 1 0 12 2z" />
                      <path
                        d="M9.5 8.5c.3-.6.7-.6 1-.6h.5c.2 0 .5.1.6.5l.7 1.6c.1.3 0 .5-.2.7l-.5.6c.6 1 1.5 1.9 2.5 2.5l.6-.5c.2-.2.4-.3.7-.2l1.6.7c.4.1.5.4.5.6v.5c0 .3 0 .7-.6 1-.5.3-1.4.4-2.5 0-1.6-.6-3.7-2.6-4.4-4.3-.4-1.1-.3-2 .1-2.6z"
                        fill="#290076"
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
                      fill="#290076"
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
                      <circle cx="12" cy="12" r="10.5" fill="#290076" />
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
  );
}
