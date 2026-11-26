import { useEffect, useMemo, useRef, useState } from 'react';
import { Menu, RotateCw } from 'lucide-react';
import {
  DocumentContentPayload,
  DocumentRecord,
  DocumentTemplate,
  DocumentVersion,
  ExportFormat,
  ExportJob,
  SaveStatus,
  StudioView,
  WorkspaceRole,
} from './types/studio';
import {
  createAuditEntry,
  loadStudioState,
  resetStudioState,
  saveStudioState,
  StudioState,
} from './lib/storage/studioStore';
import {
  computeFileSha256,
  countWords,
  extractPlainText,
  normalizeFilename,
  sanitizeDocumentHtml,
} from './lib/security/sanitize';
import {
  assetUploadSchema,
  createTemplateSchema,
  exportRequestSchema,
  updateDocumentSchema,
} from './lib/validation/schemas';
import {
  downloadExportArtifact,
  parseImportedFileToHtml,
} from './lib/exports/exportAdapter';
import { Sidebar } from './components/Sidebar';
import { ProjectStatusBar } from './components/ProjectStatusBar';
import { TemplatePicker } from './components/TemplatePicker';
import { DocumentList } from './components/DocumentList';
import { RichEditor } from './components/RichEditor';
import { InspectorDrawer } from './components/InspectorDrawer';
import { PrintPreviewModal } from './components/PrintPreviewModal';
import { ConfirmModal } from './components/ConfirmModal';
import { MembersView } from './components/MembersView';
import { AuditLogView } from './components/AuditLogView';

export default function App() {
  const [state, setState] = useState<StudioState>(() => loadStudioState());
  const [activeView, setActiveView] = useState<StudioView>('documents');
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(() => {
    const initial = loadStudioState();
    const firstActive = initial.documents.find(
      (d) => d.workspaceId === initial.activeWorkspaceId && d.status === 'active'
    );
    return firstActive?.id || null;
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState('all');
  const [roleOverride, setRoleOverride] = useState<WorkspaceRole>('owner');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [printPreviewOpen, setPrintPreviewOpen] = useState(false);
  const [confirmDeleteDoc, setConfirmDeleteDoc] = useState<DocumentRecord | null>(null);

  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [saveErrorMessage, setSaveErrorMessage] = useState<string | null>(null);
  const [simulateAutosaveFailure, setSimulateAutosaveFailure] = useState(false);
  const [syncRevision, setSyncRevision] = useState(0);
  const [toast, setToast] = useState<{ kind: 'info' | 'error'; message: string } | null>(null);

  const autosaveTimerRef = useRef<number | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const showToast = (message: string, kind: 'info' | 'error' = 'info') => {
    setToast({ message, kind });
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    saveStudioState(state);
  }, [state]);

  useEffect(() => {
    const onOffline = () => setSaveStatus('offline');
    const onOnline = () => setSaveStatus('saved');
    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);
    return () => {
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
    };
  }, []);

  const activeWorkspace = useMemo(
    () =>
      state.workspaces.find((w) => w.id === state.activeWorkspaceId) ||
      state.workspaces[0],
    [state.workspaces, state.activeWorkspaceId]
  );

  const workspaceFolders = useMemo(
    () => state.folders.filter((f) => f.workspaceId === activeWorkspace.id),
    [state.folders, activeWorkspace.id]
  );

  const workspaceDocs = useMemo(
    () => state.documents.filter((d) => d.workspaceId === activeWorkspace.id),
    [state.documents, activeWorkspace.id]
  );

  const activeDocs = useMemo(
    () => workspaceDocs.filter((d) => d.status === 'active'),
    [workspaceDocs]
  );

  const trashedDocs = useMemo(
    () => workspaceDocs.filter((d) => d.status === 'trashed'),
    [workspaceDocs]
  );

  const workspaceTemplates = useMemo(
    () => state.templates.filter((t) => t.workspaceId === activeWorkspace.id),
    [state.templates, activeWorkspace.id]
  );

  const workspaceMembers = useMemo(
    () => state.members.filter((m) => m.workspaceId === activeWorkspace.id),
    [state.members, activeWorkspace.id]
  );

  const workspaceAuditEvents = useMemo(
    () =>
      [...state.auditEvents]
        .filter((e) => e.workspaceId === activeWorkspace.id)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [state.auditEvents, activeWorkspace.id]
  );

  const folderCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const doc of activeDocs) {
      if (doc.folderId) {
        counts[doc.folderId] = (counts[doc.folderId] || 0) + 1;
      }
    }
    return counts;
  }, [activeDocs]);

  const availableTags = useMemo(() => {
    const set = new Set<string>();
    for (const d of activeDocs) {
      for (const t of d.tags) set.add(t);
    }
    return Array.from(set).sort();
  }, [activeDocs]);

  const versionsByDoc = useMemo(() => {
    const map: Record<string, DocumentVersion[]> = {};
    for (const v of state.versions) {
      if (!map[v.documentId]) map[v.documentId] = [];
      map[v.documentId].push(v);
    }
    return map;
  }, [state.versions]);

  const filteredDocuments = useMemo(() => {
    const pool = activeView === 'trash' ? trashedDocs : activeDocs;
    return pool
      .filter((doc) => {
        if (activeView !== 'trash' && activeFolderId && doc.folderId !== activeFolderId) {
          return false;
        }
        if (activeView !== 'trash' && selectedTag !== 'all' && !doc.tags.includes(selectedTag)) {
          return false;
        }
        const q = searchQuery.trim().toLowerCase();
        if (!q) return true;
        return (
          doc.title.toLowerCase().includes(q) ||
          doc.plainText.toLowerCase().includes(q) ||
          doc.tags.some((t) => t.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [activeView, trashedDocs, activeDocs, activeFolderId, selectedTag, searchQuery]);

  const selectedDocument = useMemo(() => {
    if (!selectedDocId) return filteredDocuments[0] || null;
    const found = workspaceDocs.find((d) => d.id === selectedDocId);
    if (found) return found;
    return filteredDocuments[0] || null;
  }, [selectedDocId, workspaceDocs, filteredDocuments]);

  const selectedDocVersions = useMemo(
    () => (selectedDocument ? versionsByDoc[selectedDocument.id] || [] : []),
    [selectedDocument, versionsByDoc]
  );

  const selectedDocVersionNo = useMemo(() => {
    if (!selectedDocument) return 1;
    const match = selectedDocVersions.find((v) => v.id === selectedDocument.currentVersionId);
    return match ? match.versionNo : selectedDocVersions.length || 1;
  }, [selectedDocument, selectedDocVersions]);

  const selectedDocExports = useMemo(
    () =>
      selectedDocument
        ? [...state.exports]
            .filter(
              (ex) =>
                ex.workspaceId === activeWorkspace.id &&
                ex.documentId === selectedDocument.id
            )
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        : [],
    [state.exports, activeWorkspace.id, selectedDocument]
  );

  const selectedDocAssets = useMemo(
    () =>
      selectedDocument
        ? state.assets.filter(
            (a) =>
              a.workspaceId === activeWorkspace.id &&
              a.documentId === selectedDocument.id
          )
        : [],
    [state.assets, activeWorkspace.id, selectedDocument]
  );

  const handleSelectWorkspace = (workspaceId: string) => {
    setState((prev) => ({ ...prev, activeWorkspaceId: workspaceId }));
    setActiveView('documents');
    setActiveFolderId(null);
    setSearchQuery('');
    setSelectedTag('all');
    const firstDoc = state.documents.find(
      (d) => d.workspaceId === workspaceId && d.status === 'active'
    );
    setSelectedDocId(firstDoc?.id || null);
    setSyncRevision((r) => r + 1);
  };

  const handleCreateFolder = (name: string) => {
    const newFolderId = `fld_${Date.now().toString(36)}`;
    setState((prev) => ({
      ...prev,
      folders: [
        ...prev.folders,
        {
          id: newFolderId,
          workspaceId: activeWorkspace.id,
          parentId: null,
          name,
          createdAt: new Date().toISOString(),
        },
      ],
    }));
    showToast(`Folder "${name}" created.`);
  };

  const createDocumentWithContent = (params: {
    title: string;
    tags: string[];
    content: DocumentContentPayload;
    source: 'manual' | 'import';
    summary: string;
    auditAction: 'document.created' | 'document.imported' | 'template.applied';
  }) => {
    if (roleOverride === 'viewer') return;
    const now = new Date().toISOString();
    const docId = `doc_${Date.now().toString(36)}`;
    const versionId = `ver_${Date.now().toString(36)}`;
    const plain = extractPlainText(params.content.html);
    const words = countWords(plain);

    const newVersion: DocumentVersion = {
      id: versionId,
      documentId: docId,
      versionNo: 1,
      content: params.content,
      plainText: plain,
      wordCount: words,
      createdBy: state.currentUser.id,
      createdByName: state.currentUser.displayName,
      source: params.source,
      summary: params.summary,
      createdAt: now,
    };

    const newDoc: DocumentRecord = {
      id: docId,
      workspaceId: activeWorkspace.id,
      folderId: activeFolderId,
      title: params.title,
      tags: params.tags,
      status: 'active',
      currentVersionId: versionId,
      draftContent: params.content,
      plainText: plain,
      wordCount: words,
      createdBy: state.currentUser.id,
      createdByName: state.currentUser.displayName,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    setState((prev) => ({
      ...prev,
      documents: [newDoc, ...prev.documents],
      versions: [...prev.versions, newVersion],
      auditEvents: [
        createAuditEntry({
          workspaceId: activeWorkspace.id,
          actorId: state.currentUser.id,
          actorName: state.currentUser.displayName,
          action: params.auditAction,
          entityType: 'document',
          entityId: docId,
          entityLabel: params.title,
          metadata: { wordCount: words },
        }),
        ...prev.auditEvents,
      ],
    }));

    setActiveView('documents');
    setSelectedDocId(docId);
    setSyncRevision((r) => r + 1);
    setSaveStatus('saved');
    showToast(`Created "${params.title}".`);
  };

  const handleCreateBlankDocument = () => {
    createDocumentWithContent({
      title: 'Untitled Business Document',
      tags: ['draft'],
      content: {
        headerText: `${activeWorkspace.name} · Working Draft`,
        footerText: 'Document Studio',
        direction: 'ltr',
        html: sanitizeDocumentHtml('<p>Start writing your document here…</p>'),
      },
      source: 'manual',
      summary: 'Initial blank document',
      auditAction: 'document.created',
    });
  };

  const handleUseTemplate = (tpl: DocumentTemplate) => {
    createDocumentWithContent({
      title: `${tpl.name} — ${new Date().toLocaleDateString()}`,
      tags: [tpl.category.toLowerCase()],
      content: { ...tpl.content },
      source: 'manual',
      summary: `Created from template: ${tpl.name}`,
      auditAction: 'template.applied',
    });
  };

  const handleUpdateDraft = (
    docId: string,
    updates: {
      title: string;
      folderId: string | null;
      tags: string[];
      content: DocumentContentPayload;
    }
  ) => {
    if (roleOverride === 'viewer') return;

    const validation = updateDocumentSchema.safeParse({
      id: docId,
      workspaceId: activeWorkspace.id,
      title: updates.title || 'Untitled Document',
      tags: updates.tags,
      folderId: updates.folderId,
      content: updates.content,
    });

    if (!validation.success) {
      setSaveStatus('error');
      setSaveErrorMessage(validation.error.issues[0]?.message || 'Validation failed.');
      return;
    }

    const plain = extractPlainText(updates.content.html);
    const words = countWords(plain);
    const now = new Date().toISOString();

    setState((prev) => ({
      ...prev,
      documents: prev.documents.map((d) =>
        d.id === docId && d.workspaceId === activeWorkspace.id
          ? {
              ...d,
              title: updates.title || 'Untitled Document',
              folderId: updates.folderId,
              tags: updates.tags,
              draftContent: updates.content,
              plainText: plain,
              wordCount: words,
              updatedAt: now,
            }
          : d
      ),
    }));

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setSaveStatus('offline');
      return;
    }

    setSaveStatus('saving');
    if (autosaveTimerRef.current) window.clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = window.setTimeout(() => {
      if (simulateAutosaveFailure) {
        setSaveStatus('error');
        setSaveErrorMessage(
          'Simulated network interruption during autosave. Your draft remains intact.'
        );
      } else {
        setSaveStatus('saved');
        setSaveErrorMessage(null);
      }
    }, 350);
  };

  const handleRetrySave = () => {
    setSimulateAutosaveFailure(false);
    setSaveStatus('saving');
    window.setTimeout(() => {
      setSaveStatus('saved');
      setSaveErrorMessage(null);
      showToast('Draft recovered and saved.');
    }, 250);
  };

  const handleSaveCheckpoint = (docId: string, summary: string) => {
    if (roleOverride === 'viewer') return;
    const targetDoc = state.documents.find(
      (d) => d.id === docId && d.workspaceId === activeWorkspace.id
    );
    if (!targetDoc) return;

    const existingVersions = versionsByDoc[docId] || [];
    const nextNo =
      existingVersions.reduce((max, v) => Math.max(max, v.versionNo), 0) + 1;
    const verId = `ver_${Date.now().toString(36)}`;
    const now = new Date().toISOString();

    const newVersion: DocumentVersion = {
      id: verId,
      documentId: docId,
      versionNo: nextNo,
      content: { ...targetDoc.draftContent },
      plainText: targetDoc.plainText,
      wordCount: targetDoc.wordCount,
      createdBy: state.currentUser.id,
      createdByName: state.currentUser.displayName,
      source: 'manual',
      summary,
      createdAt: now,
    };

    setState((prev) => ({
      ...prev,
      versions: [...prev.versions, newVersion],
      documents: prev.documents.map((d) =>
        d.id === docId ? { ...d, currentVersionId: verId, updatedAt: now } : d
      ),
      auditEvents: [
        createAuditEntry({
          workspaceId: activeWorkspace.id,
          actorId: state.currentUser.id,
          actorName: state.currentUser.displayName,
          action: 'document.version_saved',
          entityType: 'version',
          entityId: verId,
          entityLabel: `${targetDoc.title} (v${nextNo})`,
          metadata: { versionNo: nextNo },
        }),
        ...prev.auditEvents,
      ],
    }));

    setSaveStatus('saved');
    showToast(`Saved immutable snapshot v${nextNo}.`);
  };

  const handleRestoreVersion = (docId: string, versionId: string) => {
    if (roleOverride === 'viewer') return;
    const targetDoc = state.documents.find(
      (d) => d.id === docId && d.workspaceId === activeWorkspace.id
    );
    const sourceVersion = state.versions.find(
      (v) => v.id === versionId && v.documentId === docId
    );
    if (!targetDoc || !sourceVersion) return;

    const existingVersions = versionsByDoc[docId] || [];
    const nextNo =
      existingVersions.reduce((max, v) => Math.max(max, v.versionNo), 0) + 1;
    const newVerId = `ver_${Date.now().toString(36)}`;
    const now = new Date().toISOString();

    const restoredVersion: DocumentVersion = {
      id: newVerId,
      documentId: docId,
      versionNo: nextNo,
      content: { ...sourceVersion.content },
      plainText: sourceVersion.plainText,
      wordCount: sourceVersion.wordCount,
      createdBy: state.currentUser.id,
      createdByName: state.currentUser.displayName,
      source: 'restore',
      summary: `Restored from v${sourceVersion.versionNo}`,
      createdAt: now,
    };

    setState((prev) => ({
      ...prev,
      versions: [...prev.versions, restoredVersion],
      documents: prev.documents.map((d) =>
        d.id === docId
          ? {
              ...d,
              currentVersionId: newVerId,
              draftContent: { ...sourceVersion.content },
              plainText: sourceVersion.plainText,
              wordCount: sourceVersion.wordCount,
              updatedAt: now,
            }
          : d
      ),
      auditEvents: [
        createAuditEntry({
          workspaceId: activeWorkspace.id,
          actorId: state.currentUser.id,
          actorName: state.currentUser.displayName,
          action: 'document.restored_version',
          entityType: 'version',
          entityId: newVerId,
          entityLabel: `${targetDoc.title} (v${sourceVersion.versionNo} -> v${nextNo})`,
          metadata: { fromVersion: sourceVersion.versionNo, toVersion: nextNo },
        }),
        ...prev.auditEvents,
      ],
    }));

    setSyncRevision((r) => r + 1);
    showToast(`Restored v${sourceVersion.versionNo} as new version v${nextNo}.`);
  };

  const handleMoveToTrash = (docId: string) => {
    if (roleOverride === 'viewer') return;
    const doc = state.documents.find((d) => d.id === docId);
    if (!doc) return;
    const now = new Date().toISOString();

    setState((prev) => ({
      ...prev,
      documents: prev.documents.map((d) =>
        d.id === docId ? { ...d, status: 'trashed', deletedAt: now, updatedAt: now } : d
      ),
      auditEvents: [
        createAuditEntry({
          workspaceId: activeWorkspace.id,
          actorId: state.currentUser.id,
          actorName: state.currentUser.displayName,
          action: 'document.trashed',
          entityType: 'document',
          entityId: docId,
          entityLabel: doc.title,
          metadata: { retentionDays: 30 },
        }),
        ...prev.auditEvents,
      ],
    }));
    showToast(`Moved "${doc.title}" to Trash.`);
  };

  const handleRestoreFromTrash = (docId: string) => {
    if (roleOverride === 'viewer') return;
    const doc = state.documents.find((d) => d.id === docId);
    if (!doc) return;
    const now = new Date().toISOString();

    setState((prev) => ({
      ...prev,
      documents: prev.documents.map((d) =>
        d.id === docId ? { ...d, status: 'active', deletedAt: null, updatedAt: now } : d
      ),
      auditEvents: [
        createAuditEntry({
          workspaceId: activeWorkspace.id,
          actorId: state.currentUser.id,
          actorName: state.currentUser.displayName,
          action: 'document.restored_from_trash',
          entityType: 'document',
          entityId: docId,
          entityLabel: doc.title,
          metadata: {},
        }),
        ...prev.auditEvents,
      ],
    }));
    setActiveView('documents');
    setSelectedDocId(docId);
    showToast(`Restored "${doc.title}" from Trash.`);
  };

  const handlePermanentDelete = () => {
    if (!confirmDeleteDoc) return;
    if (roleOverride !== 'owner' && roleOverride !== 'admin') return;
    const doc = confirmDeleteDoc;

    setState((prev) => ({
      ...prev,
      documents: prev.documents.filter((d) => d.id !== doc.id),
      versions: prev.versions.filter((v) => v.documentId !== doc.id),
      assets: prev.assets.filter((a) => a.documentId !== doc.id),
      exports: prev.exports.filter((ex) => ex.documentId !== doc.id),
      auditEvents: [
        createAuditEntry({
          workspaceId: activeWorkspace.id,
          actorId: state.currentUser.id,
          actorName: state.currentUser.displayName,
          action: 'document.permanently_deleted',
          entityType: 'document',
          entityId: doc.id,
          entityLabel: doc.title,
          metadata: { irreversible: true },
        }),
        ...prev.auditEvents,
      ],
    }));

    setConfirmDeleteDoc(null);
    if (selectedDocId === doc.id) {
      setSelectedDocId(null);
    }
    showToast(`Permanently deleted "${doc.title}".`);
  };

  const handleImportFile = async (file: File) => {
    if (roleOverride === 'viewer') return;
    const lower = file.name.toLowerCase();
    const supported =
      lower.endsWith('.html') ||
      lower.endsWith('.htm') ||
      lower.endsWith('.md') ||
      lower.endsWith('.markdown') ||
      lower.endsWith('.txt');

    if (!supported) {
      showToast(
        'Import failed: only .html, .md, and .txt files are supported in local import.',
        'error'
      );
      return;
    }

    if (file.size > 512 * 1024) {
      showToast('Import failed: file exceeds 512 KB limit.', 'error');
      return;
    }

    const rawText = await file.text();
    const parsed = parseImportedFileToHtml(file.name, rawText);

    createDocumentWithContent({
      title: parsed.title,
      tags: ['imported'],
      content: {
        headerText: `${activeWorkspace.name} · Imported`,
        footerText: `Source: ${normalizeFilename(file.name)}`,
        direction: 'ltr',
        html: parsed.html,
      },
      source: 'import',
      summary: `Imported from ${normalizeFilename(file.name)}`,
      auditAction: 'document.imported',
    });
  };

  const handleSaveAsTemplate = (name: string, category: string, description: string) => {
    if (!selectedDocument || roleOverride === 'viewer') return;
    const check = createTemplateSchema.safeParse({
      workspaceId: activeWorkspace.id,
      name,
      category,
      description,
      content: selectedDocument.draftContent,
    });
    if (!check.success) {
      showToast(check.error.issues[0]?.message || 'Invalid template fields.', 'error');
      return;
    }

    const tplId = `tpl_${Date.now().toString(36)}`;
    setState((prev) => ({
      ...prev,
      templates: [
        {
          id: tplId,
          workspaceId: activeWorkspace.id,
          name: check.data.name,
          category: check.data.category,
          description: check.data.description || 'Custom workspace template',
          content: { ...selectedDocument.draftContent },
          createdBy: state.currentUser.id,
          isShared: true,
          createdAt: new Date().toISOString(),
        },
        ...prev.templates,
      ],
      auditEvents: [
        createAuditEntry({
          workspaceId: activeWorkspace.id,
          actorId: state.currentUser.id,
          actorName: state.currentUser.displayName,
          action: 'template.created',
          entityType: 'template',
          entityId: tplId,
          entityLabel: check.data.name,
          metadata: { category: check.data.category },
        }),
        ...prev.auditEvents,
      ],
    }));

    showToast(`Template "${check.data.name}" saved.`);
  };

  const handleRequestExport = (format: ExportFormat) => {
    if (!selectedDocument) return;
    const version =
      selectedDocVersions.find((v) => v.id === selectedDocument.currentVersionId) ||
      selectedDocVersions[selectedDocVersions.length - 1];
    if (!version) return;

    const valid = exportRequestSchema.safeParse({
      documentId: selectedDocument.id,
      versionId: version.id,
      format,
    });
    if (!valid.success) {
      showToast('Invalid export request.', 'error');
      return;
    }

    if (format === 'pdf') {
      setPrintPreviewOpen(true);
    } else {
      downloadExportArtifact(selectedDocument, version, format);
    }

    const exportId = `exp_${Date.now().toString(36)}`;
    const now = new Date().toISOString();
    const job: ExportJob = {
      id: exportId,
      workspaceId: activeWorkspace.id,
      documentId: selectedDocument.id,
      versionId: version.id,
      versionNo: version.versionNo,
      documentTitle: selectedDocument.title,
      format,
      status: 'ready',
      errorCode: null,
      requestedByName: state.currentUser.displayName,
      createdAt: now,
      completedAt: now,
    };

    setState((prev) => ({
      ...prev,
      exports: [job, ...prev.exports],
      auditEvents: [
        createAuditEntry({
          workspaceId: activeWorkspace.id,
          actorId: state.currentUser.id,
          actorName: state.currentUser.displayName,
          action: 'export.completed',
          entityType: 'export',
          entityId: exportId,
          entityLabel: `${selectedDocument.title} (${format.toUpperCase()} v${version.versionNo})`,
          metadata: { format, versionNo: version.versionNo },
        }),
        ...prev.auditEvents,
      ],
    }));
    setInspectorOpen(true);
    showToast(`Exported ${format.toUpperCase()} for v${version.versionNo}.`);
  };

  const handleRetryExport = (exportId: string) => {
    const job = state.exports.find((ex) => ex.id === exportId);
    if (!job) return;
    const doc = state.documents.find((d) => d.id === job.documentId);
    const ver = state.versions.find((v) => v.id === job.versionId);
    if (!doc || !ver) return;

    const now = new Date().toISOString();
    downloadExportArtifact(doc, ver, job.format);

    setState((prev) => ({
      ...prev,
      exports: prev.exports.map((ex) =>
        ex.id === exportId
          ? { ...ex, status: 'ready', errorCode: null, completedAt: now }
          : ex
      ),
      auditEvents: [
        createAuditEntry({
          workspaceId: activeWorkspace.id,
          actorId: state.currentUser.id,
          actorName: state.currentUser.displayName,
          action: 'export.completed',
          entityType: 'export',
          entityId: exportId,
          entityLabel: `${doc.title} (Retry ${job.format.toUpperCase()} v${ver.versionNo})`,
          metadata: { format: job.format, retried: true },
        }),
        ...prev.auditEvents,
      ],
    }));

    showToast(`Retried ${job.format.toUpperCase()} export successfully.`);
  };

  const handleDownloadExport = (job: ExportJob) => {
    const doc = state.documents.find((d) => d.id === job.documentId);
    const ver = state.versions.find((v) => v.id === job.versionId);
    if (!doc || !ver) return;
    if (job.format === 'pdf') {
      setPrintPreviewOpen(true);
    } else {
      downloadExportArtifact(doc, ver, job.format);
    }
  };

  const handleUploadAsset = async (file: File) => {
    if (!selectedDocument || roleOverride === 'viewer') return;
    const parsed = assetUploadSchema.safeParse({
      originalName: normalizeFilename(file.name),
      mimeType: file.type || 'application/octet-stream',
      byteSize: file.size,
    });

    if (!parsed.success) {
      showToast(
        'Upload rejected: supported types are PNG, JPEG, WebP, PDF, TXT, CSV, DOCX under 5 MB.',
        'error'
      );
      return;
    }

    const sha256 = await computeFileSha256(file);
    const dataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
      reader.readAsDataURL(file);
    });

    const assetId = `ast_${Date.now().toString(36)}`;
    setState((prev) => ({
      ...prev,
      assets: [
        {
          id: assetId,
          workspaceId: activeWorkspace.id,
          documentId: selectedDocument.id,
          originalName: parsed.data.originalName,
          mimeType: parsed.data.mimeType,
          byteSize: parsed.data.byteSize,
          sha256,
          dataUrl,
          uploadedBy: state.currentUser.id,
          uploadedByName: state.currentUser.displayName,
          createdAt: new Date().toISOString(),
        },
        ...prev.assets,
      ],
      auditEvents: [
        createAuditEntry({
          workspaceId: activeWorkspace.id,
          actorId: state.currentUser.id,
          actorName: state.currentUser.displayName,
          action: 'asset.uploaded',
          entityType: 'asset',
          entityId: assetId,
          entityLabel: parsed.data.originalName,
          metadata: { byteSize: parsed.data.byteSize },
        }),
        ...prev.auditEvents,
      ],
    }));
    showToast(`Attached "${parsed.data.originalName}".`);
  };

  const handleDeleteAsset = (assetId: string) => {
    if (roleOverride === 'viewer') return;
    const asset = state.assets.find((a) => a.id === assetId);
    if (!asset) return;

    setState((prev) => ({
      ...prev,
      assets: prev.assets.filter((a) => a.id !== assetId),
      auditEvents: [
        createAuditEntry({
          workspaceId: activeWorkspace.id,
          actorId: state.currentUser.id,
          actorName: state.currentUser.displayName,
          action: 'asset.deleted',
          entityType: 'asset',
          entityId: assetId,
          entityLabel: asset.originalName,
          metadata: {},
        }),
        ...prev.auditEvents,
      ],
    }));
    showToast(`Removed attachment "${asset.originalName}".`);
  };

  const handleUpdateMemberRole = (userId: string, role: WorkspaceRole) => {
    const member = workspaceMembers.find((m) => m.userId === userId);
    if (!member) return;

    setState((prev) => ({
      ...prev,
      members: prev.members.map((m) =>
        m.workspaceId === activeWorkspace.id && m.userId === userId ? { ...m, role } : m
      ),
      auditEvents: [
        createAuditEntry({
          workspaceId: activeWorkspace.id,
          actorId: state.currentUser.id,
          actorName: state.currentUser.displayName,
          action: 'member.role_updated',
          entityType: 'member',
          entityId: userId,
          entityLabel: `${member.displayName} -> ${role}`,
          metadata: { role },
        }),
        ...prev.auditEvents,
      ],
    }));
    showToast(`Updated ${member.displayName} to ${role}.`);
  };

  const handleInviteMember = (
    displayName: string,
    email: string,
    role: 'admin' | 'editor' | 'viewer'
  ) => {
    const userId = `usr_${Date.now().toString(36)}`;
    setState((prev) => ({
      ...prev,
      members: [
        ...prev.members,
        {
          workspaceId: activeWorkspace.id,
          userId,
          displayName,
          email,
          role,
          joinedAt: new Date().toISOString(),
        },
      ],
      auditEvents: [
        createAuditEntry({
          workspaceId: activeWorkspace.id,
          actorId: state.currentUser.id,
          actorName: state.currentUser.displayName,
          action: 'member.role_updated',
          entityType: 'member',
          entityId: userId,
          entityLabel: `${displayName} (${role})`,
          metadata: { invited: true, role },
        }),
        ...prev.auditEvents,
      ],
    }));
    showToast(`Added ${displayName} to ${activeWorkspace.name}.`);
  };

  const handleResetDemoData = () => {
    const fresh = resetStudioState();
    setState(fresh);
    setActiveView('documents');
    setActiveFolderId(null);
    setSelectedDocId('doc_readiness_brief');
    setSyncRevision((r) => r + 1);
    setSaveStatus('saved');
    showToast('Workspace reset to baseline fixtures.');
  };

  const activeFolderName =
    activeFolderId ? workspaceFolders.find((f) => f.id === activeFolderId)?.name || null : null;

  return (
    <div className="min-h-screen bg-[#fbfafc] text-[#1f1b2e] flex">
      <Sidebar
        workspaces={state.workspaces}
        activeWorkspaceId={activeWorkspace.id}
        onSelectWorkspace={handleSelectWorkspace}
        activeView={activeView}
        onSelectView={setActiveView}
        folders={workspaceFolders}
        activeFolderId={activeFolderId}
        onSelectFolder={setActiveFolderId}
        onCreateFolder={handleCreateFolder}
        onCreateBlankDocument={handleCreateBlankDocument}
        activeDocCount={activeDocs.length}
        trashCount={trashedDocs.length}
        templateCount={workspaceTemplates.length}
        folderCounts={folderCounts}
        currentRole={roleOverride}
        onChangeRolePreview={setRoleOverride}
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Compact Workspace Context Bar */}
        <header className="no-print bg-[#fbfafc] border-b border-[#e6e3ee] px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(true)}
              aria-label="Open workspace navigation"
              className="lg:hidden p-2 rounded-[8px] border border-[#ddd8ea] bg-white text-[#1f1b2e]"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2 text-xs text-[#655f78] min-w-0 truncate">
              <span className="font-semibold text-[#1f1b2e] truncate">
                {activeWorkspace.name}
              </span>
              <span aria-hidden="true">/</span>
              <span className="capitalize truncate">
                {activeFolderName || activeView}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <span className="hidden sm:inline text-xs text-[#655f78]">
              {state.currentUser.displayName} · <span className="capitalize">{roleOverride}</span>
            </span>
            <button
              type="button"
              onClick={handleResetDemoData}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[8px] border border-[#e6e3ee] bg-white hover:bg-[#f6f5f8] text-[12px] text-[#4c465e] whitespace-nowrap"
              title="Reset local workspace fixtures"
            >
              <RotateCw className="w-3.5 h-3.5 text-[#7463e8]" aria-hidden="true" />
              <span>Reset Fixtures</span>
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 space-y-4 max-w-[1600px] w-full mx-auto">
          {/* Required Five-Step Rollout Progress Bar */}
          <ProjectStatusBar />

          {toast && (
            <div
              role="status"
              className={`px-4 py-2.5 rounded-[9px] border text-xs font-medium flex items-center justify-between gap-3 ${
                toast.kind === 'error'
                  ? 'bg-[#fef3f2] border-[#fecdca] text-[#b42318]'
                  : 'bg-[#f0edfc] border-[#d6cff7] text-[#3f31a8]'
              }`}
            >
              <span>{toast.message}</span>
              <button
                type="button"
                onClick={() => setToast(null)}
                className="underline text-[11px]"
              >
                Dismiss
              </button>
            </div>
          )}

          {(activeView === 'documents' || activeView === 'trash') && (
            <>
              {activeView === 'documents' && (
                <TemplatePicker
                  templates={workspaceTemplates}
                  onUseTemplate={handleUseTemplate}
                  onOpenAllTemplates={() => setActiveView('templates')}
                  compact
                  currentRole={roleOverride}
                />
              )}

              <div className="flex flex-col lg:flex-row gap-4 items-start">
                <DocumentList
                  documents={filteredDocuments}
                  versionsByDoc={versionsByDoc}
                  folders={workspaceFolders}
                  selectedDocumentId={selectedDocument?.id || null}
                  onSelectDocument={(id) => {
                    setSelectedDocId(id);
                    setSyncRevision((r) => r + 1);
                  }}
                  searchQuery={searchQuery}
                  onSearchChange={setSearchQuery}
                  selectedTag={selectedTag}
                  onSelectTag={setSelectedTag}
                  availableTags={availableTags}
                  isTrashView={activeView === 'trash'}
                  onRestoreFromTrash={handleRestoreFromTrash}
                  onRequestPermanentDelete={setConfirmDeleteDoc}
                  onImportFile={handleImportFile}
                  onCreateBlankDocument={handleCreateBlankDocument}
                  currentRole={roleOverride}
                  activeFolderName={activeFolderName}
                />

                <RichEditor
                  document={selectedDocument}
                  versionNo={selectedDocVersionNo}
                  syncRevision={syncRevision}
                  folders={workspaceFolders}
                  saveStatus={saveStatus}
                  saveErrorMessage={saveErrorMessage}
                  simulateAutosaveFailure={simulateAutosaveFailure}
                  onToggleSimulateFailure={() =>
                    setSimulateAutosaveFailure((prev) => !prev)
                  }
                  onRetrySave={handleRetrySave}
                  onUpdateDraft={handleUpdateDraft}
                  onSaveCheckpoint={handleSaveCheckpoint}
                  onMoveToTrash={handleMoveToTrash}
                  onRestoreFromTrash={handleRestoreFromTrash}
                  onOpenPrintPreview={() => setPrintPreviewOpen(true)}
                  onRequestExport={handleRequestExport}
                  onSaveAsTemplate={handleSaveAsTemplate}
                  onToggleInspector={() => setInspectorOpen((prev) => !prev)}
                  inspectorOpen={inspectorOpen}
                  currentRole={roleOverride}
                />

                <InspectorDrawer
                  open={inspectorOpen}
                  onClose={() => setInspectorOpen(false)}
                  document={selectedDocument}
                  versions={selectedDocVersions}
                  exports={selectedDocExports}
                  assets={selectedDocAssets}
                  onRestoreVersion={handleRestoreVersion}
                  onRetryExport={handleRetryExport}
                  onDownloadExport={handleDownloadExport}
                  onUploadAsset={handleUploadAsset}
                  onDeleteAsset={handleDeleteAsset}
                  currentRole={roleOverride}
                />
              </div>
            </>
          )}

          {activeView === 'templates' && (
            <TemplatePicker
              templates={workspaceTemplates}
              onUseTemplate={handleUseTemplate}
              compact={false}
              currentRole={roleOverride}
            />
          )}

          {activeView === 'members' && (
            <MembersView
              workspaceName={activeWorkspace.name}
              members={workspaceMembers}
              currentRole={roleOverride}
              onUpdateRole={handleUpdateMemberRole}
              onInviteMember={handleInviteMember}
            />
          )}

          {activeView === 'audit' && (
            <AuditLogView
              events={workspaceAuditEvents}
              workspaceName={activeWorkspace.name}
            />
          )}
        </main>
      </div>

      <PrintPreviewModal
        open={printPreviewOpen}
        onClose={() => setPrintPreviewOpen(false)}
        document={selectedDocument}
        versionNo={selectedDocVersionNo}
      />

      <ConfirmModal
        open={Boolean(confirmDeleteDoc)}
        title="Permanently delete document?"
        description={
          confirmDeleteDoc
            ? `"${confirmDeleteDoc.title}" and all of its version snapshots, attachments, and export history will be permanently deleted. This action cannot be undone and will be logged in the audit trail.`
            : ''
        }
        confirmLabel="Delete Permanently"
        onConfirm={handlePermanentDelete}
        onCancel={() => setConfirmDeleteDoc(null)}
      />
    </div>
  );
}
