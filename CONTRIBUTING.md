# Contributing to datings.lol

Thanks for helping harden datings.lol.

## Non-negotiables

1. **Billing stays in Dodo TEST MODE.** Never add a live-mode code path, accept a non-`dodo_test_` API key, allow `DODO_PAYMENTS_BASE_URL`, or weaken webhook signature / idempotency / ordering / quarantine logic.
2. **Never commit secrets.** Never touch `.env`. Update `.env.example` when adding variables.
3. **Entitlements and quotas are server-side.** Client `isPro` and localStorage are UI hints only.
4. **Supabase migrations are append-only.** New schema changes go in a new timestamped migration file (e.g. `supabase/migrations/YYYYMMDDHHMMSS_descriptive_name.sql`). Do not edit existing migrations.
5. **Every PR must pass:** `npm run verify` (which runs lint + test + build). We also run `npm audit --omit=dev` in CI and fail on high.

## Local development

```bash
npm ci
cp .env.example .env   # then fill in values; ALLOW_DEMO_MODE=true works with no DB
npm run dev            # tsx server.ts (Vite middleware serves the SPA)
```

## Branching and PRs

- Work off `fix/hardening-pass` (this branch) or a fresh `fix/...` / `feature/...` branch.
- Keep commits small, reviewable, and focused. Do not mix refactors with behavior changes.
- For non-trivial changes, include a test and/or a reproduction command in the PR description.
- Use the PR template (`.github/PULL_REQUEST_TEMPLATE.md`).

## Project layout (post-refactor target)

```
server.ts                 thin Express entry (imports app, boots listener)
server/
  billing.ts              Dodo test-mode config, URL allowlists, entitlement logic
  config/env.ts           zod-validated env parsing
  middleware/*.ts         auth, CORS, rate-limit, error handler
  routes/*.ts             one file per domain (auth, coach, billing, webhooks, …)
  data/*.ts               Supabase + demo stores
src/
  App.tsx                 app shell + routing
  components/             UI split by feature
  context/                React contexts (auth)
  lib/                    typed API clients, supabase client, user state sync
  utils/                  small helpers (logger, routes, image compression)
  data/                   static content (articles, lessons, badges, legal)
supabase/migrations/      additive SQL migrations only
api/index.ts              Vercel serverless adapter — imports server.ts
```

## Testing

- `npm test` runs vitest. Add server route tests under `server/*.test.ts`; React tests under `src/**/*.test.tsx`.
- Prefer testing behavior (zod schemas, auth, entitlement decisions) over implementation details.
- Tests must never hit the network or Supabase — use mocks.

## Reaching out

Open an issue or tag a maintainer in the PR. For security issues, follow `SECURITY.md` instead.
