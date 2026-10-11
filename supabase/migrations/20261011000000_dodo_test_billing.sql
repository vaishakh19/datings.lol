-- Dodo Payments TEST MODE billing, webhook idempotency, and atomic Coach quotas.
-- Additive migration: preserves existing users and manual/admin entitlements.

create extension if not exists pgcrypto;

-- The admin-panel migration already creates this table. Keep this definition so
-- this migration is also safe when applied to a database that only has the base
-- application schema.
create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'pro')),
  status text not null default 'inactive',
  provider text not null default 'admin',
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.subscriptions add column if not exists provider_customer_id text;
alter table public.subscriptions add column if not exists provider_subscription_id text;
alter table public.subscriptions add column if not exists provider_product_id text;
alter table public.subscriptions add column if not exists checkout_session_id text;
alter table public.subscriptions add column if not exists current_period_start timestamptz;
alter table public.subscriptions add column if not exists past_due_ends_at timestamptz;
alter table public.subscriptions add column if not exists cancel_at_period_end boolean not null default false;
alter table public.subscriptions add column if not exists provider_event_at timestamptz;
alter table public.subscriptions add column if not exists last_webhook_id text;

-- Replace the old four-state constraint with the exact Dodo lifecycle plus the
-- local inactive/revoked states. The block finds the old generated constraint
-- even if PostgreSQL assigned a non-default name.
do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'subscriptions'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%status%'
  loop
    execute format('alter table public.subscriptions drop constraint %I', constraint_name);
  end loop;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.subscriptions'::regclass
      and conname = 'subscriptions_billing_status_check'
  ) then
    alter table public.subscriptions
      add constraint subscriptions_billing_status_check
      check (status in (
        'inactive', 'pending', 'active', 'past_due', 'on_hold', 'paused',
        'cancelled', 'canceled', 'failed', 'expired', 'revoked'
      ));
  end if;
end $$;

create unique index if not exists subscriptions_provider_subscription_uidx
  on public.subscriptions(provider, provider_subscription_id)
  where provider_subscription_id is not null;
create index if not exists subscriptions_user_entitlement_idx
  on public.subscriptions(user_id, provider, status, current_period_end);
create unique index if not exists subscriptions_provider_customer_uidx
  on public.subscriptions(provider, provider_customer_id)
  where provider_customer_id is not null;

alter table public.subscriptions enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'subscriptions'
      and policyname = 'users read own billing subscription'
  ) then
    create policy "users read own billing subscription"
      on public.subscriptions
      for select
      to authenticated
      using ((select auth.uid()) = user_id);
  end if;
end $$;

-- Users may inspect their own non-sensitive billing state, but all entitlement
-- writes are reserved for the service-role backend.
revoke all on public.subscriptions from anon;
revoke all on public.subscriptions from authenticated;
grant select (
  user_id, plan, status, provider, current_period_start, current_period_end,
  past_due_ends_at, cancel_at_period_end, created_at, updated_at
) on public.subscriptions to authenticated;

create table if not exists public.dodo_webhook_events (
  webhook_id text primary key,
  event_type text not null,
  event_timestamp timestamptz not null,
  payload_sha256 text not null check (payload_sha256 ~ '^[0-9a-f]{64}$'),
  provider_subscription_id text,
  user_id uuid references auth.users(id) on delete set null,
  processing_status text not null default 'processing'
    check (processing_status in ('processing', 'processed', 'duplicate', 'ignored', 'ignored_stale', 'quarantined')),
  diagnostic_code text,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists dodo_webhook_events_received_idx
  on public.dodo_webhook_events(received_at desc);
create index if not exists dodo_webhook_events_subscription_idx
  on public.dodo_webhook_events(provider_subscription_id, event_timestamp desc);

alter table public.dodo_webhook_events enable row level security;
revoke all on public.dodo_webhook_events from anon, authenticated;

create table if not exists public.billing_checkout_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null default 'dodo' check (provider = 'dodo'),
  provider_product_id text,
  status text not null default 'creating'
    check (status in ('creating', 'pending', 'completed', 'cancelled', 'failed', 'expired')),
  checkout_session_id text unique,
  checkout_url text,
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours')
);

alter table public.billing_checkout_attempts add column if not exists provider_product_id text;
alter table public.billing_checkout_attempts add column if not exists checkout_url text;
alter table public.billing_checkout_attempts
  alter column expires_at set default (now() + interval '24 hours');

create unique index if not exists billing_checkout_one_open_per_user_uidx
  on public.billing_checkout_attempts(user_id)
  where status in ('creating', 'pending');
create index if not exists billing_checkout_attempts_rate_idx
  on public.billing_checkout_attempts(user_id, created_at desc);

alter table public.billing_checkout_attempts enable row level security;
revoke all on public.billing_checkout_attempts from anon, authenticated;

-- Dedicated aggregate counter avoids relying on the legacy coach_usage shape.
create table if not exists public.coach_daily_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null,
  messages_used integer not null default 0 check (messages_used >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, usage_date)
);

create table if not exists public.coach_request_log (
  id bigint generated by default as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  plan text not null check (plan in ('free', 'pro')),
  model text,
  input_tokens integer,
  output_tokens integer,
  total_tokens integer,
  request_type text not null default 'chat',
  created_at timestamptz not null default now()
);

create index if not exists coach_request_log_user_date_idx
  on public.coach_request_log(user_id, created_at desc);

alter table public.coach_daily_usage enable row level security;
alter table public.coach_request_log enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'coach_daily_usage'
      and policyname = 'users read own daily coach usage'
  ) then
    create policy "users read own daily coach usage"
      on public.coach_daily_usage
      for select
      to authenticated
      using ((select auth.uid()) = user_id);
  end if;
end $$;

revoke all on public.coach_daily_usage from anon;
revoke insert, update, delete on public.coach_daily_usage from authenticated;
grant select on public.coach_daily_usage to authenticated;
revoke all on public.coach_request_log from anon, authenticated;

-- Be explicit rather than relying on project-level default privileges. These
-- grants are held only by the server credential; RLS still rejects browser roles.
grant all privileges on table public.subscriptions to service_role;
grant all privileges on table public.dodo_webhook_events to service_role;
grant all privileges on table public.billing_checkout_attempts to service_role;
grant all privileges on table public.coach_daily_usage to service_role;
grant all privileges on table public.coach_request_log to service_role;
grant usage, select on sequence public.coach_request_log_id_seq to service_role;

-- Atomically reserve a checkout. The advisory lock makes active-subscription,
-- duplicate-session, and rate-limit checks one serialized operation per user.
drop function if exists public.begin_dodo_checkout(uuid);
create or replace function public.begin_dodo_checkout(p_user_id uuid, p_product_id text)
returns table(outcome text, attempt_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempt_id uuid;
begin
  if p_product_id is null or p_product_id !~ '^pdt_[A-Za-z0-9_-]+$' then
    raise exception 'invalid product id';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 90210));

  update public.billing_checkout_attempts
     set status = 'expired', updated_at = now()
   where user_id = p_user_id
     and status in ('creating', 'pending')
     and expires_at <= now();

  if exists (
    select 1
      from public.subscriptions s
     where s.user_id = p_user_id
       and s.plan = 'pro'
       and (
         (s.provider = 'admin' and s.status = 'active')
         or
         (s.provider = 'dodo' and (
           (s.status = 'active' and s.current_period_end > now())
           or (s.status = 'past_due' and s.past_due_ends_at > now())
           or (s.status in ('cancelled', 'canceled') and s.cancel_at_period_end and s.current_period_end > now())
           or (s.status = 'pending' and s.updated_at > now() - interval '30 minutes')
         ))
       )
  ) then
    return query select 'active_subscription'::text, null::uuid;
    return;
  end if;

  select id into v_attempt_id
    from public.billing_checkout_attempts
   where user_id = p_user_id and status in ('creating', 'pending')
   order by created_at desc
   limit 1;
  if v_attempt_id is not null then
    return query select 'checkout_pending'::text, v_attempt_id;
    return;
  end if;

  if (
    select count(*) from public.billing_checkout_attempts
     where user_id = p_user_id
       and created_at > now() - interval '15 minutes'
  ) >= 5 then
    return query select 'rate_limited'::text, null::uuid;
    return;
  end if;

  insert into public.billing_checkout_attempts(user_id, provider_product_id)
  values (p_user_id, p_product_id)
  returning id into v_attempt_id;

  return query select 'created'::text, v_attempt_id;
end;
$$;

-- Claims and applies a subscription-related webhook in one transaction. A thrown
-- error rolls back both the event claim and entitlement update, allowing Dodo's
-- retry to process it later. Event timestamps prevent stale delivery from
-- regressing newer state.
create or replace function public.process_dodo_subscription_event(
  p_webhook_id text,
  p_event_type text,
  p_event_timestamp timestamptz,
  p_payload_sha256 text,
  p_user_id uuid,
  p_provider_customer_id text,
  p_provider_subscription_id text,
  p_provider_product_id text,
  p_status text,
  p_current_period_start timestamptz,
  p_current_period_end timestamptz,
  p_past_due_ends_at timestamptz,
  p_cancel_at_period_end boolean,
  p_expected_product_id text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inserted integer;
  v_mapped_user_id uuid;
  v_customer_matches integer;
  v_existing public.subscriptions%rowtype;
begin
  if p_webhook_id is null or length(p_webhook_id) > 255 then
    raise exception 'invalid webhook id';
  end if;
  if p_payload_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid payload hash';
  end if;
  if p_status not in ('pending', 'active', 'past_due', 'on_hold', 'paused', 'cancelled', 'failed', 'expired', 'revoked') then
    raise exception 'invalid subscription status';
  end if;

  insert into public.dodo_webhook_events(
    webhook_id, event_type, event_timestamp, payload_sha256,
    provider_subscription_id, user_id
  ) values (
    p_webhook_id, p_event_type, p_event_timestamp, p_payload_sha256,
    p_provider_subscription_id, null
  ) on conflict (webhook_id) do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then
    return 'duplicate';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_provider_subscription_id, 90211));

  select user_id into v_mapped_user_id
    from public.subscriptions
   where provider = 'dodo'
     and provider_subscription_id = p_provider_subscription_id;

  if v_mapped_user_id is not null then
    if p_user_id is not null and p_user_id <> v_mapped_user_id then
      update public.dodo_webhook_events
         set processing_status = 'quarantined', diagnostic_code = 'subscription_identity_mismatch', processed_at = now()
       where webhook_id = p_webhook_id;
      return 'quarantined';
    end if;
    p_user_id := v_mapped_user_id;
  end if;

  -- A Dodo customer belongs to exactly one application account. Check this even
  -- when signed metadata supplied a user so inconsistent provider metadata can
  -- never move a portal/customer identity onto a different account.
  select count(distinct user_id), min(user_id::text)::uuid
    into v_customer_matches, v_mapped_user_id
    from public.subscriptions
   where provider = 'dodo'
     and provider_customer_id = p_provider_customer_id;
  if v_customer_matches > 1 then
    update public.dodo_webhook_events
       set processing_status = 'quarantined', diagnostic_code = 'ambiguous_customer', processed_at = now()
     where webhook_id = p_webhook_id;
    return 'quarantined';
  elsif v_customer_matches = 1 then
    if p_user_id is not null and p_user_id <> v_mapped_user_id then
      update public.dodo_webhook_events
         set processing_status = 'quarantined', diagnostic_code = 'customer_identity_mismatch', processed_at = now()
       where webhook_id = p_webhook_id;
      return 'quarantined';
    end if;
    p_user_id := v_mapped_user_id;
  end if;

  if p_provider_product_id <> p_expected_product_id then
    update public.dodo_webhook_events
       set processing_status = 'quarantined', diagnostic_code = 'unexpected_product', processed_at = now()
     where webhook_id = p_webhook_id;
    return 'quarantined';
  end if;

  if p_user_id is null or not exists (select 1 from auth.users where id = p_user_id) then
    update public.dodo_webhook_events
       set processing_status = 'quarantined', diagnostic_code = 'unmatched_user', processed_at = now()
     where webhook_id = p_webhook_id;
    return 'quarantined';
  end if;

  -- Serialize replacement checks with checkout/admin mutations for this user.
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 90210));
  select * into v_existing from public.subscriptions where user_id = p_user_id for update;

  if found and v_existing.provider = 'dodo'
     and v_existing.provider_event_at is not null
     and p_event_timestamp < v_existing.provider_event_at then
    update public.dodo_webhook_events
       set user_id = p_user_id, processing_status = 'ignored_stale', diagnostic_code = 'older_event', processed_at = now()
     where webhook_id = p_webhook_id;
    return 'ignored_stale';
  end if;

  -- A second concurrently purchased subscription must not replace a currently
  -- entitling one. It is retained in the quarantine log for operator review.
  if found
     and coalesce(v_existing.provider_subscription_id, '') <> p_provider_subscription_id
     and (
       (v_existing.provider = 'admin' and v_existing.plan = 'pro' and v_existing.status = 'active')
       or
       (v_existing.provider = 'dodo' and v_existing.plan = 'pro' and (
         (v_existing.status = 'active' and v_existing.current_period_end > now())
         or (v_existing.status = 'past_due' and v_existing.past_due_ends_at > now())
         or (v_existing.status in ('cancelled', 'canceled') and v_existing.cancel_at_period_end and v_existing.current_period_end > now())
       ))
     ) then
    update public.dodo_webhook_events
       set user_id = p_user_id, processing_status = 'quarantined', diagnostic_code = 'duplicate_active_subscription', processed_at = now()
     where webhook_id = p_webhook_id;
    return 'quarantined';
  end if;

  insert into public.subscriptions(
    user_id, plan, status, provider, provider_customer_id,
    provider_subscription_id, provider_product_id, current_period_start,
    current_period_end, past_due_ends_at, cancel_at_period_end,
    provider_event_at, last_webhook_id, updated_at
  ) values (
    p_user_id, 'pro', p_status, 'dodo', p_provider_customer_id,
    p_provider_subscription_id, p_provider_product_id, p_current_period_start,
    p_current_period_end, p_past_due_ends_at, coalesce(p_cancel_at_period_end, false),
    p_event_timestamp, p_webhook_id, now()
  )
  on conflict (user_id) do update set
    plan = excluded.plan,
    status = excluded.status,
    provider = excluded.provider,
    provider_customer_id = excluded.provider_customer_id,
    provider_subscription_id = excluded.provider_subscription_id,
    provider_product_id = excluded.provider_product_id,
    current_period_start = excluded.current_period_start,
    current_period_end = excluded.current_period_end,
    past_due_ends_at = excluded.past_due_ends_at,
    cancel_at_period_end = excluded.cancel_at_period_end,
    provider_event_at = excluded.provider_event_at,
    last_webhook_id = excluded.last_webhook_id,
    updated_at = now();

  if p_status in ('active', 'past_due') then
    update public.billing_checkout_attempts
       set status = 'completed', updated_at = now()
     where user_id = p_user_id and status in ('creating', 'pending');
  end if;

  update public.dodo_webhook_events
     set user_id = p_user_id, processing_status = 'processed', processed_at = now()
   where webhook_id = p_webhook_id;
  return 'processed';
end;
$$;

-- Records a verified event that does not mutate subscription state (for example,
-- a one-time payment or failed refund). This still gives webhook-id idempotency.
create or replace function public.record_dodo_webhook_event(
  p_webhook_id text,
  p_event_type text,
  p_event_timestamp timestamptz,
  p_payload_sha256 text,
  p_provider_subscription_id text default null,
  p_user_id uuid default null,
  p_processing_status text default 'ignored',
  p_diagnostic_code text default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inserted integer;
  v_safe_user_id uuid;
begin
  if p_processing_status not in ('processed', 'ignored', 'quarantined') then
    raise exception 'invalid event processing status';
  end if;

  if p_user_id is not null and exists (select 1 from auth.users where id = p_user_id) then
    v_safe_user_id := p_user_id;
  end if;

  insert into public.dodo_webhook_events(
    webhook_id, event_type, event_timestamp, payload_sha256,
    provider_subscription_id, user_id, processing_status,
    diagnostic_code, processed_at
  ) values (
    p_webhook_id, p_event_type, p_event_timestamp, p_payload_sha256,
    p_provider_subscription_id, v_safe_user_id, p_processing_status,
    p_diagnostic_code, now()
  ) on conflict (webhook_id) do nothing;
  get diagnostics v_inserted = row_count;
  return case when v_inserted = 0 then 'duplicate' else p_processing_status end;
end;
$$;

-- Atomic, concurrency-safe quota consume for both Free and Pro accounts.
create or replace function public.try_consume_coach_quota(p_user_id uuid, p_limit integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_messages_used integer;
begin
  if p_limit < 1 or p_limit > 10000 then
    raise exception 'invalid coach quota limit';
  end if;

  insert into public.coach_daily_usage(user_id, usage_date, messages_used, updated_at)
  values (p_user_id, (timezone('utc', now()))::date, 1, now())
  on conflict (user_id, usage_date) do update
     set messages_used = public.coach_daily_usage.messages_used + 1,
         updated_at = now()
   where public.coach_daily_usage.messages_used < p_limit
  returning messages_used into v_messages_used;

  return v_messages_used is not null;
end;
$$;

revoke all on function public.begin_dodo_checkout(uuid, text) from public, anon, authenticated;
revoke all on function public.process_dodo_subscription_event(
  text, text, timestamptz, text, uuid, text, text, text, text,
  timestamptz, timestamptz, timestamptz, boolean, text
) from public, anon, authenticated;
revoke all on function public.record_dodo_webhook_event(
  text, text, timestamptz, text, text, uuid, text, text
) from public, anon, authenticated;
revoke all on function public.try_consume_coach_quota(uuid, integer) from public, anon, authenticated;

grant execute on function public.begin_dodo_checkout(uuid, text) to service_role;
grant execute on function public.process_dodo_subscription_event(
  text, text, timestamptz, text, uuid, text, text, text, text,
  timestamptz, timestamptz, timestamptz, boolean, text
) to service_role;
grant execute on function public.record_dodo_webhook_event(
  text, text, timestamptz, text, text, uuid, text, text
) to service_role;
grant execute on function public.try_consume_coach_quota(uuid, integer) to service_role;

comment on table public.subscriptions is
  'Server-managed billing entitlement state. Dodo rows are written only by verified webhook processing.';
comment on table public.dodo_webhook_events is
  'Sanitized, idempotent Dodo webhook receipt log; raw payment payloads are intentionally not retained.';
comment on function public.process_dodo_subscription_event is
  'Atomically claims an ordered Dodo event and updates one user subscription entitlement.';
