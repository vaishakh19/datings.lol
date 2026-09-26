# datings.lol

React/Vite frontend, Express API, Supabase authentication, and private cross-device account data.

## Local setup

1. Install dependencies:

   ```bash
   npm ci
   ```

2. Copy `.env.example` to `.env` and set the Supabase browser and server variables.

3. Apply `supabase/migrations/20260926000000_user_app_state.sql` in the Supabase SQL editor. If this repository has already been linked with the Supabase CLI, you can instead run `supabase db push`. This migration is required for cross-device profile synchronization.

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

## Validation

```bash
npm run lint
npm run build
```
