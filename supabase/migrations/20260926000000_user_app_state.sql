-- Per-account application state for cross-device synchronization.
-- Run this migration in the Supabase SQL editor (or with `supabase db push`).

create table if not exists public.user_app_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  state_version integer not null default 1 check (state_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_app_state_is_object check (jsonb_typeof(state) = 'object')
);

alter table public.user_app_state enable row level security;

-- Idempotent policy creation so the migration is safe to re-run manually.
do $$
begin
  create policy "users read own app state"
    on public.user_app_state
    for select
    to authenticated
    using ((select auth.uid()) = user_id);
exception when duplicate_object then null;
end $$;

do $$
begin
  create policy "users insert own app state"
    on public.user_app_state
    for insert
    to authenticated
    with check ((select auth.uid()) = user_id);
exception when duplicate_object then null;
end $$;

do $$
begin
  create policy "users update own app state"
    on public.user_app_state
    for update
    to authenticated
    using ((select auth.uid()) = user_id)
    with check ((select auth.uid()) = user_id);
exception when duplicate_object then null;
end $$;

do $$
begin
  create policy "users delete own app state"
    on public.user_app_state
    for delete
    to authenticated
    using ((select auth.uid()) = user_id);
exception when duplicate_object then null;
end $$;

grant select, insert, update, delete on public.user_app_state to authenticated;
revoke all on public.user_app_state from anon;

comment on table public.user_app_state is
  'Versioned private app state (profile, XP, streak, chats, journal, and preferences) synchronized across a user account.';
