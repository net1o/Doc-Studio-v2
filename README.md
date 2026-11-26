# Document Studio

Document Studio is a standalone web application for creating, importing, editing, organizing, previewing, exporting, and sharing business documents with immutable version history.

## Scope & Cloud Resource Boundaries

Document Studio is strictly isolated from any separate trademark monitoring systems, databases, buckets, or deployment projects. Local runs use isolated local fixtures and browser persistence unless an isolated Supabase project and Vercel deployment are explicitly approved and configured.

- Never commit `.env.local` or secret keys.
- Never point local database scripts at production.
- Production status must not be marked complete until authenticated Preview QA and release approval are evidenced.

## Local Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Available scripts:

- `npm run dev` — Start the local Vite development server on port `3000`
- `npm run build` — Build the production bundle into `dist/`
- `npm run lint` — TypeScript typecheck (`tsc --noEmit`)
- `npm run preview` — Preview the production build locally

## Dependency Overview

- React `19.0.1` + TypeScript
- Vite `8.3.0` + Tailwind CSS `4.3.3`
- Zod for boundary validation
- DOMPurify for untrusted HTML/import sanitization
- Lucide React for functional UI affordances

## Supabase & Vercel Workflow

1. **Local baseline**: Schema definitions live in `supabase/migrations/0001_initial_schema.sql` and config in `supabase/config.jsonc`, with deny-by-default Row-Level Security (RLS) on every tenant-owned table.
2. **Preview validation**: Every pull request is validated on an isolated preview environment before release approval.
3. **Production gate**: Production remains pending until authenticated Preview QA, security review, and release approval are recorded.

## Quality Gates

- Typecheck (`npm run lint`) and production build (`npm run build`) must pass before release.
- Imported HTML, filenames, and attachments are validated and sanitized before rendering or storage.
- Document versions are immutable; restores always append a new version.
- Audit events record actor, workspace, action, entity, request ID, and timestamp without exposing document body text or secrets.

## Theme Reproduction Contract

- Warm paper canvas: `#fbfafc`
- Pale gray-lilac sidebar: `#f6f5f8`
- White document surfaces: `#ffffff`
- Violet accent: `#7463e8`
- Editorial headings: `Georgia, "Times New Roman", serif`
- Interface text: `Arial, Helvetica, sans-serif`
- Radii: `8px`–`11px`, restrained hairline borders, soft shadows, responsive two-column-to-mobile reflow, and document-first hierarchy.
- First screen includes: workspace sidebar, document cards, live editor preview, template picker, search input, and the five-step rollout progress bar (`Plan`, `Local app`, `Database`, `Vercel`, `Production`).
