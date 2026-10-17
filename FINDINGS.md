# datings.lol hardening findings (Phase 0 audit)

Baseline (before changes):
- lint clean, 45 tests passing, build OK, npm audit 0 vulnerabilities.
- Main JS chunk: 877.59 kB (253.18 kB gzip).
- server.ts = 3120 lines.

## Critical / High

| # | File | Line | Severity | Issue |
|---|------|------|----------|-------|
| 1 | src/utils/authStorage.ts | all | HIGH | Full legacy client-side user store with hard-coded passwords (Password123!), localStorage auth, a hard-coded "admin" user (admin@datings.lol / dating), and a password-reset master code `123456`. Still imported by ForgotPasswordForm and ForgotUsernameForm. Supabase must be the only auth source. Passwords in plaintext localStorage are a security incident waiting to happen. |
| 2 | src/App.tsx | ~82 | HIGH | `currentUser`/`AuthUser` path still wires up the legacy localStorage auth (setCurrentUser, isPro field from localStorage) alongside Supabase AuthContext. Bifurcated auth is a correctness/security risk. |
| 3 | server.ts | ~240 | HIGH | `trust proxy` set to `1`; Vercel's edge/function egress IP topology is a trusted proxy hop chain but this needs documenting and Vercel-specific proxy trust handling. |
| 4 | server.ts | CSP block | HIGH | `ENABLE_CSP` defaults to false and when enabled uses `connectSrc: ['self','https:','wss:']` which is effectively no restriction. No default-on production CSP. |
| 5 | vercel.json | buildCommand | MED-HIGH | `buildCommand: "vite build"` only builds the SPA; it does NOT bundle server.ts into dist/server.cjs. However, api/index.ts is compiled by Vercel's Node builder, which uses tsc/esbuild transforms per-file and relies on import maps — needs verification. README says build also bundles server, so discrepancy exists. |
| 6 | server.ts | coach route | MED | Gemini user-agent header hard-coded to `aistudio-build` (Google AI Studio leftover). |
| 7 | server.ts | Gemini output | MED | `maxOutputTokens: 80` is suspiciously small (will truncate responses). |
| 8 | server.ts | auth fallback | MED | demo mode derives user IDs from token hash without verifying — acceptable for dev but must never ship; currently guarded by ALLOW_DEMO_MODE but no prod-enforced check beyond fatal(). |
| 9 | server.ts | routes like /api/community, /api/community/teachings/:id/view | MED | No auth required (community listing is public by design but :id/view marks a view without userId) — need to ensure response doesn't leak user data. Community endpoint doesn't require auth for userId optional case — fine for public listing. |
| 10 | supabase/schema.sql | RLS | MED | Several tables have RLS enabled but NO policies (e.g., `coach_history`, `billing_checkout_attempts`, `dodo_webhook_events`, `community_saves` (server uses `community_saves` name but schema has `saved_teachings`), `community_completions` vs `teaching_completions`). The server code references tables (`community_saves`, `community_completions`, `community_reactions`, `coach_history`, `daily_tasks.payload` jsonb column, `profiles.avatar_url`, `profiles.vibe`, `profiles.blocker`, `profiles.is_pro`, `profiles.email`) that don't match schema.sql exactly. The billing migration creates many of these but name mismatches are a latent bug. |
| 11 | server.ts | profileToCamel | MED | Casts `row: any`, reads `email`, `is_pro`, `avatar_url`, `vibe`, `blocker` fields that don't exist on `profiles` in schema.sql — would silently produce undefined in production. (Billing/profile schema may come from another migration; needs reconciling.) |
| 12 | server.ts | CORS | MED | CORS defaults to empty allowlist (same-origin only) which is correct, but no documentation and when VERCEL=1 + preview URLs there's no automatic APP_URL inclusion. |
| 13 | package.json | metadata | MED | name "react-example", vite listed in both dependencies and devDependencies, build-only tools (esbuild, vite, @vitejs/plugin-react, @tailwindcss/vite, tailwindcss, autoprefixer) in dependencies. |
| 14 | vite.config.ts | plugin block | MED | `aistudioMediaPlugin` leftover serving `/assets/aistudio/` — unused, references non-existent directory. HMR comment "Do not modify" is an AI Studio instruction, misleading. |
| 15 | metadata.json | root | LOW-MED | AI Studio metadata file unused by app. |
| 16 | .github/workflows/generator-generic-ossf-slsa3-publish.yml | all | LOW-MED | Third-party SLSA template not used by this project. No real CI. |
| 17 | server.ts | zod validation gaps | MED | Several routes lack param/query validation: `/api/tasks/:id/start`, `/api/tasks/:id/complete`, `/api/community/teachings/:id/*` (id is not validated against known teaching IDs beyond findTeaching), `/api/profile/journal/:id` (id not validated as uuid/shape), `/api/admin/*/:id` (broadcast/daily-config patch id not validated). |
| 18 | server.ts | any types | MED | Many `any` casts: event:any in webhook handler, row:any across Supabase store, mapFeatureFlag/mapBroadcast/mapDailyConfig/mapAudit take `any`, Gemini response `as any`, profile `as any`, builds `as any`. |
| 19 | server.ts | coach input cap | LOW-MED | `message: z.string().max(4000)` and `imageBase64: z.string().max(8_000_000)` but no explicit total-prompt cap or multi-message length guard; history truncated to 6 messages but each message text can be 3000 chars. |
| 20 | src/**/*.tsx | console.error | LOW | ~dozens of console.error/warn/log calls. Should use a small logger. |
| 21 | App.tsx / big components | size | LOW | 1.2k–1.8k LOC single-file components. |
| 22 | src/lib/adminApi.ts | admin auth | MED | Admin endpoints all require server-side auth (good), but need to confirm adminApi client doesn't cache admin state unsafely. |
| 23 | No SECURITY.md, CONTRIBUTING.md, PR template |  | LOW | Docs gap. |
| 24 | No robots.txt, sitemap.xml, og:image |  | MED | SEO gap for marketing pages; SPA serves empty #root to crawlers. |
| 25 | No per-route metadata, canonical tags, JSON-LD |  | MED | SEO gap. |
| 26 | tsconfig.json | strictness | LOW-MED | No strict mode; implicit any pervasive. |
| 27 | adminStorage | localStorage | MED | Uses localStorage for admin notifications/daily override/hot take — this is UI cache only, but the naming and behavior risk it being treated as authoritative. Server-side /api/app-config already returns authoritative data. localStorage admin cache should be labeled clearly or removed. |
| 28 | /api/app-config route |  | LOW | Exposes admin-published settings publicly (notifications, daily override, hot take) — intentional, but there's no rate limit / public cache other than 30s private. |
| 29 | /api/community GET |  | LOW | Does not require auth (returns userId as null) — public listing is fine, but no search length cap. |
| 30 | Helmet + static |  | LOW | In production standalone mode, helmet is applied before Vite/static middleware; on Vercel, Vercel CDN serves static files so helmet only applies to /api. HSTS headers are not set on the SPA. |

## Notes / confirmations

- Vercel `buildCommand: vite build` does NOT bundle server.ts, but Vercel's Node.js serverless function builder (nft bundling) handles `api/index.ts` which imports `server.ts`, so server code gets bundled per-function. However, Vercel's builder may not follow .js extension resolution the same way. The README claims "Vite SPA and Express API must deploy together" with `npm run build` bundling server.cjs, but vercel.json overrides buildCommand. Need to reconcile: either use `npm run build` as buildCommand and declare outputDirectory dist, OR document that api/index.ts is independently bundled by Vercel. Looking at the code, api/index.ts imports `../server.js` and comments that esbuild/tsc map it to server.ts at build time—tsc isn't run in vercel build, but Vercel's @vercel/node does transform TypeScript via esbuild, so this should work. However the safer build is `npm run build`.
