import { z } from 'zod';

export const MAX_DOCUMENT_TITLE_LENGTH = 160;
export const MAX_HTML_PAYLOAD_BYTES = 512 * 1024; // 512 KB
export const MAX_ASSET_BYTE_SIZE = 5 * 1024 * 1024; // 5 MB

export const ALLOWED_ASSET_MIMES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
] as const;

export const documentContentSchema = z.object({
  html: z.string().max(MAX_HTML_PAYLOAD_BYTES, 'Document content exceeds 512 KB limit.'),
  headerText: z.string().max(120, 'Header text must be 120 characters or fewer.'),
  footerText: z.string().max(120, 'Footer text must be 120 characters or fewer.'),
  direction: z.enum(['ltr', 'rtl']),
});

export const updateDocumentSchema = z.object({
  id: z.string().min(1),
  workspaceId: z.string().min(1),
  title: z
    .string()
    .trim()
    .min(1, 'Document title cannot be empty.')
    .max(MAX_DOCUMENT_TITLE_LENGTH, 'Document title is too long.'),
  tags: z.array(z.string().trim().min(1).max(32)).max(12),
  folderId: z.string().nullable(),
  content: documentContentSchema,
});

export const createTemplateSchema = z.object({
  workspaceId: z.string().min(1),
  name: z.string().trim().min(2, 'Template name must be at least 2 characters.').max(80),
  category: z.string().trim().min(2).max(40),
  description: z.string().trim().max(240),
  content: documentContentSchema,
});

export const assetUploadSchema = z.object({
  originalName: z.string().trim().min(1).max(160),
  mimeType: z.enum(ALLOWED_ASSET_MIMES),
  byteSize: z.number().int().positive().max(MAX_ASSET_BYTE_SIZE),
});

export const memberInviteSchema = z.object({
  displayName: z.string().trim().min(2).max(80),
  email: z.string().trim().email('Enter a valid email address.'),
  role: z.enum(['admin', 'editor', 'viewer']),
});

export const exportRequestSchema = z.object({
  documentId: z.string().min(1),
  versionId: z.string().min(1),
  format: z.enum(['pdf', 'docx', 'html']),
});
