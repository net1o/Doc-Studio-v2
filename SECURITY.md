# Security Policy

## Reporting a Vulnerability

Please report suspected security issues responsibly without disclosing exploit details or sensitive payloads publicly. Include reproduction steps, affected files or routes, and potential impact.

## Security Baselines

- **Tenant isolation**: All queries, mutations, and downloads must be scoped to an authorized `workspace_id`.
- **Untrusted input**: Validate all payloads at boundaries using Zod schemas; sanitize all imported or pasted HTML via DOMPurify before rendering.
- **No body text in logs**: Audit logs, error banners, and console outputs must never contain document body contents, tokens, or secrets.
- **Immutable history**: Version records are append-only. Exports reference an exact `version_id`.
- **Retention**: Trashed documents remain recoverable for 30 days; permanent deletion requires explicit user confirmation and generates an audit event.
