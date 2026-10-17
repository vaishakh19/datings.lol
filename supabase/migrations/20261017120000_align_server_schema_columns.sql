-- Additive migration: align the schema with what the server reads/writes.
-- Safe to re-run (all guards use IF NOT EXISTS / add column IF NOT EXISTS).
-- Generated: 2026-10-17. Apply AFTER the three prior migrations.
--
-- NOTE: This migration may still be amended; it has not yet been applied to
-- production. If it has been applied, do not re-apply this file — instead
-- create a separate follow-up migration.

begin;

-- 1. Missing columns on public.profiles -----------------------------------
--    The server stores vibe (matching the user_settings enum) and avatar_url
--    (base64 data URL for the user-uploaded avatar) on the profile row.
alter table public.profiles add column if not exists vibe text;
do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class r on r.oid = c.conrelid
    join pg_namespace n on n.oid = r.relnamespace
    where n.nspname = 'public' and r.relname = 'profiles'
      and c.contype = 'c' and pg_get_constraintdef(c.oid) like '%vibe in%'
  ) then
    alter table public.profiles add constraint profiles_vibe_check
      check (vibe is null or vibe in ('gentle','direct','brutal'));
  end if;
end $$;
alter table public.profiles add column if not exists avatar_url text;

-- Backfill ONLY null rows from user_settings so existing profile data is
-- never overwritten. Coalesce to 'direct' for legacy users with no vibe set.
update public.profiles p
   set vibe = coalesce(s.vibe, 'direct')
  from public.user_settings s
 where s.user_id = p.id
   and p.vibe is null;

-- 2. Missing columns on public.daily_tasks --------------------------------
--    The server persists a generated-task JSON blob and an explicit completed
--    boolean directly on the daily_tasks row (it does not create rows in the
--    tasks table). task_id may be null for those self-contained rows, but we
--    keep the FK so any existing referenced tasks remain protected.
alter table public.daily_tasks add column if not exists payload jsonb;
alter table public.daily_tasks add column if not exists completed boolean not null default false;
-- Make task_id nullable only if the existing NOT NULL constraint is present.
do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'daily_tasks'
       and column_name = 'task_id' and is_nullable = 'NO'
  ) then
    alter table public.daily_tasks alter column task_id drop not null;
  end if;
end $$;

-- 3. Missing xp_awarded column on public.teaching_completions -------------
alter table public.teaching_completions add column if not exists xp_awarded integer;
do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class r on r.oid = c.conrelid
    join pg_namespace n on n.oid = r.relnamespace
    where n.nspname = 'public' and r.relname = 'teaching_completions'
      and c.contype = 'c' and pg_get_constraintdef(c.oid) like '%xp_awarded%'
  ) then
    alter table public.teaching_completions add constraint teaching_completions_xp_check
      check (xp_awarded is null or (xp_awarded between 0 and 500));
  end if;
end $$;

-- 4. Missing public.coach_history table -----------------------------------
--    Append-only log of coach responses; users select/insert their own rows.
--    No update/delete grants, no access for anon.
create table if not exists public.coach_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  situation text not null default 'Coach request',
  analysis text not null,
  advice text not null default '',
  suggested_message text not null default '',
  action text,
  outcome text not null default 'Pending',
  xp_awarded integer not null default 0 check (xp_awarded between 0 and 1000),
  created_at timestamptz not null default now()
);
-- Retention note: rows stay until the user is deleted (FK on delete cascade).
-- Consider a cron job to prune rows older than 18 months if storage grows.
alter table public.coach_history enable row level security;

-- Drop any prior policy with this name before recreating (idempotent).
do $$
begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='coach_history' and policyname='users read own coach history') then
    drop policy "users read own coach history" on public.coach_history;
  end if;
  if exists (select 1 from pg_policies where schemaname='public' and tablename='coach_history' and policyname='users insert own coach history') then
    drop policy "users insert own coach history" on public.coach_history;
  end if;
end $$;

create policy "users read own coach history"
  on public.coach_history
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "users insert own coach history"
  on public.coach_history
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

-- (intentionally no update/delete policy — the log is append-only for clients)
revoke all on public.coach_history from anon, public;
grant select, insert on public.coach_history to authenticated;

create index if not exists coach_history_user_created_idx
  on public.coach_history(user_id, created_at desc);

-- 5. public.award_xp RPC --------------------------------------------------
--    Atomic XP + level + streak bump, invoked service-role only.
--    Writes both profiles.xp (the source used by /api/progress and the admin
--    view fallback) and user_app_state.state.progress.xp (the cross-device
--    source the UI syncs from) so the two stores never diverge. Uses fully
--    qualified names and an empty search_path to be search_path-injection safe.
--    Rejects NULL, zero, negative, or out-of-range amounts.
create or replace function public.award_xp(p_user_id uuid, p_amount integer)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_new_xp integer;
  v_new_level integer;
  v_current_state jsonb;
begin
  if p_user_id is null then
    raise exception 'p_user_id must not be null';
  end if;
  if p_amount is null or p_amount <= 0 or p_amount > 10000 then
    raise exception 'p_amount must be a positive integer <= 10000 (got %)', p_amount;
  end if;

  -- Ensure a profiles row exists and bump xp/level atomically.
  insert into public.profiles (id, xp, level, updated_at)
  values (p_user_id, p_amount, 1, now())
  on conflict (id) do update
     set xp = coalesce(public.profiles.xp, 0) + p_amount,
         updated_at = now();

  -- Append an audit row so XP grants are traceable. Reason defaults to
  -- 'award_xp' — callers that need richer provenance should log separately.
  insert into public.xp_transactions (user_id, amount, reason)
  values (p_user_id, p_amount, 'award_xp');

  select xp, greatest(1, floor(xp / 100) + 1)
    into v_new_xp, v_new_level
    from public.profiles where id = p_user_id;

  update public.profiles set level = v_new_level where id = p_user_id;

  -- Update streak last-active date; don't reset existing counts here (the
  -- daily-task completion logic in the server owns streak calculations).
  insert into public.streaks (user_id, current_count, best_count, updated_at)
  values (p_user_id, 1, 1, now())
  on conflict (user_id) do update set updated_at = now();

  -- Mirror the XP bump into user_app_state so cross-device sync sees it.
  -- jsonb_set creates the progress object if it is missing.
  select state into v_current_state
    from public.user_app_state where user_id = p_user_id;

  if v_current_state is not null then
    update public.user_app_state
       set state = jsonb_set(
             coalesce(state, '{}'::jsonb),
             '{progress,xp}',
             to_jsonb(coalesce((state->'progress'->>'xp')::integer, 0) + p_amount),
             true
           ),
           updated_at = now()
     where user_id = p_user_id;
  end if;
end;
$$;

revoke all on function public.award_xp(uuid, integer) from public, anon, authenticated;
grant execute on function public.award_xp(uuid, integer) to service_role;

-- 6. Ensure service_role can see/modify new tables ------------------------
grant all privileges on table public.coach_history to service_role;

commit;
