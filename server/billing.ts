import DodoPayments from 'dodopayments';

export const DODO_TEST_ENVIRONMENT = 'test_mode' as const;
export const PRO_MONTHLY_PRICE_CENTS = 900;
export const BILLING_RETURN_PATH = '/profile?billing=return';
export const BILLING_CANCEL_PATH = '/profile?billing=cancelled';

export interface BillingConfig {
  apiKey: string;
  webhookKey: string;
  productId: string;
  environment: typeof DODO_TEST_ENVIRONMENT;
  appOrigin: string;
}

export interface BillingConfigState {
  config: BillingConfig | null;
  /** Safe to log or return; it never contains credential values. */
  problem: string | null;
  missing: string[];
}

const REQUIRED_BILLING_KEYS = [
  'DODO_PAYMENTS_API_KEY',
  'DODO_PAYMENTS_WEBHOOK_KEY',
  'DODO_PAYMENTS_PRODUCT_ID',
  'DODO_PAYMENTS_ENVIRONMENT',
  'APP_URL',
] as const;

/**
 * Validates the complete billing configuration without ever falling back to live
 * mode. An entirely absent configuration disables billing while preserving the
 * rest of the application; a partially configured or live configuration is an
 * explicit startup problem.
 */
export function parseBillingConfig(
  source: NodeJS.ProcessEnv | Record<string, string | undefined>,
  production: boolean,
): BillingConfigState {
  // APP_URL is also used by deployments that have not enabled billing yet, so
  // it must not activate billing on its own. Any Dodo-specific value, however,
  // requires the complete configuration below.
  const dodoKeys = REQUIRED_BILLING_KEYS.filter((key) => key !== 'APP_URL');
  const dodoPresent = dodoKeys.filter((key) => Boolean(source[key]?.trim()));
  const missing = REQUIRED_BILLING_KEYS.filter((key) => !source[key]?.trim());

  if (source.DODO_PAYMENTS_BASE_URL?.trim()) {
    return {
      config: null,
      missing: [],
      problem: 'DODO_PAYMENTS_BASE_URL must not be set; the test-mode SDK endpoint is fixed by the server.',
    };
  }

  if (dodoPresent.length === 0) {
    return {
      config: null,
      missing: [...REQUIRED_BILLING_KEYS],
      problem: 'Dodo Payments test billing is not configured.',
    };
  }

  if (missing.length > 0) {
    return {
      config: null,
      missing: [...missing],
      problem: `Dodo Payments configuration is incomplete. Missing: ${missing.join(', ')}.`,
    };
  }

  if (source.DODO_PAYMENTS_ENVIRONMENT !== DODO_TEST_ENVIRONMENT) {
    return {
      config: null,
      missing: [],
      problem: 'DODO_PAYMENTS_ENVIRONMENT must be exactly test_mode. Live mode is disabled.',
    };
  }

  const apiKey = source.DODO_PAYMENTS_API_KEY!.trim();
  if (!apiKey.startsWith('dodo_test_')) {
    return {
      config: null,
      missing: [],
      problem: 'DODO_PAYMENTS_API_KEY must be a test-mode key (dodo_test_...). Live keys are rejected.',
    };
  }

  const productId = source.DODO_PAYMENTS_PRODUCT_ID!.trim();
  if (!/^pdt_[A-Za-z0-9_-]+$/.test(productId)) {
    return {
      config: null,
      missing: [],
      problem: 'DODO_PAYMENTS_PRODUCT_ID is not a valid Dodo product identifier.',
    };
  }

  let appUrl: URL;
  try {
    appUrl = new URL(source.APP_URL!.trim());
  } catch {
    return { config: null, missing: [], problem: 'APP_URL must be an absolute URL.' };
  }

  const localDevelopmentUrl =
    !production &&
    appUrl.protocol === 'http:' &&
    (appUrl.hostname === 'localhost' || appUrl.hostname === '127.0.0.1');
  if (appUrl.protocol !== 'https:' && !localDevelopmentUrl) {
    return {
      config: null,
      missing: [],
      problem: 'APP_URL must use HTTPS (HTTP is accepted only for local development).',
    };
  }
  if (
    appUrl.username ||
    appUrl.password ||
    appUrl.search ||
    appUrl.hash ||
    (appUrl.pathname !== '/' && appUrl.pathname !== '')
  ) {
    return {
      config: null,
      missing: [],
      problem: 'APP_URL must be an origin only, without credentials, a path, query string, or fragment.',
    };
  }

  return {
    config: {
      apiKey,
      webhookKey: source.DODO_PAYMENTS_WEBHOOK_KEY!.trim(),
      productId,
      environment: DODO_TEST_ENVIRONMENT,
      appOrigin: appUrl.origin,
    },
    missing: [],
    problem: null,
  };
}

export function createDodoTestClient(config: BillingConfig): DodoPayments {
  return new DodoPayments({
    bearerToken: config.apiKey,
    webhookKey: config.webhookKey,
    // Never derive this from NODE_ENV. This integration intentionally cannot
    // initialize a live-mode client.
    environment: DODO_TEST_ENVIRONMENT,
    baseURL: null,
    timeout: 15_000,
    maxRetries: 2,
    // Application logs emit only explicitly sanitized provider diagnostics.
    logLevel: 'off',
  });
}

export function billingReturnUrl(config: BillingConfig): string {
  return new URL(BILLING_RETURN_PATH, config.appOrigin).toString();
}

export function billingCancelUrl(config: BillingConfig): string {
  return new URL(BILLING_CANCEL_PATH, config.appOrigin).toString();
}

export function billingPortalReturnUrl(config: BillingConfig): string {
  return new URL('/profile', config.appOrigin).toString();
}

/** Only redirect to the documented test checkout host. */
export function isSafeTestCheckoutUrl(value: string | null | undefined): value is string {
  if (!value) return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      url.hostname === 'test.checkout.dodopayments.com' &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}

/** Customer-portal sessions are also hosted by Dodo and must never be arbitrary redirects. */
export function isSafeDodoPortalUrl(value: string | null | undefined): value is string {
  if (!value) return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      (url.hostname === 'test.dodopayments.com' ||
        url.hostname.endsWith('.dodopayments.com')) &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}

export interface ProductLike {
  product_id: string;
  is_recurring: boolean;
  price: {
    type: string;
    currency?: string;
    price?: number;
    payment_frequency_count?: number;
    payment_frequency_interval?: string;
    subscription_period_count?: number;
    subscription_period_interval?: string;
    discount?: number;
    discount_bps?: number | null;
    purchasing_power_parity?: boolean;
    trial_period_days?: number;
    trial_amount?: number | null;
  };
}

export function validateProProduct(product: ProductLike, expectedProductId: string): string | null {
  if (product.product_id !== expectedProductId) return 'The configured product ID did not match the provider response.';
  if (!product.is_recurring || product.price?.type !== 'recurring_price') {
    return 'The configured Dodo product must be recurring.';
  }
  if (product.price.currency !== 'USD' || product.price.price !== PRO_MONTHLY_PRICE_CENTS) {
    return 'The configured Dodo product must cost exactly $9.00 USD.';
  }
  if (
    product.price.payment_frequency_count !== 1 ||
    product.price.payment_frequency_interval?.toLowerCase() !== 'month' ||
    product.price.subscription_period_count !== 1 ||
    product.price.subscription_period_interval?.toLowerCase() !== 'month'
  ) {
    return 'The configured Dodo product must have one-month billing and subscription periods.';
  }
  if (
    (product.price.discount ?? 0) !== 0 ||
    (product.price.discount_bps ?? 0) !== 0 ||
    product.price.purchasing_power_parity === true ||
    (product.price.trial_period_days ?? 0) !== 0 ||
    (product.price.trial_amount ?? 0) !== 0
  ) {
    return 'The configured Dodo product must not have an automatic discount, localized price, or trial.';
  }
  return null;
}

export type StoredSubscriptionStatus =
  | 'inactive'
  | 'pending'
  | 'active'
  | 'past_due'
  | 'on_hold'
  | 'paused'
  | 'cancelled'
  | 'canceled'
  | 'failed'
  | 'expired'
  | 'revoked';

export interface StoredSubscription {
  user_id: string;
  plan?: string | null;
  provider?: string | null;
  status?: StoredSubscriptionStatus | string | null;
  provider_customer_id?: string | null;
  provider_subscription_id?: string | null;
  provider_product_id?: string | null;
  current_period_start?: string | null;
  current_period_end?: string | null;
  past_due_ends_at?: string | null;
  cancel_at_period_end?: boolean | null;
}

export interface UserEntitlement {
  plan: 'free' | 'pro';
  isPro: boolean;
  status: string;
  provider: string | null;
  dailyLimit: number;
  freeDailyLimit: number;
  proDailyLimit: number;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  renewalDate: string | null;
  accessEndsAt: string | null;
  cancelAtPeriodEnd: boolean;
  canManageBilling: boolean;
}

function isFuture(value: string | null | undefined, nowMs: number): boolean {
  if (!value) return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && parsed > nowMs;
}

/**
 * Central entitlement policy. Dodo is fail-closed: even an `active` row must
 * have a future provider period end, preventing stale webhook data from granting
 * permanent access. `past_due` follows Dodo's own grace-period deadline.
 */
export function deriveEntitlement(
  row: StoredSubscription | null | undefined,
  freeDailyLimit: number,
  proDailyLimit: number,
  now = new Date(),
  expectedDodoProductId?: string,
): UserEntitlement {
  const status = row?.status ?? 'inactive';
  const provider = row?.provider ?? null;
  const nowMs = now.getTime();
  const periodIsCurrent = isFuture(row?.current_period_end, nowMs);
  const graceIsCurrent = isFuture(row?.past_due_ends_at, nowMs);

  const adminPro = provider === 'admin' && row?.plan === 'pro' && status === 'active';
  const dodoPro =
    provider === 'dodo' &&
    Boolean(expectedDodoProductId) &&
    row?.provider_product_id === expectedDodoProductId &&
    row?.plan === 'pro' &&
    ((status === 'active' && periodIsCurrent) ||
      (status === 'past_due' && graceIsCurrent) ||
      ((status === 'cancelled' || status === 'canceled') &&
        Boolean(row?.cancel_at_period_end) &&
        periodIsCurrent));
  const isPro = adminPro || dodoPro;

  const renewalDate =
    isPro && status === 'active' && !row?.cancel_at_period_end
      ? row?.current_period_end ?? null
      : null;
  const accessEndsAt =
    isPro && status === 'past_due'
      ? row?.past_due_ends_at ?? null
      : isPro && (Boolean(row?.cancel_at_period_end) || status === 'cancelled' || status === 'canceled')
        ? row?.current_period_end ?? null
        : null;

  return {
    plan: isPro ? 'pro' : 'free',
    isPro,
    status,
    provider,
    dailyLimit: isPro ? proDailyLimit : freeDailyLimit,
    freeDailyLimit,
    proDailyLimit,
    currentPeriodStart: row?.current_period_start ?? null,
    currentPeriodEnd: row?.current_period_end ?? null,
    renewalDate,
    accessEndsAt,
    cancelAtPeriodEnd: Boolean(row?.cancel_at_period_end),
    canManageBilling: provider === 'dodo' && Boolean(row?.provider_customer_id),
  };
}

export const SUBSCRIPTION_WEBHOOK_TYPES = new Set([
  'subscription.active',
  'subscription.renewed',
  'subscription.past_due',
  'subscription.on_hold',
  'subscription.paused',
  'subscription.unpaused',
  'subscription.cancelled',
  'subscription.failed',
  'subscription.expired',
  'subscription.plan_changed',
  'subscription.updated',
  'subscription.update_payment_method',
]);

export const PAYMENT_WEBHOOK_TYPES = new Set([
  'payment.succeeded',
  'payment.failed',
  'payment.processing',
  'payment.cancelled',
]);

export const REFUND_WEBHOOK_TYPES = new Set(['refund.succeeded', 'refund.failed']);

export const DISPUTE_WEBHOOK_TYPES = new Set([
  'dispute.opened',
  'dispute.expired',
  'dispute.accepted',
  'dispute.cancelled',
  'dispute.challenged',
  'dispute.won',
  'dispute.lost',
]);

export function isUuid(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}

export function metadataUserId(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null;
  const value = (metadata as Record<string, unknown>).app_user_id;
  return isUuid(value) ? value : null;
}

export interface DodoSubscriptionSnapshot {
  providerCustomerId: string;
  providerSubscriptionId: string;
  providerProductId: string;
  status: StoredSubscriptionStatus;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  pastDueEndsAt: string | null;
  cancelAtPeriodEnd: boolean;
  metadataUserId: string | null;
}

const DODO_STATUSES = new Set<StoredSubscriptionStatus>([
  'pending',
  'active',
  'past_due',
  'on_hold',
  'paused',
  'cancelled',
  'failed',
  'expired',
]);

/** Runtime validation protects the database even if a provider payload changes. */
export function subscriptionSnapshot(value: unknown): DodoSubscriptionSnapshot | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const data = value as Record<string, any>;
  const status = data.status as StoredSubscriptionStatus;
  const customerId = data.customer?.customer_id;
  if (
    typeof data.subscription_id !== 'string' ||
    typeof data.product_id !== 'string' ||
    typeof customerId !== 'string' ||
    !DODO_STATUSES.has(status)
  ) {
    return null;
  }

  const validDateOrNull = (date: unknown): string | null =>
    typeof date === 'string' && Number.isFinite(Date.parse(date)) ? new Date(date).toISOString() : null;

  return {
    providerCustomerId: customerId,
    providerSubscriptionId: data.subscription_id,
    providerProductId: data.product_id,
    status,
    currentPeriodStart: validDateOrNull(data.previous_billing_date),
    currentPeriodEnd: validDateOrNull(data.next_billing_date ?? data.expires_at),
    pastDueEndsAt: validDateOrNull(data.past_due_ends_at),
    cancelAtPeriodEnd: data.cancel_at_next_billing_date === true,
    metadataUserId: metadataUserId(data.metadata),
  };
}

export function validEventTimestamp(value: unknown): string | null {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) return null;
  return new Date(value).toISOString();
}

export function firstSubscriptionId(value: unknown): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const data = value as Record<string, any>;
  if (typeof data.subscription_id === 'string' && data.subscription_id) return data.subscription_id;
  if (Array.isArray(data.subscription_ids)) {
    const id = data.subscription_ids.find((candidate: unknown) => typeof candidate === 'string');
    return typeof id === 'string' ? id : null;
  }
  return null;
}
