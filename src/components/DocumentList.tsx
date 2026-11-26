import { useRef } from 'react';
import { FileUp, RotateCcw, Search, Trash2 } from 'lucide-react';
import { DocumentRecord, DocumentVersion, Folder, WorkspaceRole } from '../types/studio';

interface DocumentListProps {
  documents: DocumentRecord[];
  versionsByDoc: Record<string, DocumentVersion[]>;
  folders: Folder[];
  selectedDocumentId: string | null;
  onSelectDocument: (documentId: string) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedTag: string;
  onSelectTag: (tag: string) => void;
  availableTags: string[];
  isTrashView: boolean;
  onRestoreFromTrash: (documentId: string) => void;
  onRequestPermanentDelete: (doc: DocumentRecord) => void;
  onImportFile: (file: File) => void;
  onCreateBlankDocument: () => void;
  currentRole: WorkspaceRole;
  activeFolderName: string | null;
}

export function DocumentList({
  documents,
  versionsByDoc,
  folders,
  selectedDocumentId,
  onSelectDocument,
  searchQuery,
  onSearchChange,
  selectedTag,
  onSelectTag,
  availableTags,
  isTrashView,
  onRestoreFromTrash,
  onRequestPermanentDelete,
  onImportFile,
  onCreateBlankDocument,
  currentRole,
  activeFolderName,
}: DocumentListProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canEdit = currentRole !== 'viewer';

  const getFolderName = (folderId: string | null) => {
    if (!folderId) return 'Unfiled';
    return folders.find((f) => f.id === folderId)?.name || 'Unfiled';
  };

  const formatUpdated = (iso: string) => {
    const date = new Date(iso);
    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <section
      aria-label={isTrashView ? 'Trashed documents' : 'Workspace documents'}
      className="flex flex-col gap-3 w-full lg:w-[330px] xl:w-[350px] shrink-0"
    >
      <div className="bg-white border border-[#e6e3ee] rounded-[10px] p-3 shadow-[0_1px_3px_rgba(31,27,46,0.03)] space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-editorial text-[15px] font-bold text-[#1f1b2e] truncate">
            {isTrashView
              ? 'Trash (30-Day Recovery)'
              : activeFolderName
              ? activeFolderName
              : 'All Documents'}
          </h2>
          {!isTrashView && canEdit && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept=".html,.htm,.md,.markdown,.txt"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    onImportFile(file);
                    e.target.value = '';
                  }
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[8px] border border-[#ddd8ea] bg-[#fbfafc] hover:bg-[#f0edfc] text-[12px] font-medium text-[#1f1b2e] transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-[#7463e8]"
              >
                <FileUp className="w-3.5 h-3.5 text-[#7463e8]" aria-hidden="true" />
                <span>Import</span>
              </button>
            </>
          )}
        </div>

        <div className="relative">
          <Search
            className="w-4 h-4 text-[#7c7591] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search title, tags, or body…"
            aria-label="Search documents"
            className="w-full bg-[#fbfafc] border border-[#ddd8ea] rounded-[8px] pl-9 pr-3 py-2 text-[13px] text-[#1f1b2e] placeholder:text-[#847d99] focus-visible:outline-2 focus-visible:outline-[#7463e8]"
          />
        </div>

        {!isTrashView && availableTags.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
            <button
              type="button"
              onClick={() => onSelectTag('all')}
              className={`px-2.5 py-1 rounded-[8px] text-[11.5px] font-medium whitespace-nowrap shrink-0 transition-colors ${
                selectedTag === 'all'
                  ? 'bg-[#7463e8] text-white'
                  : 'bg-[#f6f5f8] text-[#565068] hover:text-[#1f1b2e]'
              }`}
            >
              All tags
            </button>
            {availableTags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => onSelectTag(tag)}
                className={`px-2.5 py-1 rounded-[8px] text-[11.5px] font-medium whitespace-nowrap shrink-0 transition-colors ${
                  selectedTag === tag
                    ? 'bg-[#7463e8] text-white'
                    : 'bg-[#f6f5f8] text-[#565068] hover:text-[#1f1b2e]'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {documents.length === 0 ? (
        <div className="bg-white border border-[#e6e3ee] rounded-[10px] p-6 text-center space-y-2.5">
          <p className="font-editorial text-[15px] font-bold text-[#1f1b2e]">
            {isTrashView
              ? 'Trash is empty'
              : searchQuery.trim()
              ? 'No matching documents'
              : 'No documents in this view'}
          </p>
          <p className="text-xs text-[#655f78] leading-relaxed">
            {isTrashView
              ? 'Soft-deleted documents appear here for 30 days before permanent deletion.'
              : searchQuery.trim()
              ? 'Try clearing your search filter or switching folders.'
              : 'Create a blank document or pick a template above to get started.'}
          </p>
          {!isTrashView && !searchQuery.trim() && canEdit && (
            <button
              type="button"
              onClick={onCreateBlankDocument}
              className="mt-1 inline-flex items-center justify-center px-3.5 py-2 rounded-[8px] text-xs font-semibold text-white bg-[#7463e8] hover:bg-[#6251d6]"
            >
              Create First Document
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2.5">
          {documents.map((doc) => {
            const isSelected = doc.id === selectedDocumentId;
            const versions = versionsByDoc[doc.id] || [];
            const currentVer =
              versions.find((v) => v.id === doc.currentVersionId) || versions[versions.length - 1];
            const versionNo = currentVer ? currentVer.versionNo : 1;

            return (
              <article
                key={doc.id}
                className={`bg-white rounded-[10px] border transition-all ${
                  isSelected
                    ? 'border-[#7463e8] ring-2 ring-[#7463e8]/15 shadow-[0_3px_12px_rgba(116,99,232,0.08)]'
                    : 'border-[#e6e3ee] hover:border-[#cfc8e2] shadow-[0_1px_3px_rgba(31,27,46,0.03)]'
                }`}
              >
                <button
                  type="button"
                  onClick={() => onSelectDocument(doc.id)}
                  className="w-full text-left p-3.5 focus-visible:outline-2 focus-visible:outline-[#7463e8] rounded-[10px]"
                >
                  <h3 className="font-editorial text-[15px] font-bold text-[#1f1b2e] leading-snug line-clamp-1">
                    {doc.title}
                  </h3>
                  <p className="mt-1 text-[12.5px] text-[#5c566e] leading-relaxed line-clamp-2">
                    {doc.plainText || 'Empty document — click to start writing.'}
                  </p>
                  <div className="mt-2.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11.5px] text-[#756e8a] tabular-nums">
                    <span>{getFolderName(doc.folderId)}</span>
                    <span aria-hidden="true">·</span>
                    <span>v{versionNo}</span>
                    <span aria-hidden="true">·</span>
                    <span>{doc.wordCount} words</span>
                    <span aria-hidden="true">·</span>
                    <span>{formatUpdated(doc.updatedAt)}</span>
                  </div>
                  {doc.tags.length > 0 && (
                    <div className="mt-1 text-[11px] text-[#7463e8] truncate">
                      {doc.tags.join(' · ')}
                    </div>
                  )}
                </button>

                {isTrashView && (
                  <div className="px-3.5 pb-3 pt-2 border-t border-[#f0edf6] flex items-center justify-between gap-2">
                    <button
                      type="button"
                      disabled={!canEdit}
                      onClick={() => onRestoreFromTrash(doc.id)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[8px] text-xs font-medium text-[#1f1b2e] bg-[#f6f5f8] hover:bg-[#eae6f4] disabled:opacity-50"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-[#7463e8]" aria-hidden="true" />
                      <span>Restore</span>
                    </button>
                    <button
                      type="button"
                      disabled={currentRole !== 'owner' && currentRole !== 'admin'}
                      onClick={() => onRequestPermanentDelete(doc)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[8px] text-xs font-medium text-[#b42318] bg-[#fef3f2] hover:bg-[#fee4e2] disabled:opacity-50"
                      title={
                        currentRole !== 'owner' && currentRole !== 'admin'
                          ? 'Only workspace owners or admins can permanently delete'
                          : 'Permanently delete document'
                      }
                    >
                      <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Delete Forever</span>
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
