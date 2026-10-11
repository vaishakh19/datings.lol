# datings.lol

React/Vite frontend, Express API, Supabase authentication and persistence, Gemini Coach, and Dodo Payments subscriptions.

> **Billing safety boundary:** this repository currently supports **Dodo TEST MODE only**. It rejects live API keys, any environment other than `test_mode`, and custom Dodo base URLs. No real payment credentials belong in this setup.

## Architecture

- `src/` is the React/Vite SPA.
- `server.ts` is the shared Express API used locally and by Vercel.
- `api/index.ts` is Vercel's serverless adapter; `vercel.json` sends every `/api/*` request to it.
- Supabase Auth supplies browser sessions. The API re-verifies bearer tokens with Supabase; billing mutations require a fresh verification.
- Supabase service-role access is server-only. RLS lets a signed-in user read only a restricted projection of their own subscription and never write billing state.
- Dodo Checkout Sessions and the Customer Portal are hosted by Dodo. The browser never supplies a product, price, app user ID, Dodo customer ID, or entitlement.
- A verified Dodo webhook is the only path that turns a Dodo checkout into Pro access. A return URL is only a UI hint.
- Coach quota is selected from server-side entitlement state and consumed atomically in Postgres. Free is fixed at **3 messages/day**; Pro uses a finite `COACH_PRO_DAILY_LIMIT`.

## Local setup

1. Install dependencies:

   ```bash
   npm ci
   ```

2. Copy `.env.example` to `.env` and set the Supabase browser and server variables. Never commit `.env`.

3. Apply every migration in `supabase/migrations/` in timestamp order. If this checkout is linked to the intended Supabase project:

   ```bash
   supabase db push
   ```

   Alternatively, paste each migration into the Supabase SQL Editor in timestamp order. The billing migration is:

   ```text
   supabase/migrations/20261011000000_dodo_test_billing.sql
   ```

4. For local UI development without Supabase or billing, set `ALLOW_DEMO_MODE=true`, leave all Dodo variables unset, and run:

   ```bash
   npm run dev
   ```

   Demo mode deliberately does not grant paid access and must never be enabled in production.

## Dodo Payments TEST MODE setup

### 1. Apply and inspect the Supabase migration

The billing migration is additive. It extends `subscriptions` and creates:

- `dodo_webhook_events` — sanitized webhook IDs, hashes, outcomes, and quarantine diagnostics; no raw payment payloads
- `billing_checkout_attempts` — durable per-user checkout reservations and reusable hosted URLs
- `coach_daily_usage` — atomic daily counters
- `coach_request_log` — server-side Coach request accounting
- `begin_dodo_checkout`, `process_dodo_subscription_event`, `record_dodo_webhook_event`, and `try_consume_coach_quota` RPCs

The RPCs are `SECURITY DEFINER`, use an empty search path, and are executable only by `service_role`. The browser has no write grants on billing tables.

After applying the migration, these read-only checks should return table/function names:

```sql
select to_regclass('public.subscriptions');
select to_regclass('public.dodo_webhook_events');
select to_regclass('public.billing_checkout_attempts');
select to_regclass('public.coach_daily_usage');

select routine_name
from information_schema.routines
where routine_schema = 'public'
  and routine_name in (
    'begin_dodo_checkout',
    'process_dodo_subscription_event',
    'record_dodo_webhook_event',
    'try_consume_coach_quota'
  )
order by routine_name;
```

Do not test by manually setting a user's Dodo row to `active`; that bypasses the webhook trust boundary and does not verify the integration.

### 2. Reuse or create the one test product

In the Dodo dashboard, first switch to **Test Mode**. Test and live products are isolated.

1. Search the existing test products before creating anything.
2. Reuse a product only if it is exactly:
   - recurring fixed price
   - USD **$9.00** (`900` minor units)
   - payment frequency: every 1 month
   - subscription period: 1 month
   - no trial, automatic discount, purchasing-power-parity/localized pricing, usage price, or editable add-on price
3. If no matching test product exists, create one with those settings.
4. Copy its `pdt_...` ID into `DODO_PAYMENTS_PRODUCT_ID`.

The API retrieves and validates the product before checkout. Checkout also disables currency selection, discount codes, and editable add-ons. A mismatch returns `BILLING_PRODUCT_INVALID`; it never silently uses another product.

### 3. Create test credentials

Still in **Test Mode**:

1. Create or copy a test API key. It must begin with `dodo_test_`.
2. Create a webhook endpoint with this exact public URL:

   ```text
   POST https://datings.lol/api/webhooks/dodo
   ```

   For a preview deployment, use that preview's public HTTPS origin and set the same origin in its `APP_URL` environment variable.

3. Subscribe the endpoint to these event families:
   - subscription: `active`, `renewed`, `past_due`, `on_hold`, `paused`, `unpaused`, `cancelled`, `failed`, `expired`, `plan_changed`, `updated`, `update_payment_method`
   - payment: `succeeded`, `failed`, `processing`, `cancelled`
   - refund: `succeeded`, `failed`
   - dispute: `opened`, `expired`, `accepted`, `cancelled`, `challenged`, `won`, `lost`
4. Copy that endpoint's signing secret into `DODO_PAYMENTS_WEBHOOK_KEY`.

The endpoint reads the exact raw JSON bytes before Express's JSON parser and calls the official SDK's `webhooks.unwrap()` with `webhook-id`, `webhook-signature`, and `webhook-timestamp`. Invalid or unsigned requests receive `401`. Do not put the webhook secret, API key, or service-role key in a `VITE_` variable.

### 4. Set server environment variables

| Variable | Required | Scope and rule |
| --- | --- | --- |
| `DODO_PAYMENTS_API_KEY` | For billing | Server only; must be a `dodo_test_...` key |
| `DODO_PAYMENTS_WEBHOOK_KEY` | For billing | Server only; signing secret for the configured test webhook |
| `DODO_PAYMENTS_PRODUCT_ID` | For billing | Server only; the validated `pdt_...` test product |
| `DODO_PAYMENTS_ENVIRONMENT` | For billing | Must be exactly `test_mode` |
| `APP_URL` | For billing | Canonical HTTPS origin only, for example `https://datings.lol`; no route, query, or fragment |
| `COACH_PRO_DAILY_LIMIT` | No | Finite integer from 4 through 10,000; defaults to 100 |
| `SUPABASE_URL` | Production API | Server-side project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Production API | Server only; never use a `VITE_` prefix |
| `VITE_SUPABASE_URL` | Browser auth | Public project URL, baked into the SPA |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Browser auth | Public/publishable key, baked into the SPA |
| `GEMINI_API_KEY` | No | Server only; enables Gemini-backed Coach responses |

Billing configuration is all-or-nothing. Leaving every Dodo variable unset disables checkout without breaking unrelated features. Supplying any Dodo setting requires the full set. `APP_URL` alone does not enable billing. Never set `DODO_PAYMENTS_BASE_URL`; the integration pins the SDK to its official test environment.

## Subscription and entitlement flows

### Checkout

1. The SPA sends an empty authenticated `POST /api/billing/checkout`.
2. The API freshly verifies the Supabase token and derives the app user and confirmed email server-side.
3. A Postgres advisory lock rejects an existing entitlement, an open checkout, or excessive attempts.
4. The API validates the configured Dodo test product.
5. It creates a hosted Checkout Session with server-owned product/cart/metadata and a durable idempotency key.
6. Only an allowlisted `https://test.checkout.dodopayments.com/...` URL is returned.
7. A 24-hour open reservation is reused instead of creating another payable checkout. Dodo does not expose checkout-session invalidation, so a browser cancellation does not discard this duplicate-payment guard.

Creating or returning from checkout never grants Pro.

### Webhooks

Verified events are claimed by `webhook-id` in the same database transaction that updates entitlement. Per-subscription and per-user locks serialize concurrent deliveries. Older events cannot regress a newer state.

A subscription is associated only through signed metadata or an already verified Dodo subscription/customer mapping. Unexpected products, unknown users, identity conflicts, and second active subscriptions are quarantined with a short diagnostic code and do not change access.

- `active` and current-period subscriptions grant Pro.
- `past_due` grants access only through Dodo's signed `past_due_ends_at` value.
- scheduled cancellation grants access only through the paid-through period end.
- `on_hold`, `paused`, `failed`, `expired`, and revoked states deny access.
- a full successful refund revokes; a partial or failed refund is recorded without revocation.
- open/lost/accepted/challenged/expired disputes revoke; won/cancelled disputes re-read Dodo's current subscription state.

### Billing management

`POST /api/billing/portal` derives the stored customer from the authenticated account and returns only a validated Dodo-hosted portal URL. Cancellation and payment-method changes happen in that portal and become authoritative only when verified webhooks update Supabase.

The admin plan endpoint cannot overwrite a Dodo-owned subscription. Explicit admin grants remain a separate `provider='admin'` path.

### Coach quota

Every `/api/coach` request obtains the current server entitlement and atomically increments the UTC daily counter only when it is below the applicable limit. Concurrent requests cannot bypass the limit. Client/local-storage `isPro` values are ignored and cannot select a quota.

## Deploying to Vercel

The Vite SPA and Express API must deploy together:

- `api/index.ts` imports the same Express app used locally.
- `vercel.json` routes all `/api/*` paths to that function and SPA routes to `index.html`.
- `/api/webhooks/dodo` therefore reaches the raw-body route without a second backend.

Set all server and browser variables in **Vercel → Project → Settings → Environment Variables** before deploying. Use only test Dodo credentials. Apply variables to each Vercel environment that will exercise billing, and ensure that environment's `APP_URL` exactly matches its public origin. Redeploy after changing variables.

Smoke-test routing:

```bash
curl -sS https://datings.lol/api/health
```

Expected billing metadata when configured:

```json
{"status":"ok","billing":{"provider":"dodo","environment":"test_mode","configured":true}}
```

Additional fields may be present. If HTML is returned, `/api/*` is incorrectly reaching the SPA. If `status` is `degraded`, fix the reported server configuration and redeploy. Never print environment variable values while diagnosing.

## Automated verification

```bash
npm ci
npm run lint
npm test
npm run build
npm audit
```

The billing tests cover fail-closed configuration, hosted URL allowlists, exact product validation, finite entitlement policy, Dodo payload normalization/event names, raw-body middleware ordering, browser-input exclusion, durable checkout/idempotency guards, migration privileges, event ordering, quarantine paths, and atomic quota structure.

These tests do not contact Dodo or a hosted Supabase project. Provider-hosted checkout and webhook delivery must still be tested manually with real **test-mode** credentials.

## Manual TEST MODE runbook

Use a dedicated test user with a confirmed email. Never use a real card.

### Baseline Free quota

1. Sign in and call Coach three times on the same UTC day.
2. Confirm the fourth request returns `429` with `code: "COACH_DAILY_LIMIT"`, `plan: "free"`, and `limit: 3`.
3. Changing local storage or synchronized `isPro` state must not alter that result.

### Successful subscription

1. Click **Upgrade to Pro**.
2. At Dodo's test checkout use:
   - card: `4242 4242 4242 4242`
   - expiry: `06/32` or `12/34`
   - CVV: `123`
3. After return, the UI should show pending until the verified webhook is persisted, then show Pro, provider status, renewal/access-end date, and the configured finite allowance.
4. Refresh and sign in on another device/browser. Pro must come from the API, not local state.
5. Repeatedly clicking Upgrade or issuing concurrent checkout requests must reuse/reject the open checkout, not create another subscription.

### Declines and cancellation

Use these documented Dodo test cards:

| Scenario | Card | Expiry | CVV |
| --- | --- | --- | --- |
| Generic decline | `4000 0000 0000 0002` | `12/34` | `123` |
| Insufficient funds | `4000 0000 0000 9995` | `12/34` | `123` |
| Fail a later renewal | `4000 0000 0000 0341` | `12/34` | `123` |

- A declined initial checkout must never grant Pro.
- Leaving via Dodo's cancel/back action must show a canceled UI state without changing entitlement. The existing checkout reservation remains reusable to prevent duplicates.
- Open **Manage / cancel in Dodo**, schedule cancellation, and verify access remains only until Dodo's paid-through date.
- To test renewal failure, first subscribe with the success card, switch the payment method in the Customer Portal to the renewal-failure card, then use Dodo's test tooling/API to move `next_billing_date`. Confirm the signed lifecycle events produce the expected grace/on-hold behavior.

### Refunds, disputes, retries, and ordering

1. From the Dodo Test Mode dashboard, issue a partial refund and confirm it is recorded but Pro remains unchanged.
2. Issue a full refund and confirm the verified `refund.succeeded` flow revokes access.
3. Exercise test dispute events if enabled for the account; access must fail closed until a won/cancelled event re-synchronizes the subscription.
4. Use the Dodo dashboard's webhook resend/retry action for the same delivery. Only one `webhook_id` should be processed.
5. Resend an older lifecycle delivery after a newer one and confirm it is marked `ignored_stale`.

Sanitized operational inspection:

```sql
select webhook_id, event_type, processing_status, diagnostic_code,
       provider_subscription_id, user_id, event_timestamp, received_at, processed_at
from public.dodo_webhook_events
order by received_at desc
limit 100;

select user_id, plan, status, provider, provider_product_id,
       current_period_end, past_due_ends_at, cancel_at_period_end, provider_event_at
from public.subscriptions
order by updated_at desc;
```

Dodo CLI `wh trigger` payloads are unsigned and this endpoint should reject them. They are not proof of signature verification. A Dodo test webhook configured in the dashboard, or the CLI's signed `wh listen` forwarding flow, is required for an end-to-end verification.

## Cross-device data

Authenticated account state is stored in `public.user_app_state` and protected by RLS. The synchronized payload includes onboarding, progress, Coach UI history, avatar/screenshots, community state, journal, profile audit, and notification preferences.

The browser keeps a per-user cache for offline recovery, but Supabase is the source of truth for application state. **Neither that payload nor local storage is a billing entitlement source.** Server subscription state and atomic quota tables are authoritative.

## Admin control center

The responsive control center is available at `/admin`. Every request is authorized on the server; editable usernames and browser storage are never security boundaries.

Grant the first administrator in Supabase:

```sql
insert into public.admin_users (user_id)
select id from auth.users where lower(email) = lower('YOUR_EMAIL_HERE')
on conflict (user_id) do nothing;
```

`ADMIN_USER_IDS` is a server-only emergency allowlist. Prefer `admin_users` for normal operation. Admin changes are written to `audit_logs`. Dodo-owned plans cannot be changed through the admin plan control; use Dodo billing management and verified webhooks.

## Current limitations and operations

- Repository tests use mocks/pure inputs and source invariants; they do not prove that a particular Supabase migration was applied or that Dodo delivered a webhook.
- Per-IP Express rate limiting is per serverless instance. Durable per-user checkout and quota controls remain database-backed, but broad distributed abuse protection should use a shared rate-limit store/WAF.
- The model stores one current subscription per app user. A second active Dodo subscription is quarantined for operator review rather than silently replacing the first; operators must resolve/cancel duplicates in Dodo Test Mode.
- Dodo exposes no checkout-session invalidation API. Open hosted sessions are reserved/reused for 24 hours; review quarantined and stale attempts operationally.
- Webhook logs intentionally contain hashes and diagnostic codes, not full provider payloads. Use the Dodo dashboard for payment-detail investigations.

## Future production launch (not enabled by this implementation)

Do **not** switch this code by merely replacing the test key. It intentionally rejects live mode. A production launch requires a separate, reviewed change and explicit approval:

1. Complete Dodo business/KYC verification and production tax/compliance review.
2. Recreate or import the product in Dodo Live Mode; test product IDs and data do not carry over.
3. Create separate live API and webhook credentials and a separate live webhook endpoint configuration.
4. Add an explicit live-mode configuration path in code while retaining strict key/environment matching and no arbitrary base URL.
5. Re-run migration, RLS, concurrency, webhook signature/idempotency/order, refund, dispute, and quota tests in a staging environment.
6. Add production monitoring/alerts for webhook `503`s, quarantine diagnostics, duplicate subscriptions, refunds/disputes, and provider API failures.
7. Rotate credentials, document rollback, and obtain approval before placing any live secret in Vercel.
8. Perform an approved small real transaction and refund end-to-end, then reconcile Dodo and Supabase records before opening checkout broadly.

Until those steps and that code review happen, keep `DODO_PAYMENTS_ENVIRONMENT=test_mode` and use only `dodo_test_...` credentials.
