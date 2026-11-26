import { DocumentContentPayload, DocumentRecord, DocumentVersion, ExportFormat } from '../../types/studio';
import { normalizeFilename, sanitizeDocumentHtml } from '../security/sanitize';

export function buildCleanExportHtml(
  title: string,
  versionNo: number,
  content: DocumentContentPayload
): string {
  const safeBody = sanitizeDocumentHtml(content.html);
  const safeTitle = escapeHtml(title);
  const safeHeader = escapeHtml(content.headerText);
  const safeFooter = escapeHtml(content.footerText);

  return `<!doctype html>
<html lang="en" dir="${content.direction}">
<head>
  <meta charset="utf-8" />
  <title>${safeTitle} (v${versionNo})</title>
  <style>
    body {
      font-family: Arial, Helvetica, sans-serif;
      color: #1f1b2e;
      max-width: 760px;
      margin: 48px auto;
      padding: 0 24px;
      line-height: 1.7;
    }
    header.doc-header {
      border-bottom: 1px solid #e6e3ee;
      padding-bottom: 10px;
      margin-bottom: 28px;
      font-size: 12px;
      color: #655f78;
      display: flex;
      justify-content: space-between;
    }
    h1.doc-title {
      font-family: Georgia, "Times New Roman", serif;
      font-size: 30px;
      margin-bottom: 20px;
      color: #171326;
    }
    h1, h2, h3 { font-family: Georgia, "Times New Roman", serif; }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; }
    th, td { border: 1px solid #dcd7ea; padding: 8px 10px; text-align: start; }
    th { background: #f6f5f8; }
    hr.page-break { break-after: page; border: none; border-top: 1px dashed #c8c1db; margin: 28px 0; }
    footer.doc-footer {
      border-top: 1px solid #e6e3ee;
      padding-top: 10px;
      margin-top: 36px;
      font-size: 12px;
      color: #655f78;
      display: flex;
      justify-content: space-between;
    }
  </style>
</head>
<body>
  ${safeHeader ? `<header class="doc-header"><span>${safeHeader}</span><span>Version ${versionNo}</span></header>` : ''}
  <h1 class="doc-title">${safeTitle}</h1>
  <main>${safeBody}</main>
  ${safeFooter ? `<footer class="doc-footer"><span>${safeFooter}</span><span>Document Studio</span></footer>` : ''}
</body>
</html>`;
}

export function buildDocxCompatibleHtml(
  title: string,
  versionNo: number,
  content: DocumentContentPayload
): string {
  const safeBody = sanitizeDocumentHtml(content.html);
  const safeTitle = escapeHtml(title);
  const safeHeader = escapeHtml(content.headerText);
  const safeFooter = escapeHtml(content.footerText);

  return `<html xmlns:o="urn:schemas-microsoft-com:office:office"
xmlns:w="urn:schemas-microsoft-com:office:word"
xmlns="http://www.w3.org/TR/REC-html40"
dir="${content.direction}">
<head>
<meta charset="utf-8" />
<title>${safeTitle}</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->
<style>
  body { font-family: Arial, sans-serif; font-size: 11pt; line-height: 1.5; color: #1f1b2e; }
  h1, h2, h3 { font-family: Georgia, serif; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #cccccc; padding: 6pt; }
</style>
</head>
<body>
  ${safeHeader ? `<p style="color:#655f78;font-size:9pt;border-bottom:1px solid #e6e3ee;padding-bottom:4pt;">${safeHeader} — Version ${versionNo}</p>` : ''}
  <h1>${safeTitle}</h1>
  ${safeBody}
  ${safeFooter ? `<p style="color:#655f78;font-size:9pt;border-top:1px solid #e6e3ee;padding-top:4pt;margin-top:24pt;">${safeFooter}</p>` : ''}
</body>
</html>`;
}

export function downloadExportArtifact(
  doc: DocumentRecord,
  version: DocumentVersion,
  format: ExportFormat
): void {
  const baseName = normalizeFilename(doc.title).replace(/\.[^.]+$/, '') || 'document';
  if (format === 'html') {
    const html = buildCleanExportHtml(doc.title, version.versionNo, version.content);
    triggerBlobDownload(html, `${baseName}-v${version.versionNo}.html`, 'text/html;charset=utf-8');
    return;
  }
  if (format === 'docx') {
    const wordHtml = buildDocxCompatibleHtml(doc.title, version.versionNo, version.content);
    triggerBlobDownload(
      wordHtml,
      `${baseName}-v${version.versionNo}.doc`,
      'application/msword;charset=utf-8'
    );
    return;
  }
  // PDF download uses clean printable HTML sheet fallback if invoked directly outside Print modal
  const html = buildCleanExportHtml(doc.title, version.versionNo, version.content);
  triggerBlobDownload(html, `${baseName}-v${version.versionNo}-print.html`, 'text/html;charset=utf-8');
}

export function parseImportedFileToHtml(filename: string, rawText: string): {
  title: string;
  html: string;
} {
  const lower = filename.toLowerCase();
  const baseTitle = normalizeFilename(filename).replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ') || 'Imported Document';

  if (lower.endsWith('.html') || lower.endsWith('.htm')) {
    const bodyMatch = rawText.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    const titleMatch = rawText.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const extractedHtml = bodyMatch ? bodyMatch[1] : rawText;
    return {
      title: titleMatch ? titleMatch[1].trim().slice(0, 120) : baseTitle,
      html: sanitizeDocumentHtml(extractedHtml),
    };
  }

  if (lower.endsWith('.md') || lower.endsWith('.markdown')) {
    const lines = rawText.split(/\r?\n/);
    const chunks: string[] = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (trimmed.startsWith('### ')) {
        chunks.push(`<h3>${escapeHtml(trimmed.slice(4))}</h3>`);
      } else if (trimmed.startsWith('## ')) {
        chunks.push(`<h2>${escapeHtml(trimmed.slice(3))}</h2>`);
      } else if (trimmed.startsWith('# ')) {
        chunks.push(`<h1>${escapeHtml(trimmed.slice(2))}</h1>`);
      } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        chunks.push(`<ul><li>${escapeHtml(trimmed.slice(2))}</li></ul>`);
      } else {
        chunks.push(`<p>${escapeHtml(trimmed)}</p>`);
      }
    }
    return {
      title: baseTitle,
      html: sanitizeDocumentHtml(chunks.join('') || '<p></p>'),
    };
  }

  // Plain text
  const paragraphs = rawText
    .split(/\r?\n\r?\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${escapeHtml(p).replace(/\r?\n/g, '<br />')}</p>`)
    .join('');

  return {
    title: baseTitle,
    html: sanitizeDocumentHtml(paragraphs || '<p></p>'),
  };
}

function triggerBlobDownload(content: string, filename: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
