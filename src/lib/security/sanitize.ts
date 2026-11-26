import DOMPurify from 'dompurify';

const ALLOWED_TAGS = [
  'h1',
  'h2',
  'h3',
  'h4',
  'p',
  'br',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'ul',
  'ol',
  'li',
  'blockquote',
  'a',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
  'hr',
  'img',
  'div',
  'span',
];

const ALLOWED_ATTR = ['href', 'target', 'rel', 'src', 'alt', 'class', 'dir', 'colspan', 'rowspan'];

export function sanitizeDocumentHtml(rawHtml: string): string {
  const cleaned = DOMPurify.sanitize(rawHtml, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'svg', 'form', 'input'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'style'],
  });
  return cleaned;
}

export function extractPlainText(html: string): string {
  if (typeof window === 'undefined') {
    return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }
  const container = document.createElement('div');
  container.innerHTML = sanitizeDocumentHtml(html);
  return (container.textContent || container.innerText || '').replace(/\s+/g, ' ').trim();
}

export function countWords(plainText: string): number {
  const trimmed = plainText.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

export function normalizeFilename(filename: string): string {
  const base = filename.split(/[/\\]/).pop() || 'untitled';
  const cleaned = base
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_{2,}/g, '_')
    .slice(0, 120);
  return cleaned || 'untitled';
}

export async function computeFileSha256(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  return `local-${file.size}-${Date.now().toString(16)}`;
}

export function generateRequestId(): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `req_${Date.now().toString(36)}_${rand}`;
}
