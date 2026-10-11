-- Preserve Dodo's webhook-signed grace deadline across REST re-reads.
--
-- Dodo only sends the grace-period deadline (`past_due_ends_at`) inside the
-- signed webhook payload. Its subscription REST API does not return the field at
-- all — the documented instruction is to "store it when the event arrives".
--
-- `syncDodoSubscriptionForEvent()` in server.ts re-reads the subscription from
-- the REST API for payment.*, refund.*, and dispute.* events. Those snapshots
-- therefore carry `past_due_ends_at: null`, and
-- `process_dodo_subscription_event()` writes the incoming value verbatim. The
-- result: an out-of-order `payment.failed` re-read arriving after the
-- `subscription.past_due` webhook overwrote the verified deadline with NULL and
-- revoked Pro access in the middle of the customer's grace window, even though
-- Dodo keeps their access until that signed deadline.
--
-- This migration adds a BEFORE UPDATE guard that keeps the stored deadline when
-- a Dodo snapshot does not supply a new one. It cannot invent data:
--   * it never writes a deadline that was not previously signed by Dodo,
--   * it only applies while both the old and the new row are provider='dodo',
--   * a webhook that does carry a deadline (a new grace window) still wins, and
--   * entitlement never depends on a stale deadline, because
--     `deriveEntitlement()` reads `past_due_ends_at` only while status is
--     `past_due`.
--
-- Additive and idempotent: no rows are rewritten, no columns change, and no
-- existing data is touched. Safe to apply more than once.

create or replace function public.preserve_dodo_grace_deadline()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.provider = 'dodo'
     and old.provider = 'dodo'
     and new.past_due_ends_at is null
     and old.past_due_ends_at is not null then
    new.past_due_ends_at := old.past_due_ends_at;
  end if;
  return new;
end;
$$;

drop trigger if exists subscriptions_preserve_dodo_grace_deadline on public.subscriptions;

create trigger subscriptions_preserve_dodo_grace_deadline
  before update on public.subscriptions
  for each row
  execute function public.preserve_dodo_grace_deadline();

-- Triggers execute with the privileges of the invoking role; nobody needs to
-- call this function directly.
revoke all on function public.preserve_dodo_grace_deadline() from public, anon, authenticated;

comment on function public.preserve_dodo_grace_deadline() is
  'Keeps the webhook-signed past_due_ends_at when a provider snapshot omits it, so a REST re-read cannot shorten a paid grace period.';
