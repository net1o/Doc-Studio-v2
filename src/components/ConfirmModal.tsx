import { AlertTriangle, X } from 'lucide-react';

interface ConfirmModalProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  open,
  title,
  description,
  confirmLabel,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      className="fixed inset-0 z-50 bg-[#1f1b2e]/40 flex items-center justify-center p-4"
    >
      <div className="bg-white border border-[#e6e3ee] rounded-[11px] shadow-xl max-w-md w-full p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-[#b42318] shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <h2 id="confirm-modal-title" className="font-editorial text-base font-bold text-[#1f1b2e]">
                {title}
              </h2>
              <p className="text-xs text-[#565068] mt-1 leading-relaxed">{description}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close confirmation dialog"
            className="p-1 rounded-[7px] text-[#655f78] hover:bg-[#f6f5f8]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#efecf6]">
          <button
            type="button"
            onClick={onCancel}
            className="px-3.5 py-2 rounded-[8px] text-xs font-medium text-[#4c465e] bg-[#f6f5f8] hover:bg-[#ece9f4]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-3.5 py-2 rounded-[8px] text-xs font-semibold text-white bg-[#b42318] hover:bg-[#912018]"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
