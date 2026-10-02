-- ============================================================================
-- Daily Tasks — preflight + verification
-- Paste these into the Supabase SQL Editor ONE STEP AT A TIME.
-- Nothing in this file modifies data except STEP 5, which is clearly marked.
-- ============================================================================


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
-- STEP 4 — FIND YOUR OWN USER ID
-- ----------------------------------------------------------------------------
-- Replace the email, then copy the uuid it returns into the steps below.
-- ============================================================================

select id, email, created_at
from auth.users
where lower(email) = lower('YOUR_EMAIL_HERE');


-- ============================================================================
-- STEP 5 — BEHAVIOUR TEST  (⚠️ this one WRITES rows for the user below)
-- ----------------------------------------------------------------------------
-- Replace every 'USER_UUID' with the uuid from step 4.
-- Running as the SQL Editor = service role, so the ±1 day clamp does not
-- apply and you can jump dates freely.
-- ============================================================================

-- 5a. Day 1 — a brand-new user gets 3 BEGINNER tasks in 3 distinct categories.
select title, difficulty, category, xp_reward
from public.generate_daily_tasks('USER_UUID', current_date);

-- 5b. IDEMPOTENCY — run 5a again. Identical titles, and still only 3 rows.
select count(*) as should_be_3
from public.daily_tasks
where user_id = 'USER_UUID' and task_date = current_date;

-- 5c. Day 2 — a different set (day 1's templates are now on cooldown).
select title, difficulty, category
from public.generate_daily_tasks('USER_UUID', current_date + 1);

-- 5d. PROGRESSION — fake some history and watch the tier move up.
update public.user_progress
set tasks_completed = 30, level = 7
where user_id = 'USER_UUID';

select title, difficulty
from public.generate_daily_tasks('USER_UUID', current_date + 2);
-- Expected: mostly ADVANCED rows now.

-- 5e. XP IS AWARDED EXACTLY ONCE.
-- Grab one task id first:
select id, title, xp_reward
from public.daily_tasks
where user_id = 'USER_UUID' and task_date = current_date
limit 1;

-- Then run this twice with that id:
select public.complete_daily_task('DAILY_TASK_UUID', 'USER_UUID');
-- 1st run: {"status":"completed","xpAwarded":15,...}
-- 2nd run: {"status":"already_completed","xpAwarded":0,...}   <-- the guarantee

-- 5f. Progress reflects it.
select xp, level, tasks_completed, current_streak, longest_streak, category_counts
from public.user_progress
where user_id = 'USER_UUID';


-- ============================================================================
-- STEP 6 — CLEAN UP THE TEST DATA
-- ----------------------------------------------------------------------------
-- Wipes the rows step 5 created so you start fresh in the real app.
-- ============================================================================

delete from public.daily_tasks where user_id = 'USER_UUID';
delete from public.user_progress where user_id = 'USER_UUID';
