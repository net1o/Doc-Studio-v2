# AGENTS.md — Document Studio Engineering Rules

1. Document Studio is an isolated standalone product. Never reference, import, or share credentials or schemas with any separate trademark monitoring application.
2. Preserve the theme reproduction contract (`#fbfafc` paper, `#f6f5f8` sidebar, `#ffffff` document surfaces, `#7463e8` violet accent, Georgia editorial headings, Arial/Helvetica UI text, `8px`–`11px` radii).
3. Keep the five-step rollout progress bar accurate: `Plan` (done), `Local app` (done), `Database` (done), `Vercel` (active), `Production` (pending) until Preview QA and release approval are evidenced.
4. Enforce Zod boundary validation, DOMPurify sanitization for imported HTML, immutable version history, and audit logging without document body text or secrets.
