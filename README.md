# datings.lol

React/Vite frontend, Express API, Supabase authentication, and private cross-device account data.

## Local setup

1. Install dependencies:

   ```bash
   npm ci
   ```

2. Copy `.env.example` to `.env` and set the Supabase browser and server variables.

3. Apply the migrations in `supabase/migrations/` in timestamp order. If this repository has already been linked with the Supabase CLI, run `supabase db push`. The first migration enables cross-device profile synchronization; `20260926010000_production_admin_panel.sql` adds the production admin controls, audit trail, feature flags, broadcasts, and subscriptions; `20261002000000_dynamic_daily_tasks.sql` adds the dynamic Daily Tasks engine (see below).

4. For local UI development without the production API database, set `ALLOW_DEMO_MODE=true`, then run:

   ```bash
   npm run dev
   ```

## Deploying to Vercel

The site is a Vite SPA plus an Express API, and both must ship together:

- `api/index.ts` is the serverless entry point — it imports the Express app from `server.ts` and handles every `/api/*` request (routing lives in `vercel.json`).
- The SPA is built with `vite build` and served from `dist/`, with all other paths falling back to `index.html`.

Required environment variables (Vercel → Project → Settings → Environment Variables), applied to **Production** and **Preview**:

| Variable | Notes |
| --- | --- |
| `SUPABASE_URL` | Server-side Supabase project URL (never prefixed with `VITE_`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only key; never expose it to the browser |
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` | Baked into the SPA at build time |
| `GEMINI_API_KEY` | Optional; enables the AI coach |

Without `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` the function refuses to boot (by design), so set them before the first deploy.

Verify a deployment with `curl https://datings.lol/api/health` (only `/api/*` paths reach the server on Vercel):

- `{"status":"ok",...}` — the API is live and fully configured.
- `{"status":"degraded","problem":"..."}` — the function runs but `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` are missing; set them per the table above and redeploy.
- The sign-in page HTML — the API is not being routed to the function at all, and every API-dependent feature (coach, Pro entitlements, the admin panel) is broken.

## Cross-device data

Authenticated account state is stored in `public.user_app_state` and protected by Supabase Row Level Security. A user can only select, insert, update, or delete their own row. The synchronized payload includes:

- onboarding profile and preferences
- XP, streak, completed lessons, badges, focus, and progress journal
- coach chat history, feedback, and daily usage count
- avatar and dating-profile screenshots
- community saves, completions, reactions, and awarded-XP guards
- private journal, profile audit, notification dismissals, and plan UI state

The browser keeps a per-user cache for offline recovery, but Supabase is the source of truth. Writes are debounced, serialized, flushed when the tab is backgrounded or the user signs out, and retried while offline. Data from the old local-only release is imported once into the first signed-in account on that browser, then marked as owned so it cannot leak into another account.

## Admin control center

The responsive control center is available at `/admin`. Access is authorized on the server for every request; editable usernames and browser storage are never used as a security boundary.

Grant the first administrator in Supabase:

```sql
insert into public.admin_users (user_id)
values ('THE_AUTH_USER_UUID')
on conflict (user_id) do nothing;
```

`ADMIN_USER_IDS` can be used as a comma-separated emergency allowlist. Keep it server-side and prefer the `admin_users` table for normal operations. Admin changes are written to `audit_logs`. Published broadcasts and daily programming are returned by the read-only `/api/app-config` endpoint so every signed-in device sees the same configuration.

To confirm your own account is registered as an admin, run this in the Supabase SQL editor — it inserts your account by email and shows the current list:

```sql
insert into public.admin_users (user_id)
select id from auth.users where lower(email) = lower('YOUR_EMAIL_HERE')
on conflict (user_id) do nothing;

select u.email, u.created_at from public.admin_users a
join auth.users u on u.id = a.user_id;
```

The control center includes live product metrics, member/plan operations, progress reset with confirmation, daily mission and hot-take publishing, broadcasts, progressive feature rollouts, system status, loading/error states, and an audit log. In local `ALLOW_DEMO_MODE=true`, any authenticated demo identity can exercise these workflows against the in-memory store; this exception is never active in production.

## Daily tasks

Every signed-in user gets a personalized set of tasks per calendar day. Selection happens **in the database**, never in the browser, so the same user on three devices sees exactly one set per day.

### Tables

| Table | Role |
| --- | --- |
| `public.task_templates` | The content pool. Reused from the existing admin schema and extended with `code`, `category`, `active`, `cooldown_days`, `min_level`, `sort_order`. Seeded with 30 rule-based templates (10 beginner / 10 intermediate / 10 advanced across 6 categories). |
| `public.daily_tasks` | One row per user, per day, per task. Widened from the legacy "one task per day" shape with `template_id`, `title`, `description`, `difficulty`, `category`, `xp_reward`, `status`, `completed_at`, `xp_awarded`, `sort_order`. |
| `public.user_progress` | XP, level, `tasks_completed`, `current_streak`, `longest_streak`, `last_completed_date`, and per-category / per-difficulty counters that feed the rule engine. |

### Functions

- `generate_daily_tasks(p_user_id uuid, p_date date) -> setof daily_tasks` — returns the day's set, creating it on first call. Idempotent: a transaction-scoped advisory lock on `(user, date)` plus the unique index `daily_tasks (user_id, task_date, template_id)` mean concurrent calls converge on the same rows. A signed-in caller can only generate their own tasks; the service role can generate for anyone.
- `complete_daily_task(p_daily_task_id uuid, p_user_id uuid) -> jsonb` — flips the row, awards XP, and updates level/streak/counters in one transaction. The status guard makes a second call return `already_completed` with `xpAwarded: 0`, so XP can never be paid twice.
- `uncomplete_daily_task(p_daily_task_id uuid, p_user_id uuid) -> jsonb` — symmetrical undo.
- `ensure_user_progress`, `task_level_for_xp`, `task_tier_for_progress` — helpers.

### How selection works (rule-based, no AI provider)

1. `task_tier_for_progress` maps progress to a tier: `ADVANCED` at 25+ completed tasks, level 6+, or a 14-day streak; `INTERMEDIATE` at 6+ completed, level 3+, or a 4-day streak; otherwise `BEGINNER`.
2. Candidates are active, published templates in that tier plus the tier below (as a warm-up).
3. They are ranked by: correct tier first → never-seen before cooled-down before recently-seen (`cooldown_days`, checked against the user's last 60 days of `daily_tasks`) → least-practised category → a `md5(template_id + user_id + date)` tiebreaker. That last term is why a refresh can't reshuffle the day: the same inputs always produce the same ordering.
4. `DISTINCT ON (category)` guarantees no two tasks in a day share a category.
5. Three tasks per day, four once the streak reaches 7.

### Security

RLS is enabled on all three tables. Users can `select` only their own `daily_tasks` and `user_progress`; the only column they may write directly is `daily_tasks.started_at` (a column-level grant). There is no insert or delete policy — rows can only be created by the `SECURITY DEFINER` generator, and XP can only move through the `SECURITY DEFINER` completion functions. `task_templates` is readable by any authenticated user but only when `active` and `PUBLISHED`; writes stay admin-only.

### Where it lives in the app

The card renders inside the existing **Today** tab (`src/components/TodayTab.tsx`), directly under "Today's mission". It reuses the existing design system and the existing Supabase session; nothing about the Coach, navigation, or auth changed.

### Testing Day 1 -> Day 2 locally

The client sends its **local** date to `generate_daily_tasks`, and on localhost (or an e2b preview host) it will honour an override:

```js
// Browser console, on the Today tab:
localStorage.setItem("datings_date_override", "2026-10-03");
location.reload();   // a brand-new set appears
localStorage.removeItem("datings_date_override");
location.reload();   // today's original set comes back, unchanged
```

Note that the function clamps a signed-in caller to `current_date ± 1 day`, so the override is good for proving the rollover. For a larger jump, drive it from the Supabase SQL editor (service role, no clamp):

```sql
-- Day 1
select title, difficulty, category from public.generate_daily_tasks('USER_UUID', current_date);
-- Idempotency: run it again, identical rows, no duplicates
select title from public.generate_daily_tasks('USER_UUID', current_date);
select count(*) from public.daily_tasks where user_id = 'USER_UUID' and task_date = current_date;

-- Day 2 — a different set, and templates used on day 1 are on cooldown
select title, difficulty, category from public.generate_daily_tasks('USER_UUID', current_date + 1);

-- Progression: fake some history and watch the tier move up
update public.user_progress set tasks_completed = 30, level = 7 where user_id = 'USER_UUID';
select title, difficulty from public.generate_daily_tasks('USER_UUID', current_date + 2);
```

To verify XP is awarded exactly once, call the completion RPC twice:

```sql
select public.complete_daily_task('DAILY_TASK_UUID', 'USER_UUID');  -- xpAwarded > 0
select public.complete_daily_task('DAILY_TASK_UUID', 'USER_UUID');  -- already_completed, xpAwarded 0
```

The API also exposes the set over HTTP for cron/warm-up jobs: `GET /api/daily-tasks?date=YYYY-MM-DD`.

## Validation

```bash
npm run lint
npm run build
```
