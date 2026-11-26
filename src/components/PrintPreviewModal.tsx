import { Printer, X } from 'lucide-react';
import { DocumentRecord } from '../types/studio';
import { sanitizeDocumentHtml } from '../lib/security/sanitize';

interface PrintPreviewModalProps {
  open: boolean;
  onClose: () => void;
  document: DocumentRecord | null;
  versionNo: number;
}

export function PrintPreviewModal({
  open,
  onClose,
  document: doc,
  versionNo,
}: PrintPreviewModalProps) {
  if (!open || !doc) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Print and PDF preview"
      className="fixed inset-0 z-50 bg-[#1f1b2e]/40 flex items-center justify-center p-4"
    >
      <div className="bg-[#fbfafc] border border-[#e6e3ee] rounded-[11px] shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        <div className="no-print px-5 py-3.5 bg-white border-b border-[#e6e3ee] flex items-center justify-between gap-3">
          <div>
            <h2 className="font-editorial text-base font-bold text-[#1f1b2e]">
              Print &amp; PDF Preview
            </h2>
            <p className="text-xs text-[#655f78] tabular-nums">
              {doc.title} · Version {versionNo}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[8px] text-xs font-semibold text-white bg-[#7463e8] hover:bg-[#6251d6]"
            >
              <Printer className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Print / Save as PDF</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close print preview"
              className="p-2 rounded-[8px] text-[#655f78] hover:bg-[#f0edfc]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 sm:p-10">
          <article
            dir={doc.draftContent.direction}
            className="print-sheet bg-white border border-[#e6e3ee] rounded-[8px] shadow-sm max-w-[740px] mx-auto p-10 sm:p-14"
          >
            {doc.draftContent.headerText && (
              <header className="border-b border-[#e6e3ee] pb-3 mb-7 flex items-center justify-between text-xs text-[#655f78]">
                <span>{doc.draftContent.headerText}</span>
                <span className="tabular-nums">v{versionNo}</span>
              </header>
            )}

            <h1 className="font-editorial text-3xl font-bold text-[#171326] mb-6">
              {doc.title}
            </h1>

            <div
              className="studio-prose"
              dangerouslySetInnerHTML={{
                __html: sanitizeDocumentHtml(doc.draftContent.html),
              }}
            />

            {doc.draftContent.footerText && (
              <footer className="border-t border-[#e6e3ee] pt-3 mt-10 flex items-center justify-between text-xs text-[#655f78]">
                <span>{doc.draftContent.footerText}</span>
                <span>Document Studio</span>
              </footer>
            )}
          </article>
        </div>
      </div>
    </div>
  );
}
