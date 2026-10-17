# Hardening pass — summary

Branch: `fix/hardening-pass` (based on `acd0ae0` of main).
All changes are **local commits only** — nothing pushed, no PR opened, per instructions.

## Summary table

| # | Issue | Severity | File(s) | Fix | Commit |
|---|-------|----------|----------|-----|--------|
| 1 | Package named "react-example"; `vite` duplicated in deps; build-only tools in `dependencies` | Med | package.json | Renamed to `datings-lol`, deduped vite, moved `@vitejs/plugin-react`, `@tailwindcss/vite`, `tailwindcss`, `autoprefixer`, `esbuild` to devDeps; added `typecheck`, `format:check`, `verify` scripts | df71704 |
| 2 | `vercel.json buildCommand: vite build` did not match package.json `build` (which also bundles server.cjs); rewrites were loose | Med-High | vercel.json | Set `buildCommand: npm run build`, `installCommand: npm ci`, fixed `/api/(.*)` rewrite to target `api/index.ts`, added immutable asset cache headers, excluded static assets from SPA catch-all | df71704 |
| 3 | Google AI Studio leftovers: `aistudioMediaPlugin`, `LINT.IfChange/LINT.ThenChange` comments, "Do not modify" HMR comment, metadata.json at repo root | Med | vite.config.ts, metadata.json | Removed plugin and comments; kept HMR on by default; added `manualChunks` for react/motion/supabase; deleted metadata.json | df71704 |
| 4 | Unused third-party SLSA workflow; no CI | Med | .github/workflows | Deleted SLSA template; added `.github/workflows/ci.yml` (Node 22, npm ci + lint + test + build + `npm audit --omit=dev`, cached npm, pinned actions); added `.github/dependabot.yml` (npm + github-actions, weekly, grouped) | df71704 |
| 5 | CSP defaulted OFF; when ON, used wildcard `https:/wss:` connectSrc which is effectively no CSP; no HSTS | High | server.ts | CSP now defaults ON in production (opt out via `ENABLE_CSP=false`). Directives scoped to self, `*.supabase.co` (https+wss), Dodo test+prod checkout/portal, Google Fonts, data/blob/Unsplash images, Dodo checkout frames; enabled HSTS (1y, includeSubDomains, preload), COOP same-origin, strict-origin-when-cross-origin referrer policy | df71704 |
| 6 | Helmet/CORP, frame-src, CORS origins not auto-including APP_URL/preview; trust proxy hard-coded to 1 without docs | Med | server.ts, .env.example | `crossOriginOpenerPolicy`, `frame-src` added for Dodo checkout; CORS auto-allowlists APP_URL and VERCEL_URL preview origin; `TRUST_PROXY_HOPS` env (defaults 1 on Vercel, 0 standalone); documented in README/.env.example | df71704 |
| 7 | Gemini `User-Agent: aistudio-build` leftover; bogus `gemini-3.8-flash` model id; maxOutputTokens=80 truncates every response | Med | server.ts | UA → `datings-lol/1.0`; corrected candidate models to `gemini-2.5-flash`, `gemini-2.0-flash`, `gemini-flash-latest`; maxOutputTokens 80 → 600 | df71704 |
| 8 | Global error handler leaked stack/internals for unknown errors; pino logger reference bug | Med | server.ts | Error handler always returns `{ error: 'Internal Server Error.', code: 'INTERNAL_ERROR' }` and logs the real error with pino; never exposes stack | df71704 |
| 9 | Rate limits documented as shared but no warning comment in code | Low | server.ts | Added a clear comment block explaining per-instance in-memory limits and pointing to DB-backed locks on sensitive paths | df71704 |
| 10 | `src/utils/authStorage.ts` stored plaintext passwords in localStorage, seeded a hard-coded admin account with a well-known password, accepted master reset code `123456` | **High** | src/utils/authStorage.ts, src/components/auth/Forgot{Password,Username}Form.tsx, src/types.ts, src/App.tsx | Deleted authStorage.ts entirely; deleted unused ForgotPasswordForm/ForgotUsernameForm; removed `passwordHash`, `securityQuestion`, `securityAnswer` from AuthUser; removed 'forgot_username' AuthView | df71704 |
| 11 | No SECURITY.md | Low | SECURITY.md | Added disclosure policy, scope, out-of-scope, security-model summary | df71704 |
| 12 | Main JS chunk 878 kB (253 kB gzip) — target < 300 kB | Med | src/App.tsx, vite.config.ts, src/utils/routes.ts | Added manualChunks; lazy-loaded tabs/modals/MarketingSite with Suspense fallbacks; extracted isMarketingPath to avoid pulling marketing code into main | df71704 |
| 13 | No health / routing HTTP tests; only billing was covered | Med | server/health.test.ts | Added 5 HTTP smoke tests | df71704 |
| 14 | Missing SEO metadata (no canonical, no og:image, no twitter:image, no JSON-LD); robots.txt/sitemap.xml absent | Med | index.html, public/robots.txt, scripts/generate-sitemap.mjs, package.json | Added canonical, OG/Twitter tags, JSON-LD Organization+WebSite; robots.txt disallowing /api,/admin,/auth; build-time sitemap generator (17 URLs) | df71704 |
| 15 | Missing CONTRIBUTING.md and PR template | Low | CONTRIBUTING.md, .github/PULL_REQUEST_TEMPLATE.md | Added contributor guide and PR template with hard-rule checklist | df71704 |
| 16 | README drifted from code (no quick start, no CSP/security docs, Vercel build ambiguity) | Low | README.md | Added Quick start, Vercel build alignment, Security defaults section | df71704 |
| 17 | server.ts referenced tables/columns that don't exist in schema (`community_saves`, `community_completions`, `community_reactions`, `coach_history`, `award_xp`, missing columns) | **High** | server.ts, supabase/migrations/20261017120000_*.sql | Renamed server references to schema names (`saved_teachings`, `teaching_completions`, `teaching_reactions`); stopped reading non-existent email/is_pro/streak from profiles and joined streaks instead; added one additive migration with missing columns/table/RPC | df71704 |
| 18 | No guard test preventing table/RPC drift from creeping back | Med | server/schema-contract.test.ts | Added 3 vitest tests that parse sources vs SQL and fail on undefined references or missing RLS | e2fb629 |

## Before / after metrics

| Metric | Before | After |
|--------|--------|-------|
| npm run lint | clean | clean |
| Tests | 45 passing (2 files) | **53 passing** (4 files) — added health.test.ts (5) + schema-contract.test.ts (3) |
| npm run build | OK | OK |
| npm audit | 0 vulns | 0 vulns |
| Main JS chunk | **877.59 kB** (253.18 kB gzip) | **351.27 kB** (111.66 kB gzip) |
| Supabase vendor chunk | (in main) | 227 kB separate |
| Motion vendor chunk | (in main) | 96.8 kB separate |
| Marketing bundle | (in main) | 76.7 kB separate (NOT loaded on app routes) |
| Tabs / Modals | eager | lazy-loaded |
| CI | none | ci.yml (push + PR) + Dependabot weekly |
| Sitemap | none | 17 URLs, generated at build |
| CSP | default-off, wildcard connectSrc | default-on prod, scoped directives |
| Server↔schema mismatches | 9 (see audit) | 0 (enforced by guard test) |

## Needs manual check (for you)

1. **Vercel environment variables**
   - Re-deploy, smoke-test every screen with CSP default-on. Add extra origins to `CORS_ORIGINS` if needed.
   - Verify `TRUST_PROXY_HOPS=1` matches Vercel; bump to 2 if fronted by Cloudflare.
2. **og:image / twitter:image**
   - Placeholder tag points at `/og-image.png` which does not exist. Add a real 1200×630 PNG there before sharing links publicly.
3. **Run `supabase/verify_tables.sql` in the Supabase SQL Editor** (read-only) and confirm:
   - Every table/function in block 1 and block 2 shows `PRESENT`.
   - Columns for community tables (block 3) and patched tables (block 4) include the new columns: `profiles.vibe`, `profiles.avatar_url`, `daily_tasks.payload`, `daily_tasks.completed`, `teaching_completions.xp_awarded`, `coach_history` (with its columns).
   - Block 5 shows RLS policies on `saved_teachings`, `teaching_reactions`, `teaching_completions`, `coach_history`, `daily_tasks`, `profiles`.
   - **If the live DB already has `community_saves` / `community_completions` / `community_reactions` (older beta naming), STOP and tell me** — in that case the right fix flips direction (keep the server names and add a migration/renaming in SQL, not vice-versa). The schema-contract guard test will also flag that in CI once you point it at a built migration set.
4. **Apply the new migration in order**:
   1. `20260926000000_user_app_state.sql`
   2. `20260926010000_production_admin_panel.sql`
   3. `20261011000000_dodo_test_billing.sql`
   4. `20261017120000_align_server_schema_columns.sql` (new, idempotent)
5. **Dodo test webhook end-to-end**
   - Run the README runbook (free quota, successful 4242 sub, declines, cancel, partial+full refunds, webhook replay/resend).
6. **CSP violations on the live site**
   - Check DevTools Console on first production deploy; add directives as needed. Report-only mode is available as a follow-up.
7. **Sitemap submission** — submit to Google Search Console after og:image is in place.
8. **Marketing pages still ship JS without prerender.** SEO tags and sitemap improve things but crawlers without JS execution will still see an empty #root.
9. **Accessibility / mobile pass** — not done; labels, focus states, keyboard trap, contrast, reduced motion, 44px tap targets need a dedicated pass.
10. **SupportTab file** still on disk under `src/components/SupportTab.tsx` but not imported anywhere; safe to delete once you confirm.

## Remaining risks / recommended next steps (ranked)

1. **server.ts is still ~3155 lines** — splitting into config/middleware/routes/data modules should be done in a dedicated week with tests preceding each move.
2. **Per-IP rate limits are per serverless instance**; add a shared store (Upstash/Redis) or Cloudflare WAF before any non-trivial traffic.
3. **No prerender for marketing/article routes**; add vite-plugin-ssg or similar if indexing doesn't pick up.
4. **Brutalist-theme color contrast** likely fails WCAG on yellow/pink accents; run an axe audit.
5. **adminStorage.ts** is a harmless localStorage UI cache but the name is misleading; rename or wrap in a server-first hook.
6. **`console.error` calls in src/** should go through a small logger.
7. **Gemini prompt-injection hardening** is basic; add a combined token budget for history+message if abuse appears.

## Verification evidence (latest run)

```
npm run lint   → tsc --noEmit: clean (exit 0)
npm test       → 4 files, 53 tests, all passing
npm run build  → dist/ built. main 351 kB / 112 kB gzip; server.cjs 109 kB
npm audit      → 0 vulnerabilities
```

Nothing has been pushed; branch `fix/hardening-pass` is local and ready for review.
