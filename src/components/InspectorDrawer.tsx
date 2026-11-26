import { useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Download,
  FileArchive,
  History,
  Paperclip,
  RefreshCw,
  RotateCcw,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  DocumentAsset,
  DocumentRecord,
  DocumentVersion,
  ExportJob,
  WorkspaceRole,
} from '../types/studio';

interface InspectorDrawerProps {
  open: boolean;
  onClose: () => void;
  document: DocumentRecord | null;
  versions: DocumentVersion[];
  exports: ExportJob[];
  assets: DocumentAsset[];
  onRestoreVersion: (documentId: string, versionId: string) => void;
  onRetryExport: (exportId: string) => void;
  onDownloadExport: (exportJob: ExportJob) => void;
  onUploadAsset: (file: File) => void;
  onDeleteAsset: (assetId: string) => void;
  currentRole: WorkspaceRole;
}

export function InspectorDrawer({
  open,
  onClose,
  document: doc,
  versions,
  exports,
  assets,
  onRestoreVersion,
  onRetryExport,
  onDownloadExport,
  onUploadAsset,
  onDeleteAsset,
  currentRole,
}: InspectorDrawerProps) {
  const [tab, setTab] = useState<'versions' | 'exports' | 'assets'>('versions');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canEdit = currentRole !== 'viewer';

  if (!open || !doc) return null;

  const sortedVersions = [...versions].sort((a, b) => b.versionNo - a.versionNo);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <aside
      aria-label="Document inspector"
      className="w-full xl:w-[320px] shrink-0 studio-card flex flex-col overflow-hidden self-start"
    >
      <div className="px-4 py-3 border-b border-[#efecf6] bg-[#fbfafc] flex items-center justify-between">
        <h2 className="font-editorial text-sm font-bold text-[#1f1b2e]">
          Document Inspector
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close inspector"
          className="p-1 rounded-[7px] text-[#655f78] hover:bg-[#ece9f4]"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-2 border-b border-[#efecf6] bg-[#f6f5f8] grid grid-cols-3 gap-1">
        <button
          type="button"
          onClick={() => setTab('versions')}
          className={`px-2 py-1.5 rounded-[7px] text-xs font-medium transition-colors ${
            tab === 'versions'
              ? 'bg-white text-[#1f1b2e] shadow-sm'
              : 'text-[#5c566e] hover:text-[#1f1b2e]'
          }`}
        >
          Versions ({versions.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('exports')}
          className={`px-2 py-1.5 rounded-[7px] text-xs font-medium transition-colors ${
            tab === 'exports'
              ? 'bg-white text-[#1f1b2e] shadow-sm'
              : 'text-[#5c566e] hover:text-[#1f1b2e]'
          }`}
        >
          Exports ({exports.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('assets')}
          className={`px-2 py-1.5 rounded-[7px] text-xs font-medium transition-colors ${
            tab === 'assets'
              ? 'bg-white text-[#1f1b2e] shadow-sm'
              : 'text-[#5c566e] hover:text-[#1f1b2e]'
          }`}
        >
          Files ({assets.length})
        </button>
      </div>

      <div className="p-3.5 space-y-3 max-h-[580px] overflow-y-auto">
        {tab === 'versions' && (
          <>
            <p className="text-[11.5px] text-[#655f78] leading-relaxed">
              Version snapshots are immutable. Restoring a prior snapshot creates a new version without altering history.
            </p>
            {sortedVersions.map((ver) => {
              const isCurrent = ver.id === doc.currentVersionId;
              return (
                <div
                  key={ver.id}
                  className={`p-3 rounded-[9px] border ${
                    isCurrent
                      ? 'border-[#7463e8] bg-[#f8f6fe]'
                      : 'border-[#e6e3ee] bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1f1b2e] tabular-nums">
                      <History className="w-3.5 h-3.5 text-[#7463e8]" aria-hidden="true" />
                      Version {ver.versionNo}
                      {isCurrent && ' (Current)'}
                    </span>
                    <span className="text-[11px] text-[#756e8a] capitalize">
                      {ver.source}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[#4c465e]">{ver.summary}</p>
                  <div className="mt-2 text-[11px] text-[#756e8a] tabular-nums">
                    {ver.createdByName} · {ver.wordCount} words ·{' '}
                    {new Date(ver.createdAt).toLocaleString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                  {!isCurrent && canEdit && (
                    <button
                      type="button"
                      onClick={() => onRestoreVersion(doc.id, ver.id)}
                      className="mt-2.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[7px] text-[11.5px] font-medium bg-[#f6f5f8] hover:bg-[#ebe7f7] text-[#1f1b2e]"
                    >
                      <RotateCcw className="w-3 h-3 text-[#7463e8]" aria-hidden="true" />
                      <span>Restore as new version</span>
                    </button>
                  )}
                </div>
              );
            })}
          </>
        )}

        {tab === 'exports' && (
          <>
            <p className="text-[11.5px] text-[#655f78] leading-relaxed">
              Every export artifact is bound to a specific document version ID. Failed conversion jobs can be retried safely.
            </p>
            {exports.length === 0 ? (
              <div className="py-6 text-center text-xs text-[#655f78]">
                No export jobs recorded for this document yet. Use Print / PDF or Export in the toolbar above.
              </div>
            ) : (
              exports.map((job) => (
                <div
                  key={job.id}
                  className="p-3 rounded-[9px] border border-[#e6e3ee] bg-white space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-[#1f1b2e] uppercase tabular-nums">
                      {job.format} · v{job.versionNo}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 text-[11px] font-medium ${
                        job.status === 'ready'
                          ? 'text-[#15803d]'
                          : job.status === 'failed'
                          ? 'text-[#b42318]'
                          : 'text-[#7463e8]'
                      }`}
                    >
                      {job.status === 'ready' && <CheckCircle2 className="w-3.5 h-3.5" />}
                      {job.status === 'failed' && <AlertCircle className="w-3.5 h-3.5" />}
                      {(job.status === 'queued' || job.status === 'processing') && (
                        <Clock className="w-3.5 h-3.5" />
                      )}
                      <span className="capitalize">{job.status}</span>
                    </span>
                  </div>
                  <div className="text-[11px] text-[#756e8a] tabular-nums">
                    Requested by {job.requestedByName} ·{' '}
                    {new Date(job.createdAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                  {job.errorCode && (
                    <div className="text-[11px] text-[#b42318]">
                      Error: {job.errorCode}
                    </div>
                  )}
                  <div className="pt-1 flex items-center gap-2">
                    {job.status === 'ready' && (
                      <button
                        type="button"
                        onClick={() => onDownloadExport(job)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[7px] text-[11.5px] font-medium bg-[#f0edfc] text-[#5542d4] hover:bg-[#e5dffb]"
                      >
                        <Download className="w-3 h-3" aria-hidden="true" />
                        <span>Download</span>
                      </button>
                    )}
                    {job.status === 'failed' && canEdit && (
                      <button
                        type="button"
                        onClick={() => onRetryExport(job.id)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[7px] text-[11.5px] font-medium bg-[#fef3f2] text-[#b42318] hover:bg-[#fee4e2]"
                      >
                        <RefreshCw className="w-3 h-3" aria-hidden="true" />
                        <span>Retry Export</span>
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </>
        )}

        {tab === 'assets' && (
          <>
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11.5px] text-[#655f78]">
                Private attachments (max 5 MB, SHA-256 verified).
              </p>
              {canEdit && (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        onUploadAsset(file);
                        e.target.value = '';
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[8px] text-xs font-semibold text-white bg-[#7463e8] hover:bg-[#6251d6] shrink-0"
                  >
                    <Upload className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Attach</span>
                  </button>
                </>
              )}
            </div>

            {assets.length === 0 ? (
              <div className="py-6 text-center text-xs text-[#655f78] space-y-1">
                <FileArchive className="w-5 h-5 mx-auto text-[#9a92af]" aria-hidden="true" />
                <p>No private attachments on this document.</p>
              </div>
            ) : (
              assets.map((asset) => (
                <div
                  key={asset.id}
                  className="p-3 rounded-[9px] border border-[#e6e3ee] bg-white space-y-1.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1f1b2e] break-all">
                      <Paperclip className="w-3.5 h-3.5 text-[#7463e8] shrink-0" aria-hidden="true" />
                      {asset.originalName}
                    </span>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => onDeleteAsset(asset.id)}
                        aria-label={`Remove ${asset.originalName}`}
                        className="p-1 text-[#756e8a] hover:text-[#b42318]"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="text-[11px] text-[#756e8a] tabular-nums">
                    {formatSize(asset.byteSize)} · {asset.mimeType}
                  </div>
                  <div className="text-[10.5px] font-mono text-[#756e8a] truncate">
                    SHA-256: {asset.sha256.slice(0, 18)}…
                  </div>
                  <a
                    href={asset.dataUrl}
                    download={asset.originalName}
                    className="inline-flex items-center gap-1 text-[11.5px] font-medium text-[#7463e8] hover:underline"
                  >
                    <Download className="w-3 h-3" aria-hidden="true" />
                    <span>Download signed copy</span>
                  </a>
                </div>
              ))
            )}
          </>
        )}
      </div>
    </aside>
  );
}
