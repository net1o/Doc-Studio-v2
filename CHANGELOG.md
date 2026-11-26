# Changelog

All notable changes to Document Studio are recorded in this file.

## [0.8.0] - 2026-11-26

### Added
- Warm paper (`#fbfafc`) and pale gray-lilac (`#f6f5f8`) document-first studio shell with `#7463e8` violet accent.
- Workspace & folder switcher, role perspective guard (`owner`, `admin`, `editor`, `viewer`), and live search/tag filtering.
- Rich editorial document canvas with Georgia headings, header/footer blocks, tables, images, page breaks, RTL/LTR toggle, debounced autosave, and failure recovery.
- Immutable version history with preview and non-destructive restore as a new version.
- Reusable template picker and save-as-template workflow.
- Print preview / PDF sheet export, clean HTML export, bounded DOCX/Word export, HTML/Markdown import with DOMPurify sanitization, and retryable export job tracking.
- Private file attachments with MIME/size validation and SHA-256 checksums.
- Members & permissions console and immutable audit event log.
- Semantic five-step rollout progress bar (`Plan`, `Local app`, `Database`, `Vercel`, `Production`).
