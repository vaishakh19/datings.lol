import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  DISPUTE_WEBHOOK_TYPES,
  PAYMENT_WEBHOOK_TYPES,
  REFUND_WEBHOOK_TYPES,
  SUBSCRIPTION_WEBHOOK_TYPES,
  createDodoTestClient,
  deriveEntitlement,
  firstSubscriptionId,
  isSafeDodoPortalUrl,
  isSafeTestCheckoutUrl,
  metadataUserId,
  parseBillingConfig,
  subscriptionSnapshot,
  validEventTimestamp,
  validateProProduct,
  type StoredSubscription,
} from './billing';

const validEnvironment = () => ({
  DODO_PAYMENTS_API_KEY: 'dodo_test_example_key',
  DODO_PAYMENTS_WEBHOOK_KEY: 'whsec_example_test_secret',
  DODO_PAYMENTS_PRODUCT_ID: 'pdt_test_pro_monthly',
  DODO_PAYMENTS_ENVIRONMENT: 'test_mode',
  APP_URL: 'https://datings.lol',
});

const subscription = (overrides: Partial<StoredSubscription> = {}): StoredSubscription => ({
  user_id: '11111111-1111-4111-8111-111111111111',
  plan: 'pro',
  status: 'active',
  provider: 'dodo',
  provider_customer_id: 'cus_123',
  provider_subscription_id: 'sub_123',
  provider_product_id: 'pdt_test_pro_monthly',
  current_period_start: '2026-10-01T00:00:00.000Z',
  current_period_end: '2026-11-01T00:00:00.000Z',
  past_due_ends_at: null,
  cancel_at_period_end: false,
  ...overrides,
});

const now = new Date('2026-10-11T12:00:00.000Z');

function entitlement(row: StoredSubscription | null, expectedProduct = 'pdt_test_pro_monthly') {
  return deriveEntitlement(row, 3, 50, now, expectedProduct);
}

describe('Dodo test-mode configuration', () => {
  it('allows billing to be wholly disabled even when the app origin exists', () => {
    const state = parseBillingConfig({ APP_URL: 'https://datings.lol' }, true);
    expect(state.config).toBeNull();
    expect(state.problem).toMatch(/not configured/);
    expect(state.missing).toContain('DODO_PAYMENTS_API_KEY');
  });

  it('loads a complete, canonical test-mode configuration', () => {
    expect(parseBillingConfig(validEnvironment(), true)).toEqual({
      config: {
        apiKey: 'dodo_test_example_key',
        webhookKey: 'whsec_example_test_secret',
        productId: 'pdt_test_pro_monthly',
        environment: 'test_mode',
        appOrigin: 'https://datings.lol',
      },
      missing: [],
      problem: null,
    });
  });

  it('reports incomplete configuration without including secret values', () => {
    const secret = 'dodo_test_do_not_print_me';
    const state = parseBillingConfig({ DODO_PAYMENTS_API_KEY: secret }, true);
    expect(state.config).toBeNull();
    expect(state.problem).toMatch(/configuration is incomplete/);
    expect(JSON.stringify(state)).not.toContain(secret);
  });

  it.each([
    [{ ...validEnvironment(), DODO_PAYMENTS_ENVIRONMENT: 'live_mode' }, /exactly test_mode/],
    [{ ...validEnvironment(), DODO_PAYMENTS_API_KEY: 'dodo_live_example' }, /test-mode key/],
    [{ ...validEnvironment(), DODO_PAYMENTS_BASE_URL: 'https://example.test' }, /must not be set/],
    [{ ...validEnvironment(), APP_URL: 'http://datings.lol' }, /must use HTTPS/],
    [{ ...validEnvironment(), APP_URL: 'https://datings.lol/path' }, /origin only/],
  ] as const)('fails closed for unsafe configuration %#', (environment, expected) => {
    const state = parseBillingConfig(environment, true);
    expect(state.config).toBeNull();
    expect(state.problem).toMatch(expected);
  });

  it('permits HTTP only for explicit local development', () => {
    const environment = { ...validEnvironment(), APP_URL: 'http://localhost:3000' };
    expect(parseBillingConfig(environment, false).config?.appOrigin).toBe('http://localhost:3000');
    expect(parseBillingConfig(environment, true).config).toBeNull();
  });
});

describe('official Standard Webhooks verification', () => {
  it('accepts an exact signed body and rejects body tampering', () => {
    const rawKey = Buffer.from('test-webhook-signing-key-32-bytes');
    const webhookKey = `whsec_${rawKey.toString('base64')}`;
    const client = createDodoTestClient({
      apiKey: 'dodo_test_example_key',
      webhookKey,
      productId: 'pdt_test_pro_monthly',
      environment: 'test_mode',
      appOrigin: 'https://datings.lol',
    });
    const body = JSON.stringify({
      business_id: 'bus_test',
      type: 'subscription.active',
      timestamp: new Date().toISOString(),
      data: { subscription_id: 'sub_123' },
    });
    const webhookId = 'msg_test_123';
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = createHmac('sha256', rawKey)
      .update(`${webhookId}.${timestamp}.${body}`)
      .digest('base64');
    const headers = {
      'webhook-id': webhookId,
      'webhook-timestamp': timestamp,
      'webhook-signature': `v1,${signature}`,
    };

    expect(client.webhooks.unwrap(body, { headers })).toMatchObject({
      type: 'subscription.active',
    });
    expect(() => client.webhooks.unwrap(`${body} `, { headers })).toThrow();
  });
});

describe('hosted URL allowlists', () => {
  it('accepts only the documented HTTPS test-checkout host', () => {
    expect(isSafeTestCheckoutUrl('https://test.checkout.dodopayments.com/session/123')).toBe(true);
    expect(isSafeTestCheckoutUrl('https://region.test.checkout.dodopayments.com/session/123')).toBe(false);
    expect(isSafeTestCheckoutUrl('https://checkout.dodopayments.com/session/123')).toBe(false);
    expect(isSafeTestCheckoutUrl('http://test.checkout.dodopayments.com/session/123')).toBe(false);
    expect(isSafeTestCheckoutUrl('https://test.checkout.dodopayments.com.evil.test/123')).toBe(false);
    expect(isSafeTestCheckoutUrl('javascript:alert(1)')).toBe(false);
  });

  it('accepts only HTTPS Dodo portal hosts', () => {
    expect(isSafeDodoPortalUrl('https://customer-portal.dodopayments.com/session/123')).toBe(true);
    expect(isSafeDodoPortalUrl('https://test.dodopayments.com/portal/123')).toBe(true);
    expect(isSafeDodoPortalUrl('https://dodopayments.com.evil.test/portal/123')).toBe(false);
  });
});

describe('configured product validation', () => {
  const validProduct = {
    product_id: 'pdt_test_pro_monthly',
    is_recurring: true,
    price: {
      type: 'recurring_price',
      currency: 'USD',
      price: 900,
      discount: 0,
      discount_bps: 0,
      purchasing_power_parity: false,
      payment_frequency_count: 1,
      payment_frequency_interval: 'Month',
      subscription_period_count: 1,
      subscription_period_interval: 'Month',
      trial_period_days: 0,
      trial_amount: null,
    },
  };

  it('accepts only the configured $9 USD monthly recurring product', () => {
    expect(validateProProduct(validProduct, 'pdt_test_pro_monthly')).toBeNull();
  });

  it.each([
    [{ ...validProduct, product_id: 'pdt_other' }, /ID did not match/],
    [{ ...validProduct, price: { ...validProduct.price, currency: 'EUR' } }, /\$9\.00 USD/],
    [{ ...validProduct, price: { ...validProduct.price, price: 999 } }, /\$9\.00 USD/],
    [{ ...validProduct, price: { ...validProduct.price, payment_frequency_count: 12 } }, /one-month/],
    [{ ...validProduct, price: { ...validProduct.price, subscription_period_interval: 'Year' } }, /one-month/],
    [{ ...validProduct, is_recurring: false }, /must be recurring/],
    [{ ...validProduct, price: { ...validProduct.price, discount_bps: 500 } }, /must not have/],
    [{ ...validProduct, price: { ...validProduct.price, trial_period_days: 7 } }, /must not have/],
  ] as const)('rejects a mismatched product %#', (product, expected) => {
    expect(validateProProduct(product, 'pdt_test_pro_monthly')).toMatch(expected);
  });
});

describe('server-side entitlement policy', () => {
  it('returns the finite Free allowance without a verified row', () => {
    expect(entitlement(null)).toMatchObject({ isPro: false, plan: 'free', dailyLimit: 3 });
  });

  it('grants the finite Pro allowance only for the configured Dodo product', () => {
    expect(entitlement(subscription())).toMatchObject({ isPro: true, plan: 'pro', dailyLimit: 50 });
    expect(entitlement(subscription(), 'pdt_different')).toMatchObject({ isPro: false, dailyLimit: 3 });
    expect(deriveEntitlement(subscription(), 3, 50, now)).toMatchObject({ isPro: false, dailyLimit: 3 });
  });

  it.each(['refunded', 'revoked', 'failed', 'expired', 'pending'])(
    'denies Pro for %s subscriptions',
    (status) => {
      expect(entitlement(subscription({ status }))).toMatchObject({ isPro: false, dailyLimit: 3 });
    },
  );

  it('allows past-due access only during the provider grace period', () => {
    expect(
      entitlement(subscription({ status: 'past_due', past_due_ends_at: '2026-10-12T00:00:00.000Z' })),
    ).toMatchObject({ isPro: true, dailyLimit: 50 });
    expect(
      entitlement(subscription({ status: 'past_due', past_due_ends_at: '2026-10-11T11:59:59.000Z' })),
    ).toMatchObject({ isPro: false, dailyLimit: 3 });
  });

  it('keeps scheduled-cancellation access only until its verified paid-through date', () => {
    expect(entitlement(subscription({ status: 'cancelled', cancel_at_period_end: true }))).toMatchObject({
      isPro: true,
      accessEndsAt: '2026-11-01T00:00:00.000Z',
    });
    expect(
      entitlement(
        subscription({
          status: 'cancelled',
          cancel_at_period_end: true,
          current_period_end: '2026-10-11T11:59:59.000Z',
        }),
      ),
    ).toMatchObject({ isPro: false });
    expect(entitlement(subscription({ status: 'cancelled', cancel_at_period_end: false }))).toMatchObject({
      isPro: false,
    });
  });

  it('supports explicit non-Dodo admin grants without treating them as paid subscriptions', () => {
    expect(
      entitlement(subscription({ provider: 'admin', provider_product_id: null, status: 'active' })),
    ).toMatchObject({ isPro: true, plan: 'pro', dailyLimit: 50, provider: 'admin' });
  });
});

describe('Dodo payload validation and supported event names', () => {
  const rawSubscription = {
    subscription_id: 'sub_123',
    customer: { customer_id: 'cus_123' },
    product_id: 'pdt_test_pro_monthly',
    status: 'active',
    metadata: { app_user_id: '11111111-1111-4111-8111-111111111111' },
    previous_billing_date: '2026-10-01T00:00:00.000Z',
    next_billing_date: '2026-11-01T00:00:00.000Z',
    past_due_ends_at: null,
    cancel_at_next_billing_date: false,
  };

  it('validates the provider subscription snapshot and signed metadata identity', () => {
    expect(subscriptionSnapshot(rawSubscription)).toEqual({
      providerCustomerId: 'cus_123',
      providerSubscriptionId: 'sub_123',
      providerProductId: 'pdt_test_pro_monthly',
      status: 'active',
      currentPeriodStart: '2026-10-01T00:00:00.000Z',
      currentPeriodEnd: '2026-11-01T00:00:00.000Z',
      pastDueEndsAt: null,
      cancelAtPeriodEnd: false,
      metadataUserId: '11111111-1111-4111-8111-111111111111',
    });
    expect(metadataUserId(rawSubscription.metadata)).toBe(
      '11111111-1111-4111-8111-111111111111',
    );
    expect(metadataUserId({ app_user_id: 'not-a-uuid' })).toBeNull();
  });

  it('rejects malformed or unknown-status subscription snapshots', () => {
    expect(subscriptionSnapshot({ ...rawSubscription, subscription_id: null })).toBeNull();
    expect(subscriptionSnapshot({ ...rawSubscription, customer: {} })).toBeNull();
    expect(subscriptionSnapshot({ ...rawSubscription, status: 'invented' })).toBeNull();
  });

  it('extracts subscription IDs only from documented payment locations', () => {
    expect(firstSubscriptionId({ subscription_id: 'sub_one' })).toBe('sub_one');
    expect(firstSubscriptionId({ subscription_ids: ['sub_two'] })).toBe('sub_two');
    expect(firstSubscriptionId({ subscription_ids: [123] })).toBeNull();
  });

  it('accepts valid event timestamps and rejects invalid timestamps', () => {
    expect(validEventTimestamp('2026-10-11T10:00:00Z')).toBe('2026-10-11T10:00:00.000Z');
    expect(validEventTimestamp('not-a-date')).toBeNull();
  });

  it('uses exact event names from the installed Dodo SDK', () => {
    expect(SUBSCRIPTION_WEBHOOK_TYPES).toContain('subscription.active');
    expect(SUBSCRIPTION_WEBHOOK_TYPES).toContain('subscription.cancelled');
    expect(PAYMENT_WEBHOOK_TYPES).toEqual(
      new Set(['payment.succeeded', 'payment.failed', 'payment.processing', 'payment.cancelled']),
    );
    expect(REFUND_WEBHOOK_TYPES).toEqual(new Set(['refund.succeeded', 'refund.failed']));
    expect(DISPUTE_WEBHOOK_TYPES).toContain('dispute.opened');
    expect(DISPUTE_WEBHOOK_TYPES).toContain('dispute.won');
    expect(DISPUTE_WEBHOOK_TYPES).not.toContain('payment.dispute.opened');
  });
});
