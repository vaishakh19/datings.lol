-- datings.lol personalized coaching schema
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  display_name text,
  goal text,
  blocker text,
  timezone text not null default 'UTC',
  xp integer not null default 0 check (xp >= 0),
  level integer not null default 1 check (level >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_skills (
  user_id uuid not null references public.profiles(id) on delete cascade,
  skill text not null check (skill in ('texting','confidence','flirting','questions','storytelling','escalation','asking_out','rejection','boundaries','overthinking')),
  score integer not null default 50 check (score between 0 and 100),
  practiced_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, skill)
);

create table if not exists public.user_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  goal text not null,
  priority integer not null default 1 check (priority > 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  skill text not null,
  kind text not null check (kind in ('LEARN','PRACTICE','SIMULATION','REAL_WORLD','REVIEW')),
  difficulty text not null check (difficulty in ('BEGINNER','INTERMEDIATE','ADVANCED','BRUTAL')),
  title text not null,
  description text not null,
  xp_reward integer not null check (xp_reward between 1 and 500),
  source text not null default 'rule_engine',
  created_at timestamptz not null default now()
);

create table if not exists public.daily_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  task_date date not null,
  started_at timestamptz,
  completed_at timestamptz,
  unique (user_id, task_date)
);

create table if not exists public.task_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  answer text,
  score integer check (score between 0 and 100),
  created_at timestamptz not null default now()
);

create table if not exists public.coach_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text,
  mode text not null default 'direct' check (mode in ('gentle','direct','brutal')),
  context text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.coach_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.coach_conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('user','coach')),
  content text not null check (char_length(content) <= 10000),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.coach_context (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  dating_goal text,
  current_situation text,
  communication_preferences jsonb not null default '{}'::jsonb,
  relevant_context text,
  updated_at timestamptz not null default now()
);

create table if not exists public.coach_usage (
  user_id uuid not null references public.profiles(id) on delete cascade,
  usage_date date not null,
  timezone text not null default 'UTC',
  messages_used integer not null default 0 check (messages_used >= 0),
  messages_limit integer not null default 3 check (messages_limit >= 0),
  last_message_at timestamptz,
  primary key (user_id, usage_date)
);

create table if not exists public.coach_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  scenario text not null,
  mode text not null default 'direct' check (mode in ('gentle','direct','brutal')),
  score integer check (score between 0 and 100),
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create table if not exists public.coach_analysis (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  conversation_id uuid references public.coach_conversations(id) on delete set null,
  intent text not null,
  confidence_score integer check (confidence_score between 0 and 100),
  naturalness_score integer check (naturalness_score between 0 and 100),
  flirting_score integer check (flirting_score between 0 and 100),
  pressure_score integer check (pressure_score between 0 and 100),
  summary text,
  created_at timestamptz not null default now()
);

create table if not exists public.coach_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  message_id uuid references public.coach_messages(id) on delete set null,
  helpful boolean not null,
  created_at timestamptz not null default now()
);

create table if not exists public.achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  achievement_key text not null,
  unlocked_at timestamptz not null default now(),
  unique (user_id, achievement_key)
);

create table if not exists public.xp_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount integer not null check (amount > 0),
  reason text not null,
  task_id uuid references public.tasks(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.streaks (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  current_count integer not null default 0 check (current_count >= 0),
  best_count integer not null default 0 check (best_count >= 0),
  last_completed_date date,
  updated_at timestamptz not null default now()
);

create table if not exists public.teaching_categories (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  label text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.community_teachings (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.teaching_categories(id) on delete set null,
  title text not null,
  subtitle text not null,
  content jsonb not null default '{}'::jsonb,
  type text not null check (type in ('LESSON','REMINDER','MYTH','BREAKDOWN','CASE STUDY','COACH TIP','CHALLENGE','WEEKLY TEACHING')),
  accent text not null default '#FFE066',
  estimated_read_time integer not null default 2 check (estimated_read_time > 0),
  xp_reward integer not null default 15 check (xp_reward between 0 and 500),
  difficulty text,
  status text not null default 'DRAFT' check (status in ('DRAFT','SCHEDULED','PUBLISHED','ARCHIVED')),
  published_at timestamptz,
  scheduled_at timestamptz,
  is_featured boolean not null default false,
  is_pinned boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.teaching_reactions (
  id uuid primary key default gen_random_uuid(),
  teaching_id uuid not null references public.community_teachings(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reaction text not null check (reaction in ('🔥','💀','💡','❤️')),
  created_at timestamptz not null default now(),
  unique (teaching_id, user_id)
);

create table if not exists public.saved_teachings (
  user_id uuid not null references auth.users(id) on delete cascade,
  teaching_id uuid not null references public.community_teachings(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, teaching_id)
);

create table if not exists public.teaching_views (
  id uuid primary key default gen_random_uuid(),
  teaching_id uuid not null references public.community_teachings(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  viewed_at timestamptz not null default now()
);

create table if not exists public.teaching_completions (
  user_id uuid not null references auth.users(id) on delete cascade,
  teaching_id uuid not null references public.community_teachings(id) on delete cascade,
  completed_at timestamptz not null default now(),
  primary key (user_id, teaching_id)
);

create table if not exists public.teaching_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  teaching_id uuid not null references public.community_teachings(id) on delete cascade,
  progress integer not null default 0 check (progress between 0 and 100),
  updated_at timestamptz not null default now(),
  primary key (user_id, teaching_id)
);

create table if not exists public.community_challenges (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  xp_reward integer not null default 25 check (xp_reward between 0 and 500),
  starts_at timestamptz,
  ends_at timestamptz,
  status text not null default 'DRAFT' check (status in ('DRAFT','PUBLISHED','ARCHIVED')),
  created_by uuid references auth.users(id) on delete set null
);

create table if not exists public.challenge_completions (
  user_id uuid not null references auth.users(id) on delete cascade,
  challenge_id uuid not null references public.community_challenges(id) on delete cascade,
  completed_at timestamptz not null default now(),
  primary key (user_id, challenge_id)
);

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_roles (
  id uuid primary key default gen_random_uuid(),
  role_key text unique not null check (role_key in ('SUPER_ADMIN','ADMIN','EDITOR','MODERATOR','ANALYST','SUPPORT')),
  label text not null
);

create table if not exists public.admin_permissions (
  id uuid primary key default gen_random_uuid(),
  permission_key text unique not null,
  description text not null
);

create table if not exists public.admin_user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role_id uuid not null references public.admin_roles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, role_id)
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
  title text not null,
  message text not null check (char_length(message) <= 500),
  tone text not null,
  status text not null default 'DRAFT' check (status in ('DRAFT','SCHEDULED','LIVE','EXPIRED','ARCHIVED')),
  audience text not null default 'ALL_USERS',
  expires_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

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

create table if not exists public.daily_lesson_config (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references public.tasks(id) on delete set null,
  mode text not null default 'AUTOMATIC' check (mode in ('AUTOMATIC','MANUAL')),
  focus text,
  task_type text,
  difficulty text,
  xp_reward integer,
  coach_prompt text,
  community_teaching_id uuid references public.community_teachings(id) on delete set null,
  publish_at timestamptz,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.feature_flags (
  key text primary key,
  state text not null check (state in ('ON','OFF','BETA')),
  rollout_percent integer not null default 100 check (rollout_percent between 0 and 100),
  description text,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.system_settings (
  key text primary key,
  value jsonb not null,
  description text,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.scheduled_jobs (
  id uuid primary key default gen_random_uuid(),
  job_key text unique not null,
  enabled boolean not null default true,
  schedule text not null,
  last_run_at timestamptz,
  next_run_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.job_runs (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.scheduled_jobs(id) on delete cascade,
  status text not null,
  duration_ms integer,
  error text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  event_name text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.analytics_daily (
  metric_date date not null,
  metric_key text not null,
  metric_value numeric not null default 0,
  primary key (metric_date, metric_key)
);

create index if not exists audit_logs_created_idx on public.audit_logs(created_at desc);
create index if not exists broadcasts_status_idx on public.broadcasts(status, created_at desc);
create index if not exists analytics_events_name_idx on public.analytics_events(event_name, created_at desc);

create table if not exists public.content_schedule (
  id uuid primary key default gen_random_uuid(),
  teaching_id uuid references public.community_teachings(id) on delete cascade,
  challenge_id uuid references public.community_challenges(id) on delete cascade,
  scheduled_at timestamptz not null,
  timezone text not null default 'UTC',
  processed_at timestamptz,
  check ((teaching_id is not null) <> (challenge_id is not null))
);

create table if not exists public.user_settings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  goal text,
  blocker text,
  vibe text not null default 'direct' check (vibe in ('gentle','direct','brutal')),
  timezone text not null default 'UTC',
  privacy jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.user_achievements (
  user_id uuid not null references public.profiles(id) on delete cascade,
  achievement_key text not null,
  status text not null default 'IN_PROGRESS' check (status in ('LOCKED','IN_PROGRESS','UNLOCKED')),
  progress integer not null default 0,
  unlocked_at timestamptz,
  primary key (user_id, achievement_key)
);

create table if not exists public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  content text not null check (char_length(content) <= 5000),
  type text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.dating_profile_uploads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null,
  mime_type text not null,
  byte_size integer not null check (byte_size > 0),
  created_at timestamptz not null default now()
);

create table if not exists public.profile_audits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  profile_type text not null default 'dating_profile',
  score numeric(3,1) check (score between 0 and 10),
  analysis jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists journal_entries_user_idx on public.journal_entries(user_id, created_at desc);
create index if not exists profile_audits_user_idx on public.profile_audits(user_id, created_at desc);
create index if not exists profile_uploads_user_idx on public.dating_profile_uploads(user_id, created_at desc);

create index if not exists community_teachings_published_idx on public.community_teachings(status, published_at desc);
create index if not exists teaching_views_user_idx on public.teaching_views(user_id, viewed_at desc);
create index if not exists teaching_completions_user_idx on public.teaching_completions(user_id, completed_at desc);

alter table public.profiles enable row level security;
alter table public.user_skills enable row level security;
alter table public.user_goals enable row level security;
alter table public.tasks enable row level security;
alter table public.daily_tasks enable row level security;
alter table public.task_attempts enable row level security;
alter table public.coach_conversations enable row level security;
alter table public.coach_messages enable row level security;
alter table public.coach_context enable row level security;
alter table public.coach_usage enable row level security;
alter table public.coach_sessions enable row level security;
alter table public.coach_analysis enable row level security;
alter table public.coach_feedback enable row level security;
alter table public.achievements enable row level security;
alter table public.xp_transactions enable row level security;
alter table public.streaks enable row level security;
alter table public.teaching_categories enable row level security;
alter table public.community_teachings enable row level security;
alter table public.teaching_reactions enable row level security;
alter table public.saved_teachings enable row level security;
alter table public.teaching_views enable row level security;
alter table public.teaching_completions enable row level security;
alter table public.teaching_progress enable row level security;
alter table public.community_challenges enable row level security;
alter table public.challenge_completions enable row level security;
alter table public.admin_users enable row level security;
alter table public.content_schedule enable row level security;
alter table public.admin_roles enable row level security;
alter table public.admin_permissions enable row level security;
alter table public.admin_user_roles enable row level security;
alter table public.audit_logs enable row level security;
alter table public.broadcasts enable row level security;
alter table public.task_templates enable row level security;
alter table public.daily_lesson_config enable row level security;
alter table public.feature_flags enable row level security;
alter table public.system_settings enable row level security;
alter table public.scheduled_jobs enable row level security;
alter table public.job_runs enable row level security;
alter table public.analytics_events enable row level security;
alter table public.analytics_daily enable row level security;
alter table public.user_settings enable row level security;
alter table public.achievements enable row level security;
alter table public.user_achievements enable row level security;
alter table public.journal_entries enable row level security;
alter table public.dating_profile_uploads enable row level security;
alter table public.profile_audits enable row level security;

create policy "users own profiles" on public.profiles for all using (auth.uid() = id) with check (auth.uid() = id);
create policy "users own skills" on public.user_skills for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users own goals" on public.user_goals for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users own tasks" on public.tasks for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users own daily tasks" on public.daily_tasks for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users own attempts" on public.task_attempts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users own conversations" on public.coach_conversations for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users own messages" on public.coach_messages for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users own coach context" on public.coach_context for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users own coach usage" on public.coach_usage for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users own coach sessions" on public.coach_sessions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users own coach analysis" on public.coach_analysis for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users own coach feedback" on public.coach_feedback for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users own achievements" on public.achievements for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users own xp" on public.xp_transactions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users own streaks" on public.streaks for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "published teachings readable" on public.community_teachings for select using (status = 'PUBLISHED' or auth.uid() in (select user_id from public.admin_users));
create policy "categories readable" on public.teaching_categories for select using (true);
create policy "users own reactions" on public.teaching_reactions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users own saves" on public.saved_teachings for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users own views" on public.teaching_views for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users own completions" on public.teaching_completions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users own teaching progress" on public.teaching_progress for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "published challenges readable" on public.community_challenges for select using (status = 'PUBLISHED' or auth.uid() in (select user_id from public.admin_users));
create policy "users own challenge completions" on public.challenge_completions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "admins manage teachings" on public.community_teachings for all using (auth.uid() in (select user_id from public.admin_users)) with check (auth.uid() in (select user_id from public.admin_users));
create policy "admins manage schedules" on public.content_schedule for all using (auth.uid() in (select user_id from public.admin_users)) with check (auth.uid() in (select user_id from public.admin_users));
create policy "admins read roles" on public.admin_roles for select using (auth.uid() in (select user_id from public.admin_users));
create policy "admins read permissions" on public.admin_permissions for select using (auth.uid() in (select user_id from public.admin_users));
create policy "admins manage user roles" on public.admin_user_roles for all using (auth.uid() in (select user_id from public.admin_users)) with check (auth.uid() in (select user_id from public.admin_users));
create policy "admins read audit logs" on public.audit_logs for select using (auth.uid() in (select user_id from public.admin_users));
create policy "admins manage broadcasts" on public.broadcasts for all using (auth.uid() in (select user_id from public.admin_users)) with check (auth.uid() in (select user_id from public.admin_users));
create policy "admins manage task templates" on public.task_templates for all using (auth.uid() in (select user_id from public.admin_users)) with check (auth.uid() in (select user_id from public.admin_users));
create policy "admins manage daily lesson config" on public.daily_lesson_config for all using (auth.uid() in (select user_id from public.admin_users)) with check (auth.uid() in (select user_id from public.admin_users));
create policy "admins manage feature flags" on public.feature_flags for all using (auth.uid() in (select user_id from public.admin_users)) with check (auth.uid() in (select user_id from public.admin_users));
create policy "admins manage system settings" on public.system_settings for all using (auth.uid() in (select user_id from public.admin_users)) with check (auth.uid() in (select user_id from public.admin_users));
create policy "admins manage jobs" on public.scheduled_jobs for all using (auth.uid() in (select user_id from public.admin_users)) with check (auth.uid() in (select user_id from public.admin_users));
create policy "admins read job runs" on public.job_runs for select using (auth.uid() in (select user_id from public.admin_users));
create policy "admins read analytics events" on public.analytics_events for select using (auth.uid() in (select user_id from public.admin_users));
create policy "admins read daily analytics" on public.analytics_daily for select using (auth.uid() in (select user_id from public.admin_users));
create policy "users own settings" on public.user_settings for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users own achievements" on public.user_achievements for select using (auth.uid() = user_id);
create policy "users own journal" on public.journal_entries for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users own profile uploads" on public.dating_profile_uploads for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users own audits" on public.profile_audits for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Cross-device account state. Keep in sync with
-- supabase/migrations/20260926000000_user_app_state.sql.
create table if not exists public.user_app_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  state_version integer not null default 1 check (state_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_app_state_is_object check (jsonb_typeof(state) = 'object')
);
alter table public.user_app_state enable row level security;
create policy "users read own app state" on public.user_app_state for select to authenticated using ((select auth.uid()) = user_id);
create policy "users insert own app state" on public.user_app_state for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "users update own app state" on public.user_app_state for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "users delete own app state" on public.user_app_state for delete to authenticated using ((select auth.uid()) = user_id);
grant select, insert, update, delete on public.user_app_state to authenticated;
revoke all on public.user_app_state from anon;
