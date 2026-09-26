# datings.lol

React/Vite frontend, Express API, Supabase authentication, and private cross-device account data.

## Local setup

1. Install dependencies:

   ```bash
   npm ci
   ```

2. Copy `.env.example` to `.env` and set the Supabase browser and server variables.

3. Apply the migrations in `supabase/migrations/` in timestamp order. If this repository has already been linked with the Supabase CLI, run `supabase db push`. The first migration enables cross-device profile synchronization; `20260926010000_production_admin_panel.sql` adds the production admin controls, audit trail, feature flags, broadcasts, and subscriptions.

4. For local UI development without the production API database, set `ALLOW_DEMO_MODE=true`, then run:

   ```bash
   npm run dev
   ```

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

The control center includes live product metrics, member/plan operations, progress reset with confirmation, daily mission and hot-take publishing, broadcasts, progressive feature rollouts, system status, loading/error states, and an audit log. In local `ALLOW_DEMO_MODE=true`, any authenticated demo identity can exercise these workflows against the in-memory store; this exception is never active in production.

## Validation

```bash
npm run lint
npm run build
```
