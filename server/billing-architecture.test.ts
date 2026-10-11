import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const serverSource = readFileSync(resolve(root, 'server.ts'), 'utf8');
const migrationSource = readFileSync(
  resolve(root, 'supabase/migrations/20261011000000_dodo_test_billing.sql'),
  'utf8',
);
const graceMigrationName = '20261011120000_dodo_preserve_grace_deadline.sql';
const graceMigrationSource = readFileSync(
  resolve(root, 'supabase/migrations', graceMigrationName),
  'utf8',
);
const migrationNames = readdirSync(resolve(root, 'supabase/migrations'))
  .filter((name) => name.endsWith('.sql'))
  .sort();

describe('billing integration safety rails', () => {
  it('mounts the raw webhook route before the global JSON parser', () => {
    const webhookRouteIndex = serverSource.indexOf("'/api/webhooks/dodo'");
    const rawParserIndex = serverSource.indexOf("express.raw({ type: 'application/json'", webhookRouteIndex);
    const jsonParserIndex = serverSource.indexOf('app.use(express.json(');

    expect(webhookRouteIndex).toBeGreaterThan(-1);
    expect(rawParserIndex).toBeGreaterThan(webhookRouteIndex);
    expect(jsonParserIndex).toBeGreaterThan(rawParserIndex);
  });

  it('verifies all Standard Webhooks headers through the official SDK', () => {
    expect(serverSource).toContain("req.header('webhook-id')");
    expect(serverSource).toContain("req.header('webhook-signature')");
    expect(serverSource).toContain("req.header('webhook-timestamp')");
    expect(serverSource).toContain('dodo().webhooks.unwrap(rawBody');
  });

  it('accepts no browser-controlled checkout identity, product, customer, or price', () => {
    const routeStart = serverSource.indexOf("'/api/billing/checkout'");
    const routeEnd = serverSource.indexOf("'/api/billing/checkout/cancel'", routeStart);
    const route = serverSource.slice(routeStart, routeEnd);

    expect(routeStart).toBeGreaterThan(-1);
    expect(routeEnd).toBeGreaterThan(routeStart);
    expect(route).toContain('const userId = await requireAuth(req, res, true);');
    expect(route).toContain('billingConfig.productId');
    expect(route).toContain('authResult.user.email_confirmed_at');
    expect(route).toContain('Object.keys(req.body).length > 0');
    expect(route).not.toMatch(/authResult\.user\.user_metadata/);
    expect(route).not.toMatch(/req\.body\??\.(product|productId|price|customer|customerId|user|userId)/);
  });

  it('uses a durable claim and provider idempotency key before checkout creation', () => {
    const claimIndex = serverSource.indexOf("rpc('begin_dodo_checkout'");
    const createIndex = serverSource.indexOf('checkoutSessions.create(', claimIndex);
    const idempotencyIndex = serverSource.indexOf('idempotencyKey:', createIndex);

    expect(claimIndex).toBeGreaterThan(-1);
    expect(createIndex).toBeGreaterThan(claimIndex);
    expect(idempotencyIndex).toBeGreaterThan(createIndex);
  });
});

describe('billing migration invariants', () => {
  it('uses auth-user foreign keys and unique provider identities', () => {
    expect(migrationSource).toContain('references auth.users(id) on delete cascade');
    expect(migrationSource).toContain('subscriptions_provider_subscription_uidx');
    expect(migrationSource).toContain('subscriptions_provider_customer_uidx');
    expect(migrationSource).toContain('webhook_id text primary key');
    expect(migrationSource).toContain('checkout_session_id text unique');
  });

  it('allows authenticated users only a restricted own-row projection', () => {
    expect(migrationSource).toContain('revoke all on public.subscriptions from authenticated;');
    expect(migrationSource).toMatch(/grant select \([\s\S]*?\) on public\.subscriptions to authenticated;/);
    expect(migrationSource).toContain('using ((select auth.uid()) = user_id);');
    expect(migrationSource).not.toContain('grant insert on public.subscriptions to authenticated');
    expect(migrationSource).not.toContain('grant update on public.subscriptions to authenticated');
    expect(migrationSource).not.toContain('grant delete on public.subscriptions to authenticated');
  });

  it('locks every mutation RPC to service_role with an empty search path', () => {
    const functions = [
      'begin_dodo_checkout',
      'process_dodo_subscription_event',
      'record_dodo_webhook_event',
      'try_consume_coach_quota',
    ];

    for (const functionName of functions) {
      expect(migrationSource).toContain(`revoke all on function public.${functionName}`);
      expect(migrationSource).toContain(`grant execute on function public.${functionName}`);
    }
    expect((migrationSource.match(/security definer/g) ?? []).length).toBe(functions.length);
    expect((migrationSource.match(/set search_path = ''/g) ?? []).length).toBe(functions.length);
  });

  it('serializes checkout and webhook transitions and atomically gates quota', () => {
    expect((migrationSource.match(/pg_advisory_xact_lock/g) ?? []).length).toBeGreaterThanOrEqual(3);
    expect(migrationSource).toContain('on conflict (webhook_id) do nothing');
    expect(migrationSource).toContain('p_event_timestamp < v_existing.provider_event_at');
    expect(migrationSource).toContain('public.coach_daily_usage.messages_used < p_limit');
  });

  it('quarantines identity/product mismatches instead of mutating entitlement', () => {
    expect(migrationSource).toContain("diagnostic_code = 'subscription_identity_mismatch'");
    expect(migrationSource).toContain("diagnostic_code = 'customer_identity_mismatch'");
    expect(migrationSource).toContain("diagnostic_code = 'unexpected_product'");
    expect(migrationSource).toContain("diagnostic_code = 'unmatched_user'");
    expect(migrationSource).toContain("diagnostic_code = 'duplicate_active_subscription'");
  });
});

describe('grace-period deadline durability', () => {
  it('keeps the Dodo-signed deadline when a REST snapshot omits the field', () => {
    // Dodo's subscription REST API does not return past_due_ends_at, and the
    // server re-reads subscriptions for payment.*, refund.*, and dispute.*
    // events. Without this guard a re-read would null out a verified deadline.
    expect(graceMigrationSource).toMatch(/new\.past_due_ends_at is null/);
    expect(graceMigrationSource).toMatch(/new\.past_due_ends_at := old\.past_due_ends_at/);
    expect(graceMigrationSource).toContain("new.provider = 'dodo'");
    expect(graceMigrationSource).toContain("old.provider = 'dodo'");
    expect(graceMigrationSource).toContain('before update on public.subscriptions');
  });

  it('cannot invent a deadline and adds no privilege-escalation surface', () => {
    // The guard only ever copies an existing signed value, never a new one, and
    // it is not a SECURITY DEFINER function (so it cannot be used to bypass the
    // service-role locks the billing RPCs rely on).
    expect(graceMigrationSource).not.toContain('security definer');
    expect(graceMigrationSource).not.toMatch(/new\.past_due_ends_at := (?!old\.)/);
    expect(graceMigrationSource).toContain(
      'revoke all on function public.preserve_dodo_grace_deadline() from public, anon, authenticated;',
    );
  });

  it('is applied after the billing migration it depends on', () => {
    expect(migrationNames).toContain('20261011000000_dodo_test_billing.sql');
    expect(migrationNames).toContain(graceMigrationName);
    expect(migrationNames.indexOf(graceMigrationName)).toBeGreaterThan(
      migrationNames.indexOf('20261011000000_dodo_test_billing.sql'),
    );
  });
});
