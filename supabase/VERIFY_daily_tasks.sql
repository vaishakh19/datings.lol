-- ============================================================================
-- Daily Tasks — preflight + verification
-- Paste these into the Supabase SQL Editor ONE STEP AT A TIME.
-- Nothing in this file modifies data except STEP 5, which is clearly marked.
-- ============================================================================


-- ============================================================================
-- STEP 0 — WHERE AM I?  (always safe, run this any time you are unsure)
-- ----------------------------------------------------------------------------
-- Tells you in one row whether the migration has been applied yet.
-- ============================================================================

-- Reads only the catalog, so it works no matter what does or does not exist.
select
  to_regclass('public.user_progress')  is not null as migration_applied,
  to_regclass('public.task_templates') is not null as templates_table_exists,
  to_regclass('public.daily_tasks')    is not null as daily_tasks_table_exists,
  (select count(*) from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'generate_daily_tasks') as generator_fns;

-- migration_applied = false  -> go do STEP 2. Nothing else in this file works
--                               until that is true.
-- migration_applied = true and generator_fns = 1 -> ready, continue at STEP 3.
-- generator_fns = 2 -> an old overload survived; see the note under STEP 3b.


-- ============================================================================
-- STEP 1 — PREFLIGHT (run BEFORE the migration)
-- ----------------------------------------------------------------------------
-- The migration drops a unique constraint and a NOT NULL on public.daily_tasks.
-- If this returns 0, there is no data to break and the migration is risk-free.
-- ============================================================================

select
  (select count(*) from public.daily_tasks)     as daily_task_rows,
  (select count(*) from public.task_templates)  as template_rows,
  (select count(*) from auth.users)             as users;

-- Expected on your project: daily_task_rows = 0, template_rows = 0.
-- If daily_task_rows > 0, stop and tell me the number before continuing.


-- ============================================================================
-- STEP 2 — APPLY THE MIGRATION
-- ----------------------------------------------------------------------------
-- Do NOT paste this file. Open:
--   supabase/migrations/20261002000000_dynamic_daily_tasks.sql
-- copy the WHOLE file, paste it into a new SQL Editor query, and Run.
-- It is additive and safe to run more than once.
-- ============================================================================


-- ============================================================================
-- STEP 3 — DID IT LAND? (run AFTER the migration)
-- ============================================================================

-- 3a. 30 seeded templates, 10 per tier, 6 categories each.
select difficulty, count(*) as templates, count(distinct category) as categories
from public.task_templates
where active and status = 'PUBLISHED'
group by difficulty
order by difficulty;
-- Expected: ADVANCED 10/6, BEGINNER 10/6, INTERMEDIATE 10/6

-- 3b. The three RPCs exist.
select p.proname, pg_get_function_identity_arguments(p.oid) as args
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('generate_daily_tasks', 'complete_daily_task', 'uncomplete_daily_task')
order by p.proname;
-- Expected: exactly 3 rows. If complete_daily_task appears TWICE, the old
-- single-argument overload survived — run:
--   drop function if exists public.complete_daily_task(uuid);
--   drop function if exists public.uncomplete_daily_task(uuid);

-- 3c. RLS is on and the policies are the restrictive ones.
select tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
  and tablename in ('daily_tasks', 'user_progress', 'task_templates')
order by tablename, policyname;
-- daily_tasks should have NO policy with cmd = 'INSERT' or 'DELETE'.


-- ============================================================================
-- STEP 4 — PUT YOUR EMAIL IN
-- ----------------------------------------------------------------------------
-- Every query below looks your account up by email, so there are no UUIDs to
-- copy around. Use your editor's find-and-replace to swap YOUR_EMAIL_HERE for
-- your real signup email across this whole file, then run the steps in order.
--
-- Sanity check that the email matches an account:
-- ============================================================================

select id, email, created_at
from auth.users
where lower(email) = lower('YOUR_EMAIL_HERE');
-- Exactly 1 row expected. 0 rows = wrong email, fix it before continuing.


-- ============================================================================
-- STEP 5 — BEHAVIOUR TEST  (⚠️ these WRITE rows for your account)
-- ----------------------------------------------------------------------------
-- The SQL Editor runs as the service role, so the ±1 day clamp does not apply
-- and you can jump dates freely. Run each block on its own.
-- ============================================================================

-- 5a. DAY 1 — a new account gets 3 BEGINNER tasks in 3 distinct categories.
with me as (select id from auth.users where lower(email) = lower('YOUR_EMAIL_HERE'))
select t.title, t.difficulty, t.category, t.xp_reward
from me cross join lateral public.generate_daily_tasks(me.id, current_date) t;

-- 5b. IDEMPOTENCY — run 5a again: identical titles. Then confirm no duplicates:
with me as (select id from auth.users where lower(email) = lower('YOUR_EMAIL_HERE'))
select count(*) as should_be_3
from public.daily_tasks dt, me
where dt.user_id = me.id and dt.task_date = current_date;

-- 5c. DAY 2 — a different set (day 1's templates are now on cooldown).
with me as (select id from auth.users where lower(email) = lower('YOUR_EMAIL_HERE'))
select t.title, t.difficulty, t.category
from me cross join lateral public.generate_daily_tasks(me.id, current_date + 1) t;

-- 5d. PROGRESSION — fake some history, watch the difficulty tier move up.
with me as (select id from auth.users where lower(email) = lower('YOUR_EMAIL_HERE'))
update public.user_progress up
set tasks_completed = 30, level = 7
from me where up.user_id = me.id;

with me as (select id from auth.users where lower(email) = lower('YOUR_EMAIL_HERE'))
select t.title, t.difficulty
from me cross join lateral public.generate_daily_tasks(me.id, current_date + 2) t;
-- Expected: mostly ADVANCED rows now.

-- 5e. XP IS AWARDED EXACTLY ONCE — run this block TWICE.
with me as (select id from auth.users where lower(email) = lower('YOUR_EMAIL_HERE')),
     target as (
       select dt.id from public.daily_tasks dt, me
       where dt.user_id = me.id and dt.task_date = current_date
       order by dt.sort_order limit 1
     )
select public.complete_daily_task(target.id, me.id) from target, me;
-- 1st run: {"status":"completed","xpAwarded":15,...}
-- 2nd run: {"status":"already_completed","xpAwarded":0,...}   <-- the guarantee

-- 5f. Progress reflects it.
with me as (select id from auth.users where lower(email) = lower('YOUR_EMAIL_HERE'))
select up.xp, up.level, up.tasks_completed, up.current_streak, up.category_counts
from public.user_progress up, me
where up.user_id = me.id;


-- ============================================================================
-- STEP 6 — CLEAN UP THE TEST DATA
-- ----------------------------------------------------------------------------
-- Wipes what step 5 created so the real app starts you fresh.
-- ============================================================================

with me as (select id from auth.users where lower(email) = lower('YOUR_EMAIL_HERE'))
delete from public.daily_tasks dt using me where dt.user_id = me.id;

with me as (select id from auth.users where lower(email) = lower('YOUR_EMAIL_HERE'))
delete from public.user_progress up using me where up.user_id = me.id;
