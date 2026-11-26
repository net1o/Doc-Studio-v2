import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Bold,
  CheckCircle2,
  Download,
  FileCheck,
  Heading1,
  Heading2,
  Heading3,
  History,
  ImagePlus,
  Italic,
  LayoutTemplate,
  Link2,
  List,
  ListOrdered,
  Lock,
  PanelRightOpen,
  Pilcrow,
  Printer,
  RotateCcw,
  Save,
  SeparatorHorizontal,
  Table,
  Trash2,
  Underline,
  WifiOff,
} from 'lucide-react';
import {
  DocumentContentPayload,
  DocumentRecord,
  ExportFormat,
  Folder,
  SaveStatus,
  WorkspaceRole,
} from '../types/studio';
import { sanitizeDocumentHtml } from '../lib/security/sanitize';

interface RichEditorProps {
  document: DocumentRecord | null;
  versionNo: number;
  syncRevision: number;
  folders: Folder[];
  saveStatus: SaveStatus;
  saveErrorMessage: string | null;
  simulateAutosaveFailure: boolean;
  onToggleSimulateFailure: () => void;
  onRetrySave: () => void;
  onUpdateDraft: (
    docId: string,
    updates: {
      title: string;
      folderId: string | null;
      tags: string[];
      content: DocumentContentPayload;
    }
  ) => void;
  onSaveCheckpoint: (docId: string, summary: string) => void;
  onMoveToTrash: (docId: string) => void;
  onRestoreFromTrash: (docId: string) => void;
  onOpenPrintPreview: () => void;
  onRequestExport: (format: ExportFormat) => void;
  onSaveAsTemplate: (name: string, category: string, description: string) => void;
  onToggleInspector: () => void;
  inspectorOpen: boolean;
  currentRole: WorkspaceRole;
}

export function RichEditor({
  document: doc,
  versionNo,
  syncRevision,
  folders,
  saveStatus,
  saveErrorMessage,
  simulateAutosaveFailure,
  onToggleSimulateFailure,
  onRetrySave,
  onUpdateDraft,
  onSaveCheckpoint,
  onMoveToTrash,
  onRestoreFromTrash,
  onOpenPrintPreview,
  onRequestExport,
  onSaveAsTemplate,
  onToggleInspector,
  inspectorOpen,
  currentRole,
}: RichEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState(doc?.title || '');
  const [folderId, setFolderId] = useState<string | null>(doc?.folderId || null);
  const [tagsInput, setTagsInput] = useState(doc ? doc.tags.join(', ') : '');
  const [headerText, setHeaderText] = useState(doc?.draftContent.headerText || '');
  const [footerText, setFooterText] = useState(doc?.draftContent.footerText || '');
  const [direction, setDirection] = useState<'ltr' | 'rtl'>(doc?.draftContent.direction || 'ltr');
  const [showHeaderFooter, setShowHeaderFooter] = useState(true);

  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState('https://');
  const [showTemplatePopover, setShowTemplatePopover] = useState(false);
  const [tplName, setTplName] = useState('');
  const [tplCategory, setTplCategory] = useState('Operations');
  const [tplDesc, setTplDesc] = useState('');
  const [showCheckpointForm, setShowCheckpointForm] = useState(false);
  const [checkpointNote, setCheckpointNote] = useState('');
  const [showExportMenu, setShowExportMenu] = useState(false);

  const isReadOnly =
    currentRole === 'viewer' || !doc || doc.status === 'trashed';

  useEffect(() => {
    if (!doc) return;
    setTitle(doc.title);
    setFolderId(doc.folderId);
    setTagsInput(doc.tags.join(', '));
    setHeaderText(doc.draftContent.headerText);
    setFooterText(doc.draftContent.footerText);
    setDirection(doc.draftContent.direction);

    if (editorRef.current) {
      editorRef.current.innerHTML = sanitizeDocumentHtml(doc.draftContent.html);
    }
  }, [doc?.id, syncRevision]);

  const emitDraftChange = (
    nextOverrides?: Partial<{
      title: string;
      folderId: string | null;
      tagsInput: string;
      headerText: string;
      footerText: string;
      direction: 'ltr' | 'rtl';
      html: string;
    }>
  ) => {
    if (!doc || isReadOnly) return;
    const nextTitle = nextOverrides?.title ?? title;
    const nextFolder = nextOverrides?.folderId !== undefined ? nextOverrides.folderId : folderId;
    const nextTagsStr = nextOverrides?.tagsInput ?? tagsInput;
    const nextHeader = nextOverrides?.headerText ?? headerText;
    const nextFooter = nextOverrides?.footerText ?? footerText;
    const nextDir = nextOverrides?.direction ?? direction;
    const rawHtml =
      nextOverrides?.html ??
      (editorRef.current ? editorRef.current.innerHTML : doc.draftContent.html);

    const parsedTags = nextTagsStr
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 12);

    onUpdateDraft(doc.id, {
      title: nextTitle,
      folderId: nextFolder,
      tags: parsedTags,
      content: {
        html: sanitizeDocumentHtml(rawHtml),
        headerText: nextHeader,
        footerText: nextFooter,
        direction: nextDir,
      },
    });
  };

  const runCommand = (command: string, value?: string) => {
    if (isReadOnly || !editorRef.current) return;
    editorRef.current.focus();
    window.document.execCommand(command, false, value);
    emitDraftChange({ html: editorRef.current.innerHTML });
  };

  const insertHtmlSnippet = (snippet: string) => {
    if (isReadOnly || !editorRef.current) return;
    editorRef.current.focus();
    window.document.execCommand('insertHTML', false, snippet);
    emitDraftChange({ html: editorRef.current.innerHTML });
  };

  const handleInsertTable = () => {
    insertHtmlSnippet(
      `<table><thead><tr><th>Column A</th><th>Column B</th><th>Column C</th></tr></thead><tbody><tr><td>Item 1</td><td>Details</td><td>Owner</td></tr><tr><td>Item 2</td><td>Details</td><td>Owner</td></tr></tbody></table><p></p>`
    );
  };

  const handleInsertPageBreak = () => {
    insertHtmlSnippet(`<hr class="page-break" /><p></p>`);
  };

  const handleInsertLink = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = linkUrl.trim();
    if (!cleaned || (!cleaned.startsWith('https://') && !cleaned.startsWith('http://'))) return;
    runCommand('createLink', cleaned);
    setShowLinkInput(false);
    setLinkUrl('https://');
  };

  const handleInsertImageFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        insertHtmlSnippet(
          `<img src="${reader.result}" alt="${file.name.replace(/"/g, '')}" /><p></p>`
        );
      }
    };
    reader.readAsDataURL(file);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      if (!isReadOnly && doc) {
        onSaveCheckpoint(doc.id, 'Keyboard checkpoint (Cmd/Ctrl+S)');
      }
    }
  };

  if (!doc) {
    return (
      <div className="flex-1 studio-card p-10 flex flex-col items-center justify-center text-center min-h-[480px]">
        <h2 className="font-editorial text-xl font-bold text-[#1f1b2e]">
          Select a document to open the editor
        </h2>
        <p className="text-sm text-[#655f78] mt-2 max-w-md">
          Choose any document card on the left, create a new blank document, or launch one from the template strip above.
        </p>
      </div>
    );
  }

  return (
    <section
      aria-label="Document editor"
      className="flex-1 min-w-0 flex flex-col gap-3"
    >
      {currentRole === 'viewer' && (
        <div
          role="status"
          className="bg-[#f6f5f8] border border-[#dcd7ea] rounded-[9px] px-3.5 py-2.5 flex items-center justify-between gap-3 text-xs text-[#4c465e]"
        >
          <span className="flex items-center gap-2 font-medium">
            <Lock className="w-4 h-4 text-[#7463e8] shrink-0" aria-hidden="true" />
            Read-only access: your current role is Viewer. Switch to Editor or Owner in the sidebar to modify text.
          </span>
        </div>
      )}

      {doc.status === 'trashed' && (
        <div
          role="status"
          className="bg-[#fef7f0] border border-[#f5d5b8] rounded-[9px] px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs text-[#7a3e0e]"
        >
          <span>
            This document is in Trash and scheduled for retention review. Restore it to resume editing.
          </span>
          {currentRole !== 'viewer' && (
            <button
              type="button"
              onClick={() => onRestoreFromTrash(doc.id)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] bg-white border border-[#e5c2a0] text-[#7a3e0e] font-semibold hover:bg-[#fffaf5]"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Restore Document</span>
            </button>
          )}
        </div>
      )}

      {saveStatus === 'error' && (
        <div
          role="alert"
          className="bg-[#fef3f2] border border-[#fecdca] rounded-[9px] px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs text-[#b42318]"
        >
          <span className="flex items-center gap-2 font-medium">
            <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
            {saveErrorMessage || 'Autosave failed. Your local edits are preserved in the editor.'}
          </span>
          <button
            type="button"
            onClick={onRetrySave}
            className="px-3 py-1.5 rounded-[8px] bg-[#b42318] text-white font-semibold hover:bg-[#912018]"
          >
            Retry Save
          </button>
        </div>
      )}

      <div className="studio-card flex flex-col overflow-hidden">
        {/* Top Editor Action Bar */}
        <div className="px-4 py-2.5 border-b border-[#efecf6] bg-[#fbfafc] flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2 text-xs text-[#655f78] tabular-nums">
            {saveStatus === 'saved' && (
              <span className="inline-flex items-center gap-1.5 text-[#1f1b2e] font-medium">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#7463e8]" aria-hidden="true" />
                Saved · v{versionNo}
              </span>
            )}
            {saveStatus === 'saving' && <span>Saving draft…</span>}
            {saveStatus === 'unsaved' && <span>Unsaved changes</span>}
            {saveStatus === 'offline' && (
              <span className="inline-flex items-center gap-1.5 text-[#b45309] font-medium">
                <WifiOff className="w-3.5 h-3.5" aria-hidden="true" />
                Offline — queued locally
              </span>
            )}
            {saveStatus === 'error' && (
              <span className="text-[#b42318] font-semibold">Autosave failed</span>
            )}
            <span aria-hidden="true">·</span>
            <span>{doc.wordCount} words</span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {!isReadOnly && (
              <button
                type="button"
                onClick={onToggleSimulateFailure}
                className={`px-2.5 py-1.5 rounded-[8px] text-[12px] border transition-colors whitespace-nowrap ${
                  simulateAutosaveFailure
                    ? 'bg-[#fef3f2] border-[#fecdca] text-[#b42318] font-semibold'
                    : 'bg-white border-[#e6e3ee] text-[#655f78] hover:text-[#1f1b2e]'
                }`}
                title="Test autosave failure and recovery banner"
              >
                {simulateAutosaveFailure ? 'Failure Mode: On' : 'Test Save Error'}
              </button>
            )}

            {!isReadOnly && (
              <button
                type="button"
                onClick={() => setShowCheckpointForm((prev) => !prev)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-[12px] font-semibold text-white bg-[#7463e8] hover:bg-[#6251d6] whitespace-nowrap"
              >
                <Save className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Save Version</span>
              </button>
            )}

            <button
              type="button"
              onClick={onOpenPrintPreview}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[8px] text-[12px] font-medium bg-white border border-[#ddd8ea] text-[#1f1b2e] hover:bg-[#f6f5f8] whitespace-nowrap"
            >
              <Printer className="w-3.5 h-3.5 text-[#7463e8]" aria-hidden="true" />
              <span>Print / PDF</span>
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => setShowExportMenu((prev) => !prev)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[8px] text-[12px] font-medium bg-white border border-[#ddd8ea] text-[#1f1b2e] hover:bg-[#f6f5f8] whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5 text-[#7463e8]" aria-hidden="true" />
                <span>Export</span>
              </button>
              {showExportMenu && (
                <div className="absolute right-0 mt-1.5 w-48 bg-white border border-[#ddd8ea] rounded-[9px] shadow-lg py-1 z-30">
                  <button
                    type="button"
                    onClick={() => {
                      onRequestExport('pdf');
                      setShowExportMenu(false);
                    }}
                    className="w-full text-left px-3 py-2 text-xs text-[#1f1b2e] hover:bg-[#f6f5f8]"
                  >
                    Export PDF (v{versionNo})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onRequestExport('docx');
                      setShowExportMenu(false);
                    }}
                    className="w-full text-left px-3 py-2 text-xs text-[#1f1b2e] hover:bg-[#f6f5f8]"
                  >
                    Export DOCX / Word (v{versionNo})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onRequestExport('html');
                      setShowExportMenu(false);
                    }}
                    className="w-full text-left px-3 py-2 text-xs text-[#1f1b2e] hover:bg-[#f6f5f8]"
                  >
                    Export Clean HTML (v{versionNo})
                  </button>
                </div>
              )}
            </div>

            {!isReadOnly && (
              <button
                type="button"
                onClick={() => {
                  setTplName(`${title} Template`);
                  setShowTemplatePopover((prev) => !prev);
                }}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[8px] text-[12px] font-medium bg-white border border-[#ddd8ea] text-[#1f1b2e] hover:bg-[#f6f5f8] whitespace-nowrap"
              >
                <LayoutTemplate className="w-3.5 h-3.5 text-[#7463e8]" aria-hidden="true" />
                <span>Save Template</span>
              </button>
            )}

            <button
              type="button"
              onClick={onToggleInspector}
              aria-pressed={inspectorOpen}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[8px] text-[12px] font-medium border whitespace-nowrap ${
                inspectorOpen
                  ? 'bg-[#f0edfc] border-[#cfc6f5] text-[#5542d4]'
                  : 'bg-white border-[#ddd8ea] text-[#1f1b2e] hover:bg-[#f6f5f8]'
              }`}
            >
              {inspectorOpen ? (
                <History className="w-3.5 h-3.5" aria-hidden="true" />
              ) : (
                <PanelRightOpen className="w-3.5 h-3.5" aria-hidden="true" />
              )}
              <span>History &amp; Files</span>
            </button>

            {!isReadOnly && (
              <button
                type="button"
                onClick={() => onMoveToTrash(doc.id)}
                aria-label="Move document to trash"
                title="Move to trash"
                className="p-1.5 rounded-[8px] border border-[#e6e3ee] bg-white text-[#756e8a] hover:text-[#b42318] hover:border-[#fecdca]"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Inline Version Checkpoint Form */}
        {showCheckpointForm && !isReadOnly && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onSaveCheckpoint(doc.id, checkpointNote.trim() || 'Manual editorial checkpoint');
              setCheckpointNote('');
              setShowCheckpointForm(false);
            }}
            className="px-4 py-2.5 bg-[#f6f5f8] border-b border-[#e6e3ee] flex flex-wrap items-center gap-2"
          >
            <FileCheck className="w-4 h-4 text-[#7463e8] shrink-0" aria-hidden="true" />
            <input
              type="text"
              value={checkpointNote}
              onChange={(e) => setCheckpointNote(e.target.value)}
              placeholder="Version summary (e.g. Updated approval matrix)"
              className="flex-1 min-w-[200px] bg-white border border-[#ddd8ea] rounded-[8px] px-2.5 py-1.5 text-xs text-[#1f1b2e]"
            />
            <button
              type="submit"
              className="px-3 py-1.5 rounded-[8px] bg-[#7463e8] text-white text-xs font-semibold hover:bg-[#6251d6]"
            >
              Commit v{versionNo + 1}
            </button>
            <button
              type="button"
              onClick={() => setShowCheckpointForm(false)}
              className="px-2.5 py-1.5 text-xs text-[#655f78] hover:text-[#1f1b2e]"
            >
              Cancel
            </button>
          </form>
        )}

        {/* Inline Save As Template Form */}
        {showTemplatePopover && !isReadOnly && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!tplName.trim()) return;
              onSaveAsTemplate(tplName.trim(), tplCategory.trim() || 'General', tplDesc.trim());
              setShowTemplatePopover(false);
              setTplDesc('');
            }}
            className="px-4 py-3 bg-[#f6f5f8] border-b border-[#e6e3ee] grid grid-cols-1 sm:grid-cols-4 gap-2 items-center"
          >
            <input
              type="text"
              value={tplName}
              onChange={(e) => setTplName(e.target.value)}
              placeholder="Template name"
              required
              className="bg-white border border-[#ddd8ea] rounded-[8px] px-2.5 py-1.5 text-xs text-[#1f1b2e]"
            />
            <input
              type="text"
              value={tplCategory}
              onChange={(e) => setTplCategory(e.target.value)}
              placeholder="Category"
              className="bg-white border border-[#ddd8ea] rounded-[8px] px-2.5 py-1.5 text-xs text-[#1f1b2e]"
            />
            <input
              type="text"
              value={tplDesc}
              onChange={(e) => setTplDesc(e.target.value)}
              placeholder="Short description"
              className="bg-white border border-[#ddd8ea] rounded-[8px] px-2.5 py-1.5 text-xs text-[#1f1b2e]"
            />
            <div className="flex items-center gap-2">
              <button
                type="submit"
                className="px-3 py-1.5 rounded-[8px] bg-[#7463e8] text-white text-xs font-semibold hover:bg-[#6251d6] whitespace-nowrap"
              >
                Save Template
              </button>
              <button
                type="button"
                onClick={() => setShowTemplatePopover(false)}
                className="px-2 py-1.5 text-xs text-[#655f78]"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Rich Text Formatting Toolbar */}
        <div
          role="toolbar"
          aria-label="Formatting controls"
          className="px-4 py-2 border-b border-[#efecf6] bg-white flex flex-wrap items-center gap-1"
        >
          <ToolbarBtn
            label="Paragraph"
            disabled={isReadOnly}
            onClick={() => runCommand('formatBlock', 'P')}
            icon={<Pilcrow className="w-3.5 h-3.5" />}
          />
          <ToolbarBtn
            label="Heading 1"
            disabled={isReadOnly}
            onClick={() => runCommand('formatBlock', 'H1')}
            icon={<Heading1 className="w-3.5 h-3.5" />}
          />
          <ToolbarBtn
            label="Heading 2"
            disabled={isReadOnly}
            onClick={() => runCommand('formatBlock', 'H2')}
            icon={<Heading2 className="w-3.5 h-3.5" />}
          />
          <ToolbarBtn
            label="Heading 3"
            disabled={isReadOnly}
            onClick={() => runCommand('formatBlock', 'H3')}
            icon={<Heading3 className="w-3.5 h-3.5" />}
          />
          <span className="h-4 w-px bg-[#e6e3ee] mx-1" aria-hidden="true" />
          <ToolbarBtn
            label="Bold"
            disabled={isReadOnly}
            onClick={() => runCommand('bold')}
            icon={<Bold className="w-3.5 h-3.5" />}
          />
          <ToolbarBtn
            label="Italic"
            disabled={isReadOnly}
            onClick={() => runCommand('italic')}
            icon={<Italic className="w-3.5 h-3.5" />}
          />
          <ToolbarBtn
            label="Underline"
            disabled={isReadOnly}
            onClick={() => runCommand('underline')}
            icon={<Underline className="w-3.5 h-3.5" />}
          />
          <span className="h-4 w-px bg-[#e6e3ee] mx-1" aria-hidden="true" />
          <ToolbarBtn
            label="Bullet list"
            disabled={isReadOnly}
            onClick={() => runCommand('insertUnorderedList')}
            icon={<List className="w-3.5 h-3.5" />}
          />
          <ToolbarBtn
            label="Numbered list"
            disabled={isReadOnly}
            onClick={() => runCommand('insertOrderedList')}
            icon={<ListOrdered className="w-3.5 h-3.5" />}
          />
          <ToolbarBtn
            label="Insert table"
            disabled={isReadOnly}
            onClick={handleInsertTable}
            icon={<Table className="w-3.5 h-3.5" />}
          />
          <ToolbarBtn
            label="Insert link"
            disabled={isReadOnly}
            onClick={() => setShowLinkInput((prev) => !prev)}
            icon={<Link2 className="w-3.5 h-3.5" />}
          />
          <input
            ref={imageInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                handleInsertImageFile(file);
                e.target.value = '';
              }
            }}
          />
          <ToolbarBtn
            label="Insert image"
            disabled={isReadOnly}
            onClick={() => imageInputRef.current?.click()}
            icon={<ImagePlus className="w-3.5 h-3.5" />}
          />
          <ToolbarBtn
            label="Insert page break"
            disabled={isReadOnly}
            onClick={handleInsertPageBreak}
            icon={<SeparatorHorizontal className="w-3.5 h-3.5" />}
          />

          <div className="ml-auto flex items-center gap-1.5">
            <button
              type="button"
              disabled={isReadOnly}
              onClick={() => {
                const nextDir = direction === 'ltr' ? 'rtl' : 'ltr';
                setDirection(nextDir);
                emitDraftChange({ direction: nextDir });
              }}
              className="px-2 py-1 rounded-[7px] border border-[#e6e3ee] text-[11.5px] font-medium text-[#4c465e] hover:bg-[#f6f5f8] disabled:opacity-50"
              title="Toggle text direction (LTR / RTL for Urdu readiness)"
            >
              Dir: {direction.toUpperCase()}
            </button>
            <button
              type="button"
              onClick={() => setShowHeaderFooter((prev) => !prev)}
              className="px-2 py-1 rounded-[7px] border border-[#e6e3ee] text-[11.5px] font-medium text-[#4c465e] hover:bg-[#f6f5f8]"
            >
              {showHeaderFooter ? 'Hide Header/Footer' : 'Show Header/Footer'}
            </button>
          </div>
        </div>

        {showLinkInput && !isReadOnly && (
          <form
            onSubmit={handleInsertLink}
            className="px-4 py-2 bg-[#f6f5f8] border-b border-[#e6e3ee] flex items-center gap-2"
          >
            <input
              type="url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://example.com"
              className="flex-1 bg-white border border-[#ddd8ea] rounded-[8px] px-2.5 py-1 text-xs text-[#1f1b2e]"
            />
            <button
              type="submit"
              className="px-3 py-1 rounded-[8px] bg-[#7463e8] text-white text-xs font-semibold"
            >
              Apply Link
            </button>
            <button
              type="button"
              onClick={() => setShowLinkInput(false)}
              className="px-2 py-1 text-xs text-[#655f78]"
            >
              Cancel
            </button>
          </form>
        )}

        {/* Document Paper Canvas */}
        <div className="p-5 sm:p-8 lg:px-12 lg:py-9 bg-white" dir={direction}>
          {showHeaderFooter && (
            <div className="mb-5 pb-2.5 border-b border-[#efecf6]">
              <input
                type="text"
                value={headerText}
                disabled={isReadOnly}
                onChange={(e) => {
                  setHeaderText(e.target.value);
                  emitDraftChange({ headerText: e.target.value });
                }}
                placeholder="Document header (optional)"
                aria-label="Document header"
                className="w-full text-[12px] text-[#756e8a] bg-transparent focus:outline-none focus:text-[#1f1b2e]"
              />
            </div>
          )}

          <input
            type="text"
            value={title}
            disabled={isReadOnly}
            onChange={(e) => {
              setTitle(e.target.value);
              emitDraftChange({ title: e.target.value });
            }}
            placeholder="Untitled Document"
            aria-label="Document title"
            className="w-full font-editorial text-2xl sm:text-[28px] font-bold text-[#171326] bg-transparent border-none focus:outline-none mb-3"
          />

          <div className="flex flex-wrap items-center gap-3 pb-4 mb-5 border-b border-[#efecf6] text-xs text-[#655f78]">
            <label className="inline-flex items-center gap-1.5">
              <span>Folder:</span>
              <select
                value={folderId || ''}
                disabled={isReadOnly}
                onChange={(e) => {
                  const next = e.target.value || null;
                  setFolderId(next);
                  emitDraftChange({ folderId: next });
                }}
                className="bg-[#fbfafc] border border-[#e6e3ee] rounded-[7px] px-2 py-1 text-xs text-[#1f1b2e]"
              >
                <option value="">Unfiled</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="inline-flex items-center gap-1.5 flex-1 min-w-[200px]">
              <span>Tags:</span>
              <input
                type="text"
                value={tagsInput}
                disabled={isReadOnly}
                onChange={(e) => {
                  setTagsInput(e.target.value);
                  emitDraftChange({ tagsInput: e.target.value });
                }}
                placeholder="comma-separated tags"
                className="flex-1 bg-[#fbfafc] border border-[#e6e3ee] rounded-[7px] px-2.5 py-1 text-xs text-[#1f1b2e]"
              />
            </label>
          </div>

          <div
            ref={editorRef}
            contentEditable={!isReadOnly}
            suppressContentEditableWarning
            role="textbox"
            aria-multiline="true"
            aria-label="Document body"
            onInput={() => {
              if (editorRef.current) {
                emitDraftChange({ html: editorRef.current.innerHTML });
              }
            }}
            onKeyDown={handleKeyDown}
            className="studio-prose min-h-[340px]"
          />

          {showHeaderFooter && (
            <div className="mt-8 pt-3 border-t border-[#efecf6]">
              <input
                type="text"
                value={footerText}
                disabled={isReadOnly}
                onChange={(e) => {
                  setFooterText(e.target.value);
                  emitDraftChange({ footerText: e.target.value });
                }}
                placeholder="Document footer (optional)"
                aria-label="Document footer"
                className="w-full text-[12px] text-[#756e8a] bg-transparent focus:outline-none focus:text-[#1f1b2e]"
              />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function ToolbarBtn({
  label,
  icon,
  onClick,
  disabled,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={label}
      title={label}
      className="p-1.5 rounded-[7px] text-[#4c465e] hover:bg-[#f0edfc] hover:text-[#7463e8] disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus-visible:outline-2 focus-visible:outline-[#7463e8]"
    >
      {icon}
    </button>
  );
}
