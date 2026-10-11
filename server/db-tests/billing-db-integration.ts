/**
 * Opt-in integration harness for the Dodo billing state machine.
 *
 * The unit tests in `server/billing.test.ts` only inspect pure functions and
 * source text — they cannot prove that the SQL security-definer RPCs enforce
 * ordering, idempotency, quarantine, and quota limits. This harness closes that
 * gap: it boots a throwaway PostgreSQL cluster, applies `supabase/schema.sql`
 * followed by every migration in timestamp order (exactly like a real project),
 * then drives the same RPCs the Express webhook handler calls and re-checks the
 * resulting rows with the real `deriveEntitlement` policy from `../billing.ts`.
 *
 * It is intentionally NOT part of `npm test` / `vitest run`, because it needs
 * its own dependencies and a local PostgreSQL binary:
 *
 *   cd server/db-tests && npm install
 *   cd ../.. && npm run test:billing-db
 *
 * Optional environment variables:
 *   PG_TEST_PORT   TCP port for the throwaway cluster (default 55441)
 *   PG_TEST_KEEP=1 keep the data directory for inspection
 *
 * Nothing here contacts Dodo or Supabase. No credentials are used.
 */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import EmbeddedPostgres from 'embedded-postgres';
import pg from 'pg';
import type { PoolClient } from 'pg';

// Supabase (PostgREST) returns timestamptz columns as ISO-8601 strings, not as
// JavaScript Date objects. Match that so `deriveEntitlement` sees production's
// value shape instead of pg's default parser output.
pg.types.setTypeParser(1184, (value: string) => new Date(value).toISOString());
pg.types.setTypeParser(1114, (value: string) => new Date(`${value.replace(' ', 'T')}Z`).toISOString());
import { deriveEntitlement, type StoredSubscription } from '../billing.js';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..', '..');

const PRODUCT_ID = 'pdt_test_pro_monthly';
const OTHER_PRODUCT_ID = 'pdt_test_wrong_product';
const FREE_DAILY_LIMIT = 3;
const PRO_DAILY_LIMIT = 100;

const USER_A = '11111111-1111-4111-8111-111111111111';
const USER_B = '22222222-2222-4222-8222-222222222222';
const USER_C = '33333333-3333-4333-8333-333333333333';
const USER_D = '44444444-4444-4444-8444-444444444444';
const USER_E = '55555555-5555-4555-8555-555555555555';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const NOW = new Date();
const at = (offsetMs: number) => new Date(NOW.getTime() + offsetMs);

const results: Array<{ name: string; ok: boolean; detail: string }> = [];
let webhookSeq = 0;

function check(name: string, ok: boolean, detail = ''): void {
  results.push({ name, ok, detail });
  const status = ok ? 'PASS' : 'FAIL';
  console.log(`${status}  ${name}${detail ? ` — ${detail}` : ''}`);
}

function section(title: string): void {
  console.log(`\n--- ${title} ---`);
}

/**
 * Minimal stand-ins for the parts of Supabase that the migrations reference:
 * the `auth` schema, `auth.users`, `auth.uid()`, and the three request roles.
 * Row-level-security row filtering is not reproduced (auth.uid() is a stub);
 * privilege grants are still enforced by PostgreSQL itself.
 */
const SUPABASE_STUBS = `
do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated', 'service_role'] loop
    if not exists (select 1 from pg_roles where rolname = r) then
      execute format('create role %I nologin', r);
    end if;
  end loop;
end $$;

create schema if not exists auth;
create table if not exists auth.users (
  id uuid primary key,
  email text,
  email_confirmed_at timestamptz
);
create or replace function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
`;

async function main(): Promise<void> {
  const port = Number(process.env.PG_TEST_PORT ?? 55441);
  const databaseDir = join('/tmp', `datings-billing-db-${process.pid}`);
  const cluster = new EmbeddedPostgres({
    databaseDir,
    user: 'postgres',
    password: 'postgres',
    port,
    persistent: process.env.PG_TEST_KEEP === '1',
  });

  await cluster.initialise();
  await cluster.start();
  await cluster.createDatabase('datings_test');
  const client: PoolClient = cluster.getPgClient('datings_test') as unknown as PoolClient;
  await client.connect();

  const q = async (text: string, params?: unknown[]) => client.query(text, params as never);
  const rows = async <T>(text: string, params?: unknown[]): Promise<T[]> =>
    (await q(text, params)).rows as T[];
  const first = async <T>(text: string, params?: unknown[]): Promise<T | undefined> =>
    (await rows<T>(text, params))[0];

  const version = await first<{ server_version: string }>('show server_version');
  console.log(`PostgreSQL ${version?.server_version} (throwaway cluster on :${port})`);

  try {
    await run(client, q, rows, first);
  } finally {
    await client.end();
    await cluster.stop();
    const failed = results.filter((r) => !r.ok).length;
    console.log(
      `\n${results.length - failed}/${results.length} checks passed` +
        (failed ? ` — ${failed} FAILED` : ''),
    );
    if (failed) process.exitCode = 1;
    if (process.env.PG_TEST_KEEP === '1') {
      console.log(`cluster kept at ${databaseDir} (port ${port})`);
    }
  }
}

async function run(
  client: PoolClient,
  q: (text: string, params?: unknown[]) => Promise<{ rows: unknown[] }>,
  rows: <T>(text: string, params?: unknown[]) => Promise<T[]>,
  first: <T>(text: string, params?: unknown[]) => Promise<T | undefined>,
): Promise<void> {
  // ---------------------------------------------------------------- schema ---
  section('migrations apply on top of the existing project schema');
  await client.query('begin');
  await client.query(SUPABASE_STUBS);
  await client.query(
    ...([
      // Seed one existing user before migrations, as a live project would.
      'insert into auth.users(id, email, email_confirmed_at) values' +
        [USER_A, USER_B, USER_C, USER_D, USER_E]
          .map((id) => `('${id}', '${id.slice(0, 8)}@example.test', now())`)
          .join(', '),
    ] as [string]),
  );
  await client.query('commit');

  const sqlFiles = [
    resolve(root, 'supabase/schema.sql'),
    ...readdirSync(resolve(root, 'supabase/migrations'))
      .filter((name) => name.endsWith('.sql'))
      .sort()
      .map((name) => resolve(root, 'supabase/migrations', name)),
  ];
  for (const file of sqlFiles) {
    await client.query(readFileSync(file, 'utf8'));
    console.log(`applied ${file.replace(`${root}/`, '')}`);
  }

  const tables = await rows<{ name: string }>(
    `select to_regclass('public.subscriptions')::text as name
     union all select to_regclass('public.dodo_webhook_events')::text
     union all select to_regclass('public.billing_checkout_attempts')::text
     union all select to_regclass('public.coach_daily_usage')::text
     union all select to_regclass('public.coach_request_log')::text`,
  );
  check(
    'billing tables exist after migrating',
    tables.every((row) => typeof row.name === 'string' && row.name.length > 0),
    tables.map((row) => row.name).join(', '),
  );

  const fns = await rows<{ proname: string }>(
    `select proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname in
        ('begin_dodo_checkout', 'process_dodo_subscription_event',
         'record_dodo_webhook_event', 'try_consume_coach_quota')
      order by proname`,
  );
  check('all four billing RPCs exist', fns.length === 4, fns.map((f) => f.proname).join(', '));

  // ------------------------------------------------------------- helpers -----
  let attemptCreation = 0;
  const beginCheckout = async (userId: string, productId = PRODUCT_ID) =>
    first<{ outcome: string; attempt_id: string | null }>(
      'select outcome, attempt_id from public.begin_dodo_checkout($1::uuid, $2::text)',
      [userId, productId],
    );

  const payloadHash = (payload: unknown) =>
    createHash('sha256').update(JSON.stringify(payload)).digest('hex');

  const webhookId = (label: string) => `msg_test_${label}_${++webhookSeq}`;

  interface SnapshotOptions {
    type: string;
    subscriptionId: string;
    userId?: string | null;
    customerId?: string;
    productId?: string;
    status: string;
    eventAt?: Date;
    periodStart?: Date | null;
    periodEnd?: Date | null;
    pastDueEndsAt?: Date | null;
    cancelAtPeriodEnd?: boolean;
  }

  /** Mirrors `applyVerifiedSubscriptionSnapshot()` in server.ts. */
  const sendSubscriptionEvent = async (options: SnapshotOptions) => {
    const id = webhookId(options.type);
    const hash = payloadHash(options);
    const row = await first<{ process_dodo_subscription_event: string }>(
      `select public.process_dodo_subscription_event(
         $1::text, $2::text, $3::timestamptz, $4::text, $5::uuid, $6::text, $7::text, $8::text,
         $9::text, $10::timestamptz, $11::timestamptz, $12::timestamptz, $13::boolean, $14::text)`,
      [
        id,
        options.type,
        (options.eventAt ?? new Date()).toISOString(),
        hash,
        options.userId ?? null,
        options.customerId ?? 'cus_test_a',
        options.subscriptionId,
        options.productId ?? PRODUCT_ID,
        options.status,
        options.periodStart?.toISOString() ?? null,
        options.periodEnd?.toISOString() ?? null,
        options.pastDueEndsAt?.toISOString() ?? null,
        options.cancelAtPeriodEnd ?? false,
        PRODUCT_ID,
      ],
    );
    return { webhookId: id, outcome: row?.process_dodo_subscription_event ?? 'error' };
  };

  const entitlementFor = async (userId: string) => {
    const row = await first<StoredSubscription>(
      `select user_id, plan, status, provider, provider_customer_id, provider_subscription_id,
              provider_product_id, current_period_start, current_period_end, past_due_ends_at,
              cancel_at_period_end
         from public.subscriptions where user_id = $1`,
      [userId],
    );
    return deriveEntitlement(row ?? null, FREE_DAILY_LIMIT, PRO_DAILY_LIMIT, new Date(), PRODUCT_ID);
  };

  const subscriptionRow = (userId: string) =>
    first<StoredSubscription>(
      'select * from public.subscriptions where user_id = $1',
      [userId],
    );

  const eventStatus = (id: string) =>
    first<{ processing_status: string; diagnostic_code: string | null; user_id: string | null }>(
      'select processing_status, diagnostic_code, user_id from public.dodo_webhook_events where webhook_id = $1',
      [id],
    );

  // -------------------------------------------------------- checkout claim ---
  section('checkout claim: one durable reservation per account');
  attemptCreation += 1;
  const claim = await beginCheckout(USER_A);
  check('first checkout is created', claim?.outcome === 'created', `outcome=${claim?.outcome}`);

  const secondClaim = await beginCheckout(USER_A);
  check(
    'second checkout reuses the open reservation',
    secondClaim?.outcome === 'checkout_pending' && secondClaim.attempt_id === claim?.attempt_id,
    `outcome=${secondClaim?.outcome} sameAttempt=${secondClaim?.attempt_id === claim?.attempt_id}`,
  );

  const openAttempts = await first<{ count: string }>(
    `select count(*)::text as count from public.billing_checkout_attempts
      where user_id = $1 and status in ('creating', 'pending')`,
    [USER_A],
  );
  check('exactly one open attempt row exists', openAttempts?.count === '1', `count=${openAttempts?.count}`);

  let invalidProductRejected = false;
  try {
    await beginCheckout(USER_A, 'not-a-product');
  } catch {
    invalidProductRejected = true;
  }
  check('an invalid product id is rejected by the claim RPC', invalidProductRejected);

  // ------------------------------------------------------------- activation --
  section('activation requires a verified webhook snapshot');
  const activeEvent = await sendSubscriptionEvent({
    type: 'subscription.active',
    subscriptionId: 'sub_test_a',
    userId: USER_A,
    customerId: 'cus_test_a',
    status: 'active',
    eventAt: at(0),
    periodStart: at(0),
    periodEnd: at(30 * DAY),
  });
  check('subscription.active is processed', activeEvent.outcome === 'processed', activeEvent.outcome);

  const afterActivation = await entitlementFor(USER_A);
  check(
    'Pro entitlement comes from the persisted row',
    afterActivation.isPro && afterActivation.plan === 'pro' && afterActivation.dailyLimit === PRO_DAILY_LIMIT,
    `plan=${afterActivation.plan} dailyLimit=${afterActivation.dailyLimit}`,
  );
  check(
    'renewal date is exposed only for an active, non-cancelling period',
    afterActivation.renewalDate === at(30 * DAY).toISOString(),
    `renewalDate=${afterActivation.renewalDate}`,
  );

  const completedAttempt = await first<{ status: string }>(
    'select status from public.billing_checkout_attempts where id = $1',
    [claim?.attempt_id],
  );
  check('activation closes the open checkout attempt', completedAttempt?.status === 'completed', completedAttempt?.status);

  const recordedEvent = await eventStatus(activeEvent.webhookId);
  check(
    'the event log stores the verified user and status',
    recordedEvent?.processing_status === 'processed' && recordedEvent.user_id === USER_A,
    `status=${recordedEvent?.processing_status}`,
  );

  // ------------------------------------------------------------ idempotency --
  section('duplicate deliveries are idempotent');
  const replay = await first<{ process_dodo_subscription_event: string }>(
    `select public.process_dodo_subscription_event(
       $1::text, $2::text, $3::timestamptz, $4::text, $5::uuid, $6::text, $7::text, $8::text,
       $9::text, $10::timestamptz, $11::timestamptz, $12::timestamptz, $13::boolean, $14::text)`,
    [
      activeEvent.webhookId,
      'subscription.active',
      at(0).toISOString(),
      payloadHash({ replay: true }),
      USER_A,
      'cus_test_a',
      'sub_test_a',
      PRODUCT_ID,
      'active',
      at(0).toISOString(),
      at(30 * DAY).toISOString(),
      null,
      false,
      PRODUCT_ID,
    ],
  );
  check(
    'same webhook id is reported as duplicate',
    replay?.process_dodo_subscription_event === 'duplicate',
    `outcome=${replay?.process_dodo_subscription_event}`,
  );

  const redelivery = await sendSubscriptionEvent({
    type: 'subscription.active',
    subscriptionId: 'sub_test_a',
    userId: USER_A,
    customerId: 'cus_test_a',
    status: 'active',
    eventAt: at(0),
    periodStart: at(0),
    periodEnd: at(30 * DAY),
  });
  check('a provider retry with a new id still resolves to one row', redelivery.outcome === 'processed');

  const subscriptionCount = await first<{ count: string; distinct: string }>(
    `select count(*)::text as count, count(distinct provider_subscription_id)::text as distinct
       from public.subscriptions where provider = 'dodo' and provider_subscription_id = 'sub_test_a'`,
  );
  check(
    'no duplicate subscription rows are created',
    subscriptionCount?.count === '1' && subscriptionCount.distinct === '1',
    `rows=${subscriptionCount?.count}`,
  );

  // ---------------------------------------------------------- event ordering --
  section('stale deliveries cannot regress newer state');
  const onHold = await sendSubscriptionEvent({
    type: 'subscription.on_hold',
    subscriptionId: 'sub_test_a',
    userId: USER_A,
    customerId: 'cus_test_a',
    status: 'on_hold',
    eventAt: at(1 * HOUR),
    periodStart: at(0),
    periodEnd: at(30 * DAY),
  });
  check('on_hold revokes access', onHold.outcome === 'processed' && !(await entitlementFor(USER_A)).isPro);

  const lateActive = await sendSubscriptionEvent({
    type: 'subscription.active',
    subscriptionId: 'sub_test_a',
    userId: USER_A,
    customerId: 'cus_test_a',
    status: 'active',
    eventAt: at(-2 * HOUR),
    periodStart: at(-2 * HOUR),
    periodEnd: at(28 * DAY),
  });
  const lateRow = await eventStatus(lateActive.webhookId);
  check(
    'an older delivery is recorded as ignored_stale',
    lateActive.outcome === 'ignored_stale' && lateRow?.diagnostic_code === 'older_event',
    `outcome=${lateActive.outcome} diagnostic=${lateRow?.diagnostic_code}`,
  );
  check('the late event did not restore access', !(await entitlementFor(USER_A)).isPro);

  // ----------------------------------------------------------- grace period --
  section('past_due grace period uses Dodo\u2019s signed deadline');
  const graceDeadline = at(4 * DAY);
  const pastDue = await sendSubscriptionEvent({
    type: 'subscription.past_due',
    subscriptionId: 'sub_test_a',
    userId: USER_A,
    customerId: 'cus_test_a',
    status: 'past_due',
    eventAt: at(2 * HOUR),
    periodStart: at(0),
    periodEnd: at(30 * DAY),
    pastDueEndsAt: graceDeadline,
  });
  check('subscription.past_due is processed', pastDue.outcome === 'processed', pastDue.outcome);

  const pastDueEntitlement = await entitlementFor(USER_A);
  check(
    'grace keeps Pro access and exposes the deadline',
    pastDueEntitlement.isPro && pastDueEntitlement.accessEndsAt === graceDeadline.toISOString(),
    `isPro=${pastDueEntitlement.isPro} accessEndsAt=${pastDueEntitlement.accessEndsAt}`,
  );

  // Dodo's REST subscription model does NOT return past_due_ends_at; only the
  // webhook payload carries it. The server re-reads the subscription for
  // payment.* events, so this snapshot must leave the stored deadline intact.
  const renewalFailure = await sendSubscriptionEvent({
    type: 'payment.failed',
    subscriptionId: 'sub_test_a',
    userId: USER_A,
    customerId: 'cus_test_a',
    status: 'past_due',
    eventAt: at(3 * HOUR),
    periodStart: at(0),
    periodEnd: at(30 * DAY),
    pastDueEndsAt: null,
  });
  check('payment.failed re-read is processed', renewalFailure.outcome === 'processed', renewalFailure.outcome);

  const rowAfterReread = await subscriptionRow(USER_A);
  check(
    'a snapshot without the deadline preserves the signed deadline',
    rowAfterReread?.past_due_ends_at === graceDeadline.toISOString(),
    `stored=${rowAfterReread?.past_due_ends_at ?? 'null'}`,
  );
  check(
    'Pro access survives the re-read inside the grace window',
    (await entitlementFor(USER_A)).isPro,
  );

  const graceOver = await sendSubscriptionEvent({
    type: 'subscription.on_hold',
    subscriptionId: 'sub_test_a',
    userId: USER_A,
    customerId: 'cus_test_a',
    status: 'on_hold',
    eventAt: at(4 * HOUR),
    periodStart: at(0),
    periodEnd: at(30 * DAY),
  });
  check(
    'on_hold after the grace window revokes access',
    graceOver.outcome === 'processed' && !(await entitlementFor(USER_A)).isPro,
  );

  const recovered = await sendSubscriptionEvent({
    type: 'subscription.active',
    subscriptionId: 'sub_test_a',
    userId: USER_A,
    customerId: 'cus_test_a',
    status: 'active',
    eventAt: at(5 * HOUR),
    periodStart: at(5 * HOUR),
    periodEnd: at(30 * DAY),
  });
  check(
    'a settled renewal restores access',
    recovered.outcome === 'processed' && (await entitlementFor(USER_A)).isPro,
  );

  // ----------------------------------------------------------- cancellations --
  section('scheduled cancellation keeps access until the paid-through date');
  const userBActive = await sendSubscriptionEvent({
    type: 'subscription.active',
    subscriptionId: 'sub_test_b',
    userId: USER_B,
    customerId: 'cus_test_b',
    status: 'active',
    eventAt: at(0),
    periodStart: at(0),
    periodEnd: at(20 * DAY),
  });
  check('second subscriber activates independently', userBActive.outcome === 'processed');

  const scheduledCancel = await sendSubscriptionEvent({
    type: 'subscription.cancelled',
    subscriptionId: 'sub_test_b',
    userId: USER_B,
    customerId: 'cus_test_b',
    status: 'cancelled',
    eventAt: at(1 * HOUR),
    periodStart: at(0),
    periodEnd: at(20 * DAY),
    cancelAtPeriodEnd: true,
  });
  const cancelledEntitlement = await entitlementFor(USER_B);
  check('cancellation is processed', scheduledCancel.outcome === 'processed');
  check(
    'access remains until the period end and the end date is surfaced',
    cancelledEntitlement.isPro && cancelledEntitlement.accessEndsAt === at(20 * DAY).toISOString(),
    `isPro=${cancelledEntitlement.isPro} accessEndsAt=${cancelledEntitlement.accessEndsAt}`,
  );
  check(
    'no renewal is advertised after cancellation',
    cancelledEntitlement.renewalDate === null && cancelledEntitlement.cancelAtPeriodEnd,
  );

  const afterPeriod = await sendSubscriptionEvent({
    type: 'subscription.cancelled',
    subscriptionId: 'sub_test_b',
    userId: USER_B,
    customerId: 'cus_test_b',
    status: 'cancelled',
    eventAt: at(2 * HOUR),
    periodStart: at(-30 * DAY),
    periodEnd: at(-1 * HOUR),
    cancelAtPeriodEnd: true,
  });
  check(
    'access ends once the paid-through date passes',
    afterPeriod.outcome === 'processed' && !(await entitlementFor(USER_B)).isPro,
  );

  // ------------------------------------------------------------- quarantine --
  section('untrusted or conflicting identities are quarantined');
  const unmatched = await sendSubscriptionEvent({
    type: 'subscription.active',
    subscriptionId: 'sub_test_orphan',
    userId: null,
    customerId: 'cus_test_orphan',
    status: 'active',
    eventAt: at(0),
    periodStart: at(0),
    periodEnd: at(30 * DAY),
  });
  const unmatchedRow = await eventStatus(unmatched.webhookId);
  check(
    'a subscription with no verified user mapping is quarantined',
    unmatched.outcome === 'quarantined' && unmatchedRow?.diagnostic_code === 'unmatched_user',
    `outcome=${unmatched.outcome} diagnostic=${unmatchedRow?.diagnostic_code}`,
  );

  const wrongProduct = await sendSubscriptionEvent({
    type: 'subscription.active',
    subscriptionId: 'sub_test_a',
    userId: USER_A,
    customerId: 'cus_test_a',
    productId: OTHER_PRODUCT_ID,
    status: 'active',
    eventAt: at(6 * HOUR),
    periodStart: at(6 * HOUR),
    periodEnd: at(30 * DAY),
  });
  const wrongProductRow = await eventStatus(wrongProduct.webhookId);
  check(
    'a different product is quarantined and changes nothing',
    wrongProduct.outcome === 'quarantined' &&
      wrongProductRow?.diagnostic_code === 'unexpected_product' &&
      (await subscriptionRow(USER_A))?.provider_product_id === PRODUCT_ID,
    `outcome=${wrongProduct.outcome} diagnostic=${wrongProductRow?.diagnostic_code}`,
  );

  const identityConflict = await sendSubscriptionEvent({
    type: 'subscription.updated',
    subscriptionId: 'sub_test_a',
    userId: USER_B,
    customerId: 'cus_test_a',
    status: 'active',
    eventAt: at(7 * HOUR),
    periodStart: at(7 * HOUR),
    periodEnd: at(30 * DAY),
  });
  const identityRow = await eventStatus(identityConflict.webhookId);
  check(
    'metadata cannot move an existing subscription to another account',
    identityConflict.outcome === 'quarantined' &&
      identityRow?.diagnostic_code === 'subscription_identity_mismatch',
    `outcome=${identityConflict.outcome} diagnostic=${identityRow?.diagnostic_code}`,
  );

  const customerConflict = await sendSubscriptionEvent({
    type: 'subscription.active',
    subscriptionId: 'sub_test_conflict',
    userId: USER_B,
    customerId: 'cus_test_a',
    status: 'active',
    eventAt: at(8 * HOUR),
    periodStart: at(8 * HOUR),
    periodEnd: at(30 * DAY),
  });
  const customerRow = await eventStatus(customerConflict.webhookId);
  check(
    'a reused Dodo customer cannot be attached to another account',
    customerConflict.outcome === 'quarantined' && customerRow?.diagnostic_code === 'customer_identity_mismatch',
    `outcome=${customerConflict.outcome} diagnostic=${customerRow?.diagnostic_code}`,
  );

  section('a second subscription never replaces an entitling one');
  const userCActive = await sendSubscriptionEvent({
    type: 'subscription.active',
    subscriptionId: 'sub_test_c1',
    userId: USER_C,
    customerId: 'cus_test_c',
    status: 'active',
    eventAt: at(0),
    periodStart: at(0),
    periodEnd: at(30 * DAY),
  });
  check('first subscription activates', userCActive.outcome === 'processed');

  const userCSecond = await sendSubscriptionEvent({
    type: 'subscription.active',
    subscriptionId: 'sub_test_c2',
    userId: USER_C,
    customerId: 'cus_test_c2',
    status: 'active',
    eventAt: at(1 * HOUR),
    periodStart: at(1 * HOUR),
    periodEnd: at(31 * DAY),
  });
  const userCSecondRow = await eventStatus(userCSecond.webhookId);
  check(
    'a second concurrent subscription is quarantined',
    userCSecond.outcome === 'quarantined' &&
      userCSecondRow?.diagnostic_code === 'duplicate_active_subscription' &&
      (await subscriptionRow(USER_C))?.provider_subscription_id === 'sub_test_c1',
    `outcome=${userCSecond.outcome} diagnostic=${userCSecondRow?.diagnostic_code}`,
  );

  await q(
    `insert into public.subscriptions(user_id, plan, status, provider, current_period_end)
     values ($1, 'pro', 'active', 'admin', now() + interval '30 days')
     on conflict (user_id) do nothing`,
    [USER_D],
  );
  const adminClash = await sendSubscriptionEvent({
    type: 'subscription.active',
    subscriptionId: 'sub_test_d',
    userId: USER_D,
    customerId: 'cus_test_d',
    status: 'active',
    eventAt: at(0),
    periodStart: at(0),
    periodEnd: at(30 * DAY),
  });
  const adminClashRow = await eventStatus(adminClash.webhookId);
  check(
    'a manual admin grant is never overwritten by a Dodo webhook',
    adminClash.outcome === 'quarantined' && adminClashRow?.diagnostic_code === 'duplicate_active_subscription',
    `outcome=${adminClash.outcome} diagnostic=${adminClashRow?.diagnostic_code}`,
  );
  const adminRow = await subscriptionRow(USER_D);
  check(
    'the admin entitlement row is untouched',
    adminRow?.provider === 'admin' && (await entitlementFor(USER_D)).isPro,
  );

  // -------------------------------------------------------------- revocation --
  section('full refunds and open disputes revoke through the override path');
  const revoked = await first<{ process_dodo_subscription_event: string }>(
    `select public.process_dodo_subscription_event(
       $1::text, $2::text, $3::timestamptz, $4::text, $5::uuid, $6::text, $7::text, $8::text,
       $9::text, $10::timestamptz, $11::timestamptz, $12::timestamptz, $13::boolean, $14::text)`,
    [
      webhookId('refund.succeeded'),
      'refund.succeeded',
      at(9 * HOUR).toISOString(),
      payloadHash({ refund: 'full' }),
      USER_A,
      'cus_test_a',
      'sub_test_a',
      PRODUCT_ID,
      'revoked',
      at(5 * HOUR).toISOString(),
      at(30 * DAY).toISOString(),
      null,
      false,
      PRODUCT_ID,
    ],
  );
  check(
    'the refund override is processed',
    revoked?.process_dodo_subscription_event === 'processed',
    `outcome=${revoked?.process_dodo_subscription_event}`,
  );
  check('a revoked subscription loses Pro immediately', !(await entitlementFor(USER_A)).isPro);

  const restored = await sendSubscriptionEvent({
    type: 'subscription.active',
    subscriptionId: 'sub_test_a',
    userId: USER_A,
    customerId: 'cus_test_a',
    status: 'active',
    eventAt: at(10 * HOUR),
    periodStart: at(10 * HOUR),
    periodEnd: at(40 * DAY),
  });
  check('a later verified activation can restore access', restored.outcome === 'processed' && (await entitlementFor(USER_A)).isPro);

  // ------------------------------------------------------- backend quotas ----
  section('coach quota is enforced atomically in the database');
  const consume = (userId: string, limit: number) =>
    first<{ try_consume_coach_quota: boolean }>(
      'select public.try_consume_coach_quota($1::uuid, $2::integer)',
      [userId, limit],
    );

  const freeConsume: boolean[] = [];
  for (let i = 0; i < 4; i += 1) {
    freeConsume.push(Boolean((await consume(USER_E, FREE_DAILY_LIMIT))?.try_consume_coach_quota));
  }
  check(
    'free plan is capped at 3 coach messages per UTC day',
    freeConsume.join(',') === 'true,true,true,false',
    freeConsume.join(','),
  );
  const freeUsage = await first<{ messages_used: number }>(
    'select messages_used from public.coach_daily_usage where user_id = $1',
    [USER_E],
  );
  check('the daily counter stops at the limit', freeUsage?.messages_used === FREE_DAILY_LIMIT, `used=${freeUsage?.messages_used}`);

  const concurrentUser = '66666666-6666-4666-8666-666666666666';
  await q('insert into auth.users(id, email, email_confirmed_at) values ($1, $2, now())', [
    concurrentUser,
    'concurrent@example.test',
  ]);
  const concurrent = await Promise.all(
    Array.from({ length: 10 }, () => consume(concurrentUser, FREE_DAILY_LIMIT)),
  );
  const allowed = concurrent.filter((row) => row?.try_consume_coach_quota === true).length;
  check(
    'concurrent requests cannot exceed the limit',
    allowed === FREE_DAILY_LIMIT,
    `allowed=${allowed} of 10 parallel requests`,
  );

  const proConsume = await first<{ try_consume_coach_quota: boolean }>(
    'select public.try_consume_coach_quota($1::uuid, $2::integer)',
    [USER_A, PRO_DAILY_LIMIT],
  );
  check('pro accounts get the larger server-configured ceiling', proConsume?.try_consume_coach_quota === true);

  // ------------------------------------------------------- privilege wall ----
  section('browser roles cannot read or write billing state');
  await q('set role authenticated');
  let insertDenied = false;
  try {
    await q('insert into public.subscriptions(user_id, plan, status, provider) values ($1, $2, $3, $4)', [
      USER_E,
      'pro',
      'active',
      'dodo',
    ]);
  } catch {
    insertDenied = true;
  }
  check('authenticated cannot insert a subscription', insertDenied);

  let sensitiveReadDenied = false;
  try {
    await q('select provider_customer_id from public.subscriptions');
  } catch {
    sensitiveReadDenied = true;
  }
  check('authenticated cannot read provider customer identifiers', sensitiveReadDenied);

  let quotaWriteDenied = false;
  try {
    await q('update public.coach_daily_usage set messages_used = 0');
  } catch {
    quotaWriteDenied = true;
  }
  check('authenticated cannot reset its own coach quota', quotaWriteDenied);

  let webhookLogDenied = false;
  try {
    await q('select count(*) from public.dodo_webhook_events');
  } catch {
    webhookLogDenied = true;
  }
  check('authenticated cannot read the webhook log', webhookLogDenied);
  await q('reset role');
}

await main();
