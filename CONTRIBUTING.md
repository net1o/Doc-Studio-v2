# Contributing to Document Studio

Thank you for contributing to Document Studio.

## Branch & Pull Request Workflow

1. Create a focused feature branch from `main`.
2. Keep changes scoped to a single coherent slice (UI, validation, storage, audit, and tests together).
3. Never commit `.env.local`, credentials, API keys, or production data dumps.
4. Ensure `npm run lint` and `npm run build` pass before opening a pull request.

## Pull Request Checklist

- Summary of user-facing behavior and scope
- Data, schema, or security impact noted explicitly
- Negative authorization and edge-case states verified (empty, loading, offline/autosave failure, permission denied, export failure)
- No unrelated product references or external credentials introduced
