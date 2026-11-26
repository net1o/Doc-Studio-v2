export type WorkspaceRole = 'owner' | 'admin' | 'editor' | 'viewer';
export type DocumentStatus = 'active' | 'trashed';
export type VersionSource = 'manual' | 'import' | 'restore' | 'export';
export type ExportFormat = 'pdf' | 'docx' | 'html';
export type ExportStatus = 'queued' | 'processing' | 'ready' | 'failed';
export type TextDirection = 'ltr' | 'rtl';

export interface Profile {
  id: string;
  displayName: string;
  email: string;
  title: string;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceMember {
  workspaceId: string;
  userId: string;
  displayName: string;
  email: string;
  role: WorkspaceRole;
  joinedAt: string;
}

export interface Folder {
  id: string;
  workspaceId: string;
  parentId: string | null;
  name: string;
  createdAt: string;
}

export interface DocumentContentPayload {
  html: string;
  headerText: string;
  footerText: string;
  direction: TextDirection;
}

export interface DocumentVersion {
  id: string;
  documentId: string;
  versionNo: number;
  content: DocumentContentPayload;
  plainText: string;
  wordCount: number;
  createdBy: string;
  createdByName: string;
  source: VersionSource;
  summary: string;
  createdAt: string;
}

export interface DocumentRecord {
  id: string;
  workspaceId: string;
  folderId: string | null;
  title: string;
  tags: string[];
  status: DocumentStatus;
  currentVersionId: string;
  draftContent: DocumentContentPayload;
  plainText: string;
  wordCount: number;
  createdBy: string;
  createdByName: string;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentTemplate {
  id: string;
  workspaceId: string;
  name: string;
  category: string;
  description: string;
  content: DocumentContentPayload;
  createdBy: string;
  isShared: boolean;
  createdAt: string;
}

export interface DocumentAsset {
  id: string;
  workspaceId: string;
  documentId: string;
  originalName: string;
  mimeType: string;
  byteSize: number;
  sha256: string;
  dataUrl: string;
  uploadedBy: string;
  uploadedByName: string;
  createdAt: string;
}

export interface ExportJob {
  id: string;
  workspaceId: string;
  documentId: string;
  versionId: string;
  versionNo: number;
  documentTitle: string;
  format: ExportFormat;
  status: ExportStatus;
  errorCode: string | null;
  requestedByName: string;
  createdAt: string;
  completedAt: string | null;
}

export interface AuditEvent {
  id: string;
  workspaceId: string;
  actorId: string;
  actorName: string;
  action:
    | 'auth.session_verified'
    | 'document.created'
    | 'document.updated'
    | 'document.version_saved'
    | 'document.restored_version'
    | 'document.trashed'
    | 'document.restored_from_trash'
    | 'document.permanently_deleted'
    | 'document.imported'
    | 'template.applied'
    | 'template.created'
    | 'export.requested'
    | 'export.completed'
    | 'export.failed'
    | 'asset.uploaded'
    | 'asset.deleted'
    | 'member.role_updated';
  entityType: 'workspace' | 'document' | 'version' | 'template' | 'export' | 'asset' | 'member';
  entityId: string;
  entityLabel: string;
  requestId: string;
  metadata: Record<string, string | number | boolean>;
  createdAt: string;
}

export type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error' | 'offline';
export type StudioView = 'documents' | 'templates' | 'trash' | 'members' | 'audit';
