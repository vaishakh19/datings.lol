# Security

datings.lol is currently in **Dodo Payments TEST MODE only**. No live payment credentials are accepted and the server refuses to boot in live mode.

## Reporting vulnerabilities

Email security findings to **security@datings.lol** with:

- A clear description of the issue and its impact.
- Reproduction steps (URLs, payloads, screenshots).
- Your GPG public key if you want an encrypted reply.

We aim to acknowledge within 48 hours and will coordinate disclosure once a fix is available. Please do not open public GitHub issues for security bugs.

## Scope

In scope for reports:

- The application served from `datings.lol` and preview deployments.
- The API at `/api/*` on those origins.

Out of scope:

- Denial-of-service attacks that cost only rate-limit capacity (rate limits are per-instance; see README).
- Bugs in third-party services (Supabase, Dodo Payments, Google Gemini) — report to those vendors directly.
- `ALLOW_DEMO_MODE=true` configurations (local-only in-memory store, not shipped to production).
- Self-XSS / convincing a victim to paste JavaScript into their own browser console.

## Security model (quick reference)

- Supabase Auth sessions are verified server-side on every protected request. The server never trusts client `isPro` or localStorage for billing entitlements.
- RLS restricts each Supabase user to their own rows on application tables; billing tables are service-role only.
- Dodo webhook signatures are verified with the official SDK against the raw JSON body *before* any JSON parsing, with idempotency-by-webhook-id enforced inside a single Postgres transaction.
- CSP is enabled by default in production (opt out with `ENABLE_CSP=false`); CORS is allowlist-only.
- The server never logs `Authorization`, `Cookie`, or webhook signatures (pino redact paths are listed in server.ts).
