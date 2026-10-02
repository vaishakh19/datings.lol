-- ============================================================================
-- Dynamic Daily Tasks
-- ----------------------------------------------------------------------------
-- Adds a rule-based, per-user, per-day task system on top of the existing
-- schema. It deliberately REUSES the tables that already exist
-- (`task_templates`, `daily_tasks`) instead of creating parallel ones, and
-- adds the single missing piece (`user_progress`).
--
-- Generation lives in the database (`public.generate_daily_tasks`), not in the
-- browser, so the same user on three devices gets exactly one task set per
-- day. The function is idempotent: a transaction-scoped advisory lock plus a
-- unique index make concurrent calls converge on the same rows.
--
-- SECURITY NOTES
--   * Every SECURITY DEFINER function runs with `search_path = ''` and
--     schema-qualifies every object, per Supabase's database-function
--     guidance. RLS does not constrain a definer function's internal
--     queries, so each one authorizes its caller explicitly.
--   * `ensure_user_progress` is NOT granted to `authenticated`. It takes an
--     arbitrary user id, so exposing it as an RPC would let any signed-in
--     user read another user's XP and streak. Only the definer functions
--     (which run as the owner) and `service_role` may call it.
--
-- This migration is additive and safe to re-run: it normalizes legacy data
-- and removes conflicting constraints before adding its own.
-- ============================================================================

create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- 1. TASK TEMPLATES (reused; created here too so a migrations-only database
--    that never ran schema.sql still works)
-- ----------------------------------------------------------------------------

create table if not exists public.task_templates (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  skill text not null,
  type text not null,
  difficulty text not null,
  xp_reward integer not null check (xp_reward between 0 and 500),
  estimated_minutes integer,
  template jsonb not null default '{}'::jsonb,
  status text not null default 'DRAFT',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Columns the rule engine needs.
alter table public.task_templates add column if not exists code text;
alter table public.task_templates add column if not exists category text;
alter table public.task_templates add column if not exists active boolean not null default true;
alter table public.task_templates add column if not exists cooldown_days integer not null default 14;
alter table public.task_templates add column if not exists min_level integer not null default 1;
alter table public.task_templates add column if not exists sort_order integer not null default 100;

-- Deliberately NOT partial: ON CONFLICT (code) must be able to infer this
-- index. `code` stays nullable so pre-existing admin-authored rows (which have
-- no code) remain valid; NULLs never conflict in a unique index.
create unique index if not exists task_templates_code_key
  on public.task_templates (code);

create index if not exists task_templates_pick_idx
  on public.task_templates (status, active, difficulty, category);

-- ----------------------------------------------------------------------------
-- 2. DAILY TASKS (reused and widened from "one task per day" to "a set")
-- ----------------------------------------------------------------------------

create table if not exists public.daily_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid,
  task_date date not null,
  started_at timestamptz,
  completed_at timestamptz
);

alter table public.daily_tasks add column if not exists template_id uuid references public.task_templates(id) on delete set null;
alter table public.daily_tasks add column if not exists title text;
alter table public.daily_tasks add column if not exists description text;
alter table public.daily_tasks add column if not exists difficulty text;
alter table public.daily_tasks add column if not exists category text;
alter table public.daily_tasks add column if not exists xp_reward integer not null default 0;
alter table public.daily_tasks add column if not exists status text not null default 'pending';
alter table public.daily_tasks add column if not exists xp_awarded integer not null default 0;
alter table public.daily_tasks add column if not exists sort_order integer not null default 0;
alter table public.daily_tasks add column if not exists source text not null default 'rule_engine';
alter table public.daily_tasks add column if not exists created_at timestamptz not null default now();

alter table public.daily_tasks alter column task_id drop not null;

-- --- 2a. Remove ANY uniqueness on (user_id, task_date) --------------------
-- The legacy schema declared `unique (user_id, task_date)`, which caps a day
-- at one task. Drop it by shape rather than by name, so a constraint or a
-- standalone index created under a different name is also removed.

do $$
declare
  r record;
begin
  for r in
    select c.conname
    from pg_catalog.pg_constraint c
    join pg_catalog.pg_class t on t.oid = c.conrelid
    join pg_catalog.pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'daily_tasks'
      and c.contype = 'u'
      and (
        select array_agg(a.attname::text order by a.attname::text)
        from unnest(c.conkey) as k(attnum)
        join pg_catalog.pg_attribute a
          on a.attrelid = c.conrelid and a.attnum = k.attnum
      ) = array['task_date', 'user_id']
  loop
    execute format('alter table public.daily_tasks drop constraint %I', r.conname);
  end loop;
end
$$;

do $$
declare
  r record;
begin
  for r in
    select i.relname
    from pg_catalog.pg_index x
    join pg_catalog.pg_class i on i.oid = x.indexrelid
    join pg_catalog.pg_class t on t.oid = x.indrelid
    join pg_catalog.pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'daily_tasks'
      and x.indisunique
      and not x.indisprimary
      and x.indpred is null
      and not exists (
        select 1 from pg_catalog.pg_constraint c where c.conindid = i.oid
      )
      and (
        select array_agg(a.attname::text order by a.attname::text)
        from unnest(string_to_array(x.indkey::text, ' ')::int[]) as k(attnum)
        join pg_catalog.pg_attribute a
          on a.attrelid = x.indrelid and a.attnum = k.attnum
      ) = array['task_date', 'user_id']
  loop
    execute format('drop index public.%I', r.relname);
  end loop;
end
$$;

-- --- 2b. Normalize legacy rows BEFORE adding the new constraints ----------
-- A pre-existing row has no status; it only has completed_at. Infer it, then
-- force anything still out of range into 'pending' so the CHECK can be added.

update public.daily_tasks
set status = 'completed'
where completed_at is not null and status is distinct from 'completed';

update public.daily_tasks
set status = 'pending'
where status is null or status not in ('pending', 'completed', 'skipped');

alter table public.daily_tasks drop constraint if exists daily_tasks_status_check;
alter table public.daily_tasks add constraint daily_tasks_status_check
  check (status in ('pending', 'completed', 'skipped'));

-- De-duplicate before the unique index, keeping the completed row (or the
-- oldest) so creating the index can never fail on existing data.
delete from public.daily_tasks dt
where dt.template_id is not null
  and dt.id <> (
    select keep.id
    from public.daily_tasks keep
    where keep.user_id = dt.user_id
      and keep.task_date = dt.task_date
      and keep.template_id = dt.template_id
    order by (keep.completed_at is null), keep.created_at, keep.id
    limit 1
  );

-- Idempotency guard: the same template can never land twice on the same day.
create unique index if not exists daily_tasks_user_date_template_key
  on public.daily_tasks (user_id, task_date, template_id)
  where template_id is not null;

create index if not exists daily_tasks_user_date_idx on public.daily_tasks (user_id, task_date);
create index if not exists daily_tasks_user_template_idx on public.daily_tasks (user_id, template_id, task_date desc);

-- ----------------------------------------------------------------------------
-- 3. USER PROGRESS (the missing table)
-- ----------------------------------------------------------------------------

create table if not exists public.user_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  xp integer not null default 0 check (xp >= 0),
  level integer not null default 1 check (level >= 1),
  tasks_completed integer not null default 0 check (tasks_completed >= 0),
  current_streak integer not null default 0 check (current_streak >= 0),
  longest_streak integer not null default 0 check (longest_streak >= 0),
  last_completed_date date,
  last_generated_date date,
  category_counts jsonb not null default '{}'::jsonb,
  difficulty_counts jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 4. HELPERS
-- ----------------------------------------------------------------------------

-- Keep the level curve identical to the one the SPA already renders (200 XP).
create or replace function public.task_level_for_xp(p_xp integer)
returns integer
language sql
immutable
set search_path = ''
as $$ select greatest(1, (coalesce(p_xp, 0) / 200) + 1); $$;

-- Rule-based difficulty tier. Driven by real progress, not by a date.
create or replace function public.task_tier_for_progress(
  p_level integer,
  p_tasks_completed integer,
  p_streak integer
)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when coalesce(p_tasks_completed, 0) >= 25
      or coalesce(p_level, 1) >= 6
      or coalesce(p_streak, 0) >= 14 then 'ADVANCED'
    when coalesce(p_tasks_completed, 0) >= 6
      or coalesce(p_level, 1) >= 3
      or coalesce(p_streak, 0) >= 4 then 'INTERMEDIATE'
    else 'BEGINNER'
  end;
$$;

-- Counter accessors that tolerate junk. A non-numeric value in the JSON
-- object reads as 0 instead of raising, so one bad write cannot wedge every
-- future completion for that user.
create or replace function public.task_counter_read(p_obj jsonb, p_key text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case
    when p_key is null then 0
    when jsonb_typeof(coalesce(p_obj, '{}'::jsonb) -> p_key) = 'number'
      then (coalesce(p_obj, '{}'::jsonb) ->> p_key)::integer
    else 0
  end;
$$;

create or replace function public.task_counter_bump(p_obj jsonb, p_key text, p_delta integer)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_set(
    coalesce(p_obj, '{}'::jsonb),
    array[coalesce(p_key, 'general')],
    to_jsonb(greatest(0, public.task_counter_read(p_obj, coalesce(p_key, 'general')) + coalesce(p_delta, 0))),
    true
  );
$$;

-- Does `profiles` have the columns we mirror XP into? Checked against the
-- catalog rather than discovered by swallowing a runtime error.
create or replace function public.task_profiles_xp_syncable()
returns boolean
language sql
stable
set search_path = ''
as $$
  select (
    select count(*)
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name in ('id', 'xp', 'level', 'updated_at')
  ) = 4;
$$;

-- Does daily_tasks.user_id reference public.profiles? On databases built from
-- schema.sql it does, and the profile row must exist before we can insert.
create or replace function public.task_daily_tasks_needs_profile()
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1
    from pg_catalog.pg_constraint c
    join pg_catalog.pg_class t on t.oid = c.conrelid
    join pg_catalog.pg_namespace tn on tn.oid = t.relnamespace
    join pg_catalog.pg_class f on f.oid = c.confrelid
    join pg_catalog.pg_namespace fn on fn.oid = f.relnamespace
    where c.contype = 'f'
      and tn.nspname = 'public' and t.relname = 'daily_tasks'
      and fn.nspname = 'public' and f.relname = 'profiles'
  );
$$;

-- INTERNAL. Never granted to `authenticated` — it accepts an arbitrary user
-- id and would otherwise leak another user's XP and streak over the REST API.
create or replace function public.ensure_user_progress(p_user_id uuid)
returns public.user_progress
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.user_progress;
begin
  insert into public.user_progress (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  select * into v_row from public.user_progress where user_id = p_user_id;
  return v_row;
end;
$$;

-- ----------------------------------------------------------------------------
-- 5. GENERATION — idempotent, server-side, rule-based
-- ----------------------------------------------------------------------------

create or replace function public.generate_daily_tasks(
  p_user_id uuid default null,
  p_date date default null
)
returns setof public.daily_tasks
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
  v_date date;
  v_caller uuid := auth.uid();
  v_progress public.user_progress;
  v_tier text;
  v_fallback_tier text;
  v_target integer;
  v_existing integer;
  v_needed integer;
begin
  v_user := coalesce(p_user_id, v_caller);
  if v_user is null then
    raise exception 'generate_daily_tasks requires an authenticated user'
      using errcode = '28000';
  end if;

  -- A signed-in user can only ever generate their own tasks. The service role
  -- (auth.uid() is null) may generate for anybody, which is what a scheduled
  -- warm-up job or the Express API needs.
  if v_caller is not null and v_user <> v_caller then
    raise exception 'cannot generate daily tasks for another user'
      using errcode = '42501';
  end if;

  v_date := coalesce(p_date, current_date);

  -- The client sends its *local* date so a user in UTC+13 rolls over at their
  -- own midnight. Clamp it so nobody can mine future or historic task sets.
  if v_caller is not null and (v_date > current_date + 1 or v_date < current_date - 1) then
    v_date := current_date;
  end if;

  -- Serialize concurrent generation for this (user, day). Two tabs opening at
  -- once therefore produce one set, not two.
  perform pg_advisory_xact_lock(hashtextextended(v_user::text || ':' || v_date::text, 0));

  -- On databases built from schema.sql, daily_tasks.user_id points at
  -- public.profiles rather than auth.users, and the SPA (which stores state in
  -- user_app_state) may never have created that row. Errors are NOT swallowed:
  -- a genuine schema or permission problem should surface, not hide.
  if public.task_daily_tasks_needs_profile() then
    insert into public.profiles (id) values (v_user) on conflict (id) do nothing;
  end if;

  select * into v_progress from public.ensure_user_progress(v_user);

  select count(*) into v_existing
  from public.daily_tasks
  where user_id = v_user and task_date = v_date;

  v_tier := public.task_tier_for_progress(
    v_progress.level, v_progress.tasks_completed, v_progress.current_streak
  );
  v_fallback_tier := case v_tier
    when 'ADVANCED' then 'INTERMEDIATE'
    when 'INTERMEDIATE' then 'BEGINNER'
    else 'BEGINNER'
  end;

  -- A longer streak earns a fourth task; everyone else gets three.
  v_target := case when coalesce(v_progress.current_streak, 0) >= 7 then 4 else 3 end;

  -- Top up rather than all-or-nothing. A day that already holds a legacy row,
  -- or a partial set from a failed run, gets completed instead of being stuck
  -- forever. An already-full day is never touched, so the set a user saw this
  -- morning cannot change this afternoon.
  if v_existing = 0 then
    v_needed := v_target;
  elsif v_existing < 3 then
    v_needed := 3 - v_existing;
  else
    v_needed := 0;
  end if;

  if v_needed > 0 then
    insert into public.daily_tasks (
      user_id, task_date, template_id, title, description,
      difficulty, category, xp_reward, sort_order, source
    )
    with recent as (
      select d.template_id, max(d.task_date) as last_used
      from public.daily_tasks d
      where d.user_id = v_user
        and d.template_id is not null
        and d.task_date between v_date - 60 and v_date
      group by d.template_id
    ),
    pool as (
      select
        tpl.id,
        tpl.title,
        tpl.description,
        tpl.difficulty,
        tpl.category,
        tpl.xp_reward,
        -- 1) right difficulty first, one step easier as a warm-up
        case when tpl.difficulty = v_tier then 0 else 1 end as tier_rank,
        -- 2) never-seen beats cooled-down beats recently-seen
        case
          when r.last_used is null then 0
          when r.last_used <= v_date - tpl.cooldown_days then 1
          else 2
        end as freshness_rank,
        -- 3) push categories the user has practised least
        public.task_counter_read(v_progress.category_counts, tpl.category) as category_done,
        -- 4) stable per-user/per-day tiebreaker: same input => same output
        md5(tpl.id::text || v_user::text || v_date::text) as shuffle
      from public.task_templates tpl
      left join recent r on r.template_id = tpl.id
      where tpl.active is true
        and tpl.status = 'PUBLISHED'
        and tpl.category is not null
        and tpl.difficulty in (v_tier, v_fallback_tier)
        and coalesce(tpl.min_level, 1) <= greatest(v_progress.level, 1)
        -- never re-pick something already sitting on this day
        and not exists (
          select 1 from public.daily_tasks d
          where d.user_id = v_user and d.task_date = v_date and d.template_id = tpl.id
        )
    ),
    one_per_category as (
      -- At most one task per category so a day never feels repetitive.
      select distinct on (category) *
      from pool
      order by category, tier_rank, freshness_rank, category_done, shuffle
    ),
    picked as (
      select * from one_per_category
      order by tier_rank, freshness_rank, category_done, shuffle
      limit v_needed
    )
    select
      v_user,
      v_date,
      picked.id,
      picked.title,
      picked.description,
      picked.difficulty,
      picked.category,
      picked.xp_reward,
      v_existing + row_number() over (order by picked.tier_rank, picked.shuffle),
      'rule_engine'
    from picked
    on conflict do nothing;

    update public.user_progress
    set last_generated_date = greatest(coalesce(last_generated_date, v_date), v_date),
        updated_at = now()
    where user_id = v_user;
  end if;

  return query
    select * from public.daily_tasks
    where user_id = v_user and task_date = v_date
    order by sort_order, created_at, id;
end;
$$;

-- ----------------------------------------------------------------------------
-- 6. COMPLETION — XP is awarded exactly once per task
-- ----------------------------------------------------------------------------

create or replace function public.complete_daily_task(
  p_daily_task_id uuid,
  p_user_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth uuid := auth.uid();
  v_caller uuid;
  v_task public.daily_tasks;
  v_progress public.user_progress;
  v_new_streak integer;
  v_new_xp integer;
begin
  -- Signed-in users act as themselves; the service role (auth.uid() is null)
  -- may act for a given user so the Express API can reuse this logic.
  v_caller := coalesce(v_auth, p_user_id);
  if v_caller is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if v_auth is not null and p_user_id is not null and p_user_id <> v_auth then
    raise exception 'cannot complete another user''s task' using errcode = '42501';
  end if;

  -- Lock order throughout this migration is always daily_tasks -> user_progress.
  select * into v_task
  from public.daily_tasks
  where id = p_daily_task_id and user_id = v_caller
  for update;

  if not found then
    return jsonb_build_object('status', 'not_found', 'xpAwarded', 0);
  end if;

  -- Idempotent: a double click, a retried request, or two tabs all land here
  -- and only the first one gets past the status guard.
  if v_task.status = 'completed' then
    return jsonb_build_object(
      'status', 'already_completed',
      'xpAwarded', 0,
      'task', to_jsonb(v_task)
    );
  end if;

  -- Only a pending task can be completed. A skipped task must be un-skipped
  -- first, otherwise skipping would be a way to bank XP later.
  if v_task.status <> 'pending' then
    return jsonb_build_object(
      'status', 'not_available',
      'xpAwarded', 0,
      'task', to_jsonb(v_task)
    );
  end if;

  update public.daily_tasks
  set status = 'completed',
      completed_at = now(),
      started_at = coalesce(started_at, now()),
      xp_awarded = xp_reward
  where id = v_task.id and status = 'pending'
  returning * into v_task;

  if not found then
    return jsonb_build_object('status', 'already_completed', 'xpAwarded', 0);
  end if;

  -- Make sure the row exists, then take a row lock on it. Without the lock,
  -- two tasks completed at the same instant would both read the same XP and
  -- the second UPDATE would discard the first one's award.
  perform public.ensure_user_progress(v_caller);
  select * into v_progress
  from public.user_progress
  where user_id = v_caller
  for update;

  -- Streak moves at most once per calendar day, and only forward.
  if v_progress.last_completed_date is null then
    v_new_streak := 1;
  elsif v_progress.last_completed_date = v_task.task_date then
    v_new_streak := greatest(v_progress.current_streak, 1);
  elsif v_progress.last_completed_date = v_task.task_date - 1 then
    v_new_streak := v_progress.current_streak + 1;
  elsif v_progress.last_completed_date > v_task.task_date then
    v_new_streak := v_progress.current_streak; -- backfilling an older day
  else
    v_new_streak := 1; -- a gap broke the streak
  end if;

  v_new_xp := v_progress.xp + coalesce(v_task.xp_reward, 0);

  update public.user_progress
  set xp = v_new_xp,
      level = public.task_level_for_xp(v_new_xp),
      tasks_completed = tasks_completed + 1,
      current_streak = v_new_streak,
      longest_streak = greatest(longest_streak, v_new_streak),
      last_completed_date = greatest(coalesce(last_completed_date, v_task.task_date), v_task.task_date),
      category_counts = public.task_counter_bump(category_counts, v_task.category, 1),
      difficulty_counts = public.task_counter_bump(difficulty_counts, v_task.difficulty, 1),
      updated_at = now()
  where user_id = v_caller
  returning * into v_progress;

  -- Mirror into the legacy profile counters so the admin user list, which
  -- reads profiles.xp, stays consistent. Guarded on the catalog.
  if public.task_profiles_xp_syncable() then
    update public.profiles
    set xp = xp + coalesce(v_task.xp_reward, 0),
        level = public.task_level_for_xp(xp + coalesce(v_task.xp_reward, 0)),
        updated_at = now()
    where id = v_caller;
  end if;

  return jsonb_build_object(
    'status', 'completed',
    'xpAwarded', coalesce(v_task.xp_reward, 0),
    'task', to_jsonb(v_task),
    'progress', to_jsonb(v_progress)
  );
end;
$$;

-- Lets a user undo a mis-tap.
--
-- XP, tasks_completed, category_counts and difficulty_counts are reversed
-- exactly. `last_completed_date` is recomputed from the remaining completions.
-- `current_streak` / `longest_streak` are deliberately NOT recomputed unless
-- the user has no completions left: a streak is a historical fact about days
-- attended, and correctly rebuilding it would mean replaying the whole
-- history. Undoing one tap should not be able to destroy a 40-day streak.
create or replace function public.uncomplete_daily_task(
  p_daily_task_id uuid,
  p_user_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth uuid := auth.uid();
  v_caller uuid;
  v_task public.daily_tasks;
  v_progress public.user_progress;
  v_refund integer;
  v_last_date date;
  v_remaining integer;
begin
  v_caller := coalesce(v_auth, p_user_id);
  if v_caller is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if v_auth is not null and p_user_id is not null and p_user_id <> v_auth then
    raise exception 'cannot modify another user''s task' using errcode = '42501';
  end if;

  select * into v_task
  from public.daily_tasks
  where id = p_daily_task_id and user_id = v_caller
  for update;

  if not found or v_task.status <> 'completed' then
    return jsonb_build_object('status', 'noop', 'xpAwarded', 0);
  end if;

  update public.daily_tasks
  set status = 'pending', completed_at = null, xp_awarded = 0
  where id = v_task.id and status = 'completed'
  returning * into v_task;

  if not found then
    return jsonb_build_object('status', 'noop', 'xpAwarded', 0);
  end if;

  v_refund := coalesce(v_task.xp_reward, 0);

  perform public.ensure_user_progress(v_caller);
  select * into v_progress
  from public.user_progress
  where user_id = v_caller
  for update;

  select count(*), max(d.task_date)
  into v_remaining, v_last_date
  from public.daily_tasks d
  where d.user_id = v_caller and d.status = 'completed';

  update public.user_progress
  set xp = greatest(0, xp - v_refund),
      level = public.task_level_for_xp(greatest(0, xp - v_refund)),
      tasks_completed = greatest(0, tasks_completed - 1),
      category_counts = public.task_counter_bump(category_counts, v_task.category, -1),
      difficulty_counts = public.task_counter_bump(difficulty_counts, v_task.difficulty, -1),
      last_completed_date = v_last_date,
      current_streak = case when v_remaining = 0 then 0 else current_streak end,
      longest_streak = case when v_remaining = 0 then 0 else longest_streak end,
      updated_at = now()
  where user_id = v_caller
  returning * into v_progress;

  if public.task_profiles_xp_syncable() then
    update public.profiles
    set xp = greatest(0, xp - v_refund),
        level = public.task_level_for_xp(greatest(0, xp - v_refund)),
        updated_at = now()
    where id = v_caller;
  end if;

  return jsonb_build_object(
    'status', 'reverted',
    'xpAwarded', -v_refund,
    'task', to_jsonb(v_task),
    'progress', to_jsonb(v_progress)
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- 7. ROW LEVEL SECURITY
-- ----------------------------------------------------------------------------

alter table public.task_templates enable row level security;
alter table public.daily_tasks enable row level security;
alter table public.user_progress enable row level security;

-- Templates are shared content: readable by any signed-in user, writable only
-- by admins (the admin policy from schema.sql stays in force alongside this).
drop policy if exists "task templates readable" on public.task_templates;
create policy "task templates readable"
  on public.task_templates for select to authenticated
  using (active is true and status = 'PUBLISHED');

-- The legacy catch-all policy granted write access through `for all`; replace
-- it with read + completion-only access.
drop policy if exists "users own daily tasks" on public.daily_tasks;

drop policy if exists "users read own daily tasks" on public.daily_tasks;
create policy "users read own daily tasks"
  on public.daily_tasks for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "users update own daily tasks" on public.daily_tasks;
create policy "users update own daily tasks"
  on public.daily_tasks for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- No insert/delete policy on purpose: rows may only be created by
-- generate_daily_tasks(), which is SECURITY DEFINER. The column-level grant
-- below additionally stops a user editing their own xp_reward and claiming it.

drop policy if exists "users read own progress" on public.user_progress;
create policy "users read own progress"
  on public.user_progress for select to authenticated
  using ((select auth.uid()) = user_id);

-- user_progress is read-only to clients; only the SECURITY DEFINER functions
-- may change XP, level, or streaks.
drop policy if exists "users update own progress" on public.user_progress;

grant select on public.task_templates to authenticated;
grant select on public.daily_tasks to authenticated;
grant update (started_at) on public.daily_tasks to authenticated;
grant select on public.user_progress to authenticated;
revoke all on public.daily_tasks from anon;
revoke all on public.user_progress from anon;

-- --- Function privileges --------------------------------------------------
-- A SECURITY DEFINER function exposed to `authenticated` is a privileged API
-- endpoint. Only the three that authorize their own caller are exposed.

revoke all on function public.generate_daily_tasks(uuid, date) from public, anon;
grant execute on function public.generate_daily_tasks(uuid, date) to authenticated, service_role;

drop function if exists public.complete_daily_task(uuid);
revoke all on function public.complete_daily_task(uuid, uuid) from public, anon;
grant execute on function public.complete_daily_task(uuid, uuid) to authenticated, service_role;

drop function if exists public.uncomplete_daily_task(uuid);
revoke all on function public.uncomplete_daily_task(uuid, uuid) from public, anon;
grant execute on function public.uncomplete_daily_task(uuid, uuid) to authenticated, service_role;

-- INTERNAL ONLY. Takes an arbitrary user id, so exposing it would let any
-- signed-in user read (and create) another user's progress row. The definer
-- functions above call it as the function owner, not as the caller.
revoke all on function public.ensure_user_progress(uuid) from public, anon, authenticated;
grant execute on function public.ensure_user_progress(uuid) to service_role;

-- Pure helpers: no data access, safe to leave callable.
revoke all on function public.task_counter_read(jsonb, text) from public, anon;
revoke all on function public.task_counter_bump(jsonb, text, integer) from public, anon;
revoke all on function public.task_profiles_xp_syncable() from public, anon, authenticated;
revoke all on function public.task_daily_tasks_needs_profile() from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 8. SEED TEMPLATES (rule-based content — no AI provider involved)
-- ----------------------------------------------------------------------------

insert into public.task_templates
  (code, title, description, skill, type, category, difficulty, xp_reward, estimated_minutes, cooldown_days, min_level, sort_order, status, active)
values
  -- ---------------- BEGINNER ----------------
  ('beg_compliment', 'Send a genuine compliment',
   'Tell one person something you actually noticed about them — not their looks. Be specific: what they said, made, chose, or did.',
   'confidence', 'REAL_WORLD', 'confidence', 'BEGINNER', 15, 5, 10, 1, 10, 'PUBLISHED', true),
  ('beg_short_convo', 'Start a short conversation',
   'Open one low-stakes conversation today and let it last at least three exchanges. Barista, classmate, coworker — anyone counts.',
   'confidence', 'REAL_WORLD', 'social', 'BEGINNER', 15, 10, 10, 1, 20, 'PUBLISHED', true),
  ('beg_open_question', 'Practice asking an open-ended question',
   'Replace one yes/no question with a question that cannot be answered in one word. Notice how much more you get back.',
   'questions', 'PRACTICE', 'conversation', 'BEGINNER', 15, 5, 10, 1, 30, 'PUBLISHED', true),
  ('beg_reply_unedited', 'Send one message without over-editing',
   'Write the honest version in one sentence, read it once, send it. No rewriting it four times.',
   'texting', 'PRACTICE', 'texting', 'BEGINNER', 15, 3, 12, 1, 40, 'PUBLISHED', true),
  ('beg_self_inventory', 'List three things you bring to the table',
   'Write down three concrete things someone would genuinely enjoy about dating you. Evidence, not affirmations.',
   'overthinking', 'REVIEW', 'mindset', 'BEGINNER', 15, 8, 21, 1, 50, 'PUBLISHED', true),
  ('beg_profile_photo', 'Pick your single strongest photo',
   'Look at your dating photos and choose the one where you look most like a person someone wants to meet. Make it the first.',
   'texting', 'REVIEW', 'dating', 'BEGINNER', 15, 10, 21, 1, 60, 'PUBLISHED', true),
  ('beg_eye_contact', 'Hold eye contact and smile three times',
   'Three separate people today. Look, smile, then look away naturally. That is the whole task.',
   'confidence', 'REAL_WORLD', 'confidence', 'BEGINNER', 15, 5, 14, 1, 70, 'PUBLISHED', true),
  ('beg_greet_three', 'Greet three strangers',
   'A nod and a hello is enough. You are proving to yourself that nothing bad happens.',
   'confidence', 'REAL_WORLD', 'social', 'BEGINNER', 15, 5, 14, 1, 80, 'PUBLISHED', true),
  ('beg_follow_up', 'Ask one follow-up question',
   'Pick one thing the other person said and dig into it instead of changing the subject to yourself.',
   'questions', 'PRACTICE', 'conversation', 'BEGINNER', 15, 5, 12, 1, 90, 'PUBLISHED', true),
  ('beg_double_text', 'Send the message you have been sitting on',
   'That reply you drafted and never sent? Send it. The anxiety is worse than the outcome.',
   'overthinking', 'REAL_WORLD', 'texting', 'BEGINNER', 20, 3, 14, 1, 100, 'PUBLISHED', true),

  -- ---------------- INTERMEDIATE ----------------
  ('int_new_person', 'Start a conversation with someone new',
   'Someone you have never spoken to before. Open it, carry it for two minutes, end it cleanly on a high note.',
   'confidence', 'REAL_WORLD', 'social', 'INTERMEDIATE', 25, 15, 10, 1, 10, 'PUBLISHED', true),
  ('int_deeper_question', 'Ask a deeper question',
   'Move one conversation past logistics. Ask what they actually care about, or why they chose what they chose.',
   'questions', 'PRACTICE', 'conversation', 'INTERMEDIATE', 25, 10, 10, 1, 20, 'PUBLISHED', true),
  ('int_keep_going', 'Practice keeping a conversation going',
   'Keep one chat alive for six exchanges without interviewing them. Statement, detail, question — repeat.',
   'texting', 'PRACTICE', 'texting', 'INTERMEDIATE', 25, 15, 10, 1, 30, 'PUBLISHED', true),
  ('int_playful_tease', 'Replace one compliment with a playful tease',
   'Light, warm, obviously affectionate. Flirting is personality, not performance.',
   'flirting', 'PRACTICE', 'texting', 'INTERMEDIATE', 25, 5, 12, 1, 40, 'PUBLISHED', true),
  ('int_short_story', 'Tell a 30-second story',
   'One small thing that happened to you this week, told with a beginning and a punchline. Practice it out loud first.',
   'storytelling', 'PRACTICE', 'conversation', 'INTERMEDIATE', 25, 10, 14, 1, 50, 'PUBLISHED', true),
  ('int_concrete_plan', 'Suggest a specific plan',
   'No "we should hang out sometime". Name a day, a time, and a place. Let them say yes or no to something real.',
   'asking_out', 'REAL_WORLD', 'dating', 'INTERMEDIATE', 30, 5, 10, 1, 60, 'PUBLISHED', true),
  ('int_say_no', 'Say no to one thing',
   'Decline one request you would normally absorb. Boundaries are the cheapest confidence you can buy.',
   'boundaries', 'REAL_WORLD', 'confidence', 'INTERMEDIATE', 25, 5, 14, 1, 70, 'PUBLISHED', true),
  ('int_reframe', 'Reframe one anxious thought',
   'Write the spiral down, then write what you would tell a friend who said it. Keep the second version.',
   'overthinking', 'REVIEW', 'mindset', 'INTERMEDIATE', 25, 10, 14, 1, 80, 'PUBLISHED', true),
  ('int_rewrite_bio', 'Rewrite one line of your bio',
   'Cut the line that could belong to anyone and replace it with something only you would write.',
   'texting', 'REVIEW', 'dating', 'INTERMEDIATE', 25, 15, 21, 1, 90, 'PUBLISHED', true),
  ('int_leave_room', 'End a chat while it is still good',
   'Stop trying to keep it alive. Exit on a high note and let effort be information.',
   'texting', 'PRACTICE', 'texting', 'INTERMEDIATE', 25, 5, 14, 1, 100, 'PUBLISHED', true),

  -- ---------------- ADVANCED ----------------
  ('adv_social_initiative', 'Take a social initiative',
   'Be the one who organises it. Pick the plan, invite the people, carry the awkward first five minutes.',
   'confidence', 'REAL_WORLD', 'social', 'ADVANCED', 40, 30, 10, 1, 10, 'PUBLISHED', true),
  ('adv_meaningful_convo', 'Have a meaningful conversation',
   'One conversation today that goes somewhere real. Ask what they are actually dealing with, and say something true back.',
   'questions', 'REAL_WORLD', 'conversation', 'ADVANCED', 40, 25, 10, 1, 20, 'PUBLISHED', true),
  ('adv_handle_rejection', 'Practice handling rejection',
   'Ask for something you might not get. If the answer is no, respond gracefully and keep your day intact. That is the rep.',
   'rejection', 'REAL_WORLD', 'mindset', 'ADVANCED', 45, 15, 10, 1, 30, 'PUBLISHED', true),
  ('adv_ask_out', 'Ask someone out directly',
   'No hedging, no "if you want". Clear invitation, specific plan, relaxed delivery.',
   'asking_out', 'REAL_WORLD', 'dating', 'ADVANCED', 50, 10, 10, 1, 40, 'PUBLISHED', true),
  ('adv_vulnerable', 'Share something slightly vulnerable',
   'Say one true thing you would normally edit out. Watch how fast the conversation gets real.',
   'confidence', 'REAL_WORLD', 'confidence', 'ADVANCED', 40, 10, 12, 1, 50, 'PUBLISHED', true),
  ('adv_text_to_call', 'Move a chat off the app',
   'Suggest a call or a meet-up. Text is a waiting room, not a relationship.',
   'escalation', 'REAL_WORLD', 'texting', 'ADVANCED', 40, 10, 12, 1, 60, 'PUBLISHED', true),
  ('adv_cold_open', 'Open a conversation with a complete stranger',
   'No shared context, no excuse, no mutual friend. Just an observation and a question.',
   'confidence', 'REAL_WORLD', 'social', 'ADVANCED', 45, 15, 14, 1, 70, 'PUBLISHED', true),
  ('adv_debrief_rejection', 'Debrief a past rejection without flinching',
   'Write what actually happened, what you would change, and what was never yours to control. Then close the file.',
   'rejection', 'REVIEW', 'mindset', 'ADVANCED', 40, 20, 21, 1, 80, 'PUBLISHED', true),
  ('adv_lead_the_date', 'Lead a plan end to end',
   'Choose it, book it, drive it. Decisiveness reads as confidence far more reliably than good lines do.',
   'asking_out', 'REAL_WORLD', 'dating', 'ADVANCED', 45, 60, 14, 1, 90, 'PUBLISHED', true),
  ('adv_hold_the_pause', 'Hold a pause instead of filling it',
   'Let three silences happen today without rushing to fill them. Comfort with silence is the tell.',
   'confidence', 'PRACTICE', 'confidence', 'ADVANCED', 40, 10, 14, 1, 100, 'PUBLISHED', true)
on conflict (code) do update set
  title = excluded.title,
  description = excluded.description,
  skill = excluded.skill,
  type = excluded.type,
  category = excluded.category,
  difficulty = excluded.difficulty,
  xp_reward = excluded.xp_reward,
  estimated_minutes = excluded.estimated_minutes,
  cooldown_days = excluded.cooldown_days,
  min_level = excluded.min_level,
  sort_order = excluded.sort_order,
  status = excluded.status,
  active = excluded.active;

-- Make the new RPCs visible to PostgREST immediately instead of on its next
-- scheduled cache reload.
notify pgrst, 'reload schema';
