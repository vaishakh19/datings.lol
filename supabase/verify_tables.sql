-- supabase/verify_tables.sql
-- Read-only diagnostic to confirm the live database has every table and
-- column the server expects, and that RLS is enabled where required.
-- Run this in the Supabase SQL Editor (no writes, no drops).

-- 1. Tables the server reads/writes ---------------------------------------
with required(name) as (
  values
    ('admin_users'),
    ('subscriptions'),
    ('profiles'),
    ('user_app_state'),
    ('daily_tasks'),
    ('saved_teachings'),
    ('teaching_reactions'),
    ('teaching_completions'),
    ('journal_entries'),
    ('profile_audits'),
    ('streaks'),
    ('feature_flags'),
    ('audit_logs'),
    ('broadcasts'),
    ('daily_lesson_config'),
    ('system_settings'),
    ('analytics_daily'),
    ('coach_daily_usage'),
    ('coach_request_log'),
    ('coach_history'),
    ('billing_checkout_attempts'),
    ('dodo_webhook_events')
)
select
  r.name as table_name,
  case when c.relname is not null then 'PRESENT' else 'MISSING' end as present,
  c.relrowsecurity as rls_enabled
from required r
left join pg_class c
  on c.relname = r.name
 and c.relnamespace = 'public'::regnamespace
order by present, r.name;

-- 2. RPCs the server invokes ----------------------------------------------
with required(name) as (
  values
    ('award_xp'),
    ('begin_dodo_checkout'),
    ('process_dodo_subscription_event'),
    ('record_dodo_webhook_event'),
    ('try_consume_coach_quota'),
    ('admin_set_user_pro'),
    ('admin_reset_user_progress')
)
select
  r.name as function_name,
  case when p.proname is not null then 'PRESENT' else 'MISSING' end as present
from required r
left join pg_proc p
  on p.proname = r.name
 and p.pronamespace = 'public'::regnamespace
order by present, r.name;

-- 3. Columns on the community tables --------------------------------------
select
  table_name,
  column_name,
  data_type,
  is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name in ('saved_teachings', 'teaching_reactions', 'teaching_completions')
order by table_name, ordinal_position;

-- 4. Columns on the other patched tables (profiles, daily_tasks,
--    teaching_completions, coach_history) ---------------------------------
select
  table_name,
  column_name,
  data_type,
  is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name in ('profiles', 'daily_tasks', 'teaching_completions', 'coach_history')
order by table_name, ordinal_position;

-- 5. RLS policies on community/coaching tables ----------------------------
select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('saved_teachings', 'teaching_reactions', 'teaching_completions',
                    'coach_history', 'daily_tasks', 'profiles')
order by tablename, policyname;

-- 6. award_xp function security -------------------------------------------
--    Confirm the function exists, is search_path-safe, and is executable
--    only by service_role (not by public/anon/authenticated directly).
select
  p.proname as function_name,
  pg_get_functiondef(p.oid) as definition,
  has_function_privilege('anon', p.oid, 'execute') as anon_can_execute,
  has_function_privilege('authenticated', p.oid, 'execute') as auth_can_execute,
  has_function_privilege('service_role', p.oid, 'execute') as service_role_can_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'award_xp';

-- 7. Check constraints the new migration adds -----------------------------
select
  r.relname as table_name,
  c.conname as constraint_name,
  pg_get_constraintdef(c.oid) as definition
from pg_constraint c
join pg_class r on r.oid = c.conrelid
join pg_namespace n on n.oid = r.relnamespace
where n.nspname = 'public'
  and r.relname in ('profiles', 'teaching_completions', 'coach_history')
  and c.contype = 'c'
order by r.relname, c.conname;
