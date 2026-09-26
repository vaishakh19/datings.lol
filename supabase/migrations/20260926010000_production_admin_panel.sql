-- Production admin panel persistence and operational controls.
-- This migration is intentionally additive and safe to apply more than once.

create extension if not exists pgcrypto;

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'pro')),
  status text not null default 'inactive' check (status in ('active', 'inactive', 'past_due', 'canceled')),
  provider text not null default 'admin',
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.feature_flags (
  key text primary key,
  state text not null default 'OFF' check (state in ('ON', 'OFF', 'BETA')),
  rollout_percent integer not null default 100 check (rollout_percent between 0 and 100),
  description text,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references auth.users(id) on delete restrict,
  action text not null,
  target_type text not null,
  target_id text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.broadcasts (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 80),
  message text not null check (char_length(message) between 1 and 500),
  tone text not null default 'update' check (tone in ('update', 'warning', 'win')),
  status text not null default 'DRAFT' check (status in ('DRAFT', 'SCHEDULED', 'LIVE', 'EXPIRED', 'ARCHIVED')),
  audience text not null default 'ALL_USERS',
  expires_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.daily_lesson_config (
  id uuid primary key default gen_random_uuid(),
  lesson_id integer,
  mode text not null default 'AUTOMATIC' check (mode in ('AUTOMATIC', 'MANUAL')),
  focus text,
  note text,
  task_type text,
  difficulty text,
  xp_reward integer check (xp_reward between 0 and 500),
  coach_prompt text,
  publish_at timestamptz,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

-- Add the fields when daily_lesson_config came from the original schema.
alter table public.daily_lesson_config add column if not exists lesson_id integer;
alter table public.daily_lesson_config add column if not exists note text;

create table if not exists public.system_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  description text,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

-- Used by operational activity metrics. The application can update this on activity.
alter table if exists public.profiles add column if not exists last_active_date date;

create index if not exists subscriptions_status_plan_idx on public.subscriptions(status, plan);
create index if not exists broadcasts_status_created_idx on public.broadcasts(status, created_at desc);
create index if not exists audit_logs_created_idx on public.audit_logs(created_at desc);
create index if not exists daily_lesson_config_updated_idx on public.daily_lesson_config(updated_at desc);

alter table public.subscriptions enable row level security;
alter table public.admin_users enable row level security;
alter table public.feature_flags enable row level security;
alter table public.audit_logs enable row level security;
alter table public.broadcasts enable row level security;
alter table public.daily_lesson_config enable row level security;
alter table public.system_settings enable row level security;

-- The browser never needs direct access to admin tables. All writes go through
-- the server with a verified JWT and the service role. These read policies are
-- useful for audited Supabase SQL access while still requiring membership.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'feature_flags' and policyname = 'admins read feature flags') then
    create policy "admins read feature flags" on public.feature_flags for select to authenticated using (auth.uid() in (select user_id from public.admin_users));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'audit_logs' and policyname = 'admins read audit logs v2') then
    create policy "admins read audit logs v2" on public.audit_logs for select to authenticated using (auth.uid() in (select user_id from public.admin_users));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'broadcasts' and policyname = 'admins read broadcasts') then
    create policy "admins read broadcasts" on public.broadcasts for select to authenticated using (auth.uid() in (select user_id from public.admin_users));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'daily_lesson_config' and policyname = 'admins read daily config') then
    create policy "admins read daily config" on public.daily_lesson_config for select to authenticated using (auth.uid() in (select user_id from public.admin_users));
  end if;
end $$;

-- Seed the controls shown by the admin UI without overwriting existing values.
-- Atomic admin mutations for the synchronized account payload. Only the server
-- service role can execute these helpers.
create or replace function public.admin_set_user_pro(p_user_id uuid, p_is_pro boolean)
returns void
language sql
security invoker
set search_path = public
as $$
  update public.user_app_state
  set state = jsonb_set(state, '{isPro}', to_jsonb(p_is_pro), true),
      updated_at = now()
  where user_id = p_user_id;
$$;

create or replace function public.admin_reset_user_progress(p_user_id uuid)
returns void
language sql
security invoker
set search_path = public
as $$
  update public.user_app_state
  set state = jsonb_set(
        state,
        '{progress}',
        coalesce(state -> 'progress', '{}'::jsonb) || jsonb_build_object(
          'xp', 0,
          'streak', 0,
          'lastCompletedDate', null,
          'completedDates', '[]'::jsonb,
          'currentDay', 1,
          'journal', '[]'::jsonb,
          'badges', '[]'::jsonb,
          'lessonsViewed', '[]'::jsonb
        ),
        true
      ),
      updated_at = now()
  where user_id = p_user_id;
$$;

revoke all on function public.admin_set_user_pro(uuid, boolean) from public, anon, authenticated;
revoke all on function public.admin_reset_user_progress(uuid) from public, anon, authenticated;
grant execute on function public.admin_set_user_pro(uuid, boolean) to service_role;
grant execute on function public.admin_reset_user_progress(uuid) to service_role;

insert into public.feature_flags (key, state, rollout_percent, description) values
  ('AI_COACH', 'ON', 100, 'AI coach chat and response generation'),
  ('SCREENSHOT_ANALYSIS', 'ON', 100, 'Conversation screenshot analysis'),
  ('AI_SIMULATOR', 'BETA', 25, 'Interactive dating conversation simulator'),
  ('COMMUNITY', 'ON', 100, 'Community lessons and hot takes'),
  ('DAILY_TASKS', 'ON', 100, 'Personalized daily mission engine'),
  ('PROFILE_AUDIT', 'ON', 100, 'AI dating profile audit'),
  ('PAYWALL', 'ON', 100, 'Pro upgrade surfaces')
on conflict (key) do nothing;
