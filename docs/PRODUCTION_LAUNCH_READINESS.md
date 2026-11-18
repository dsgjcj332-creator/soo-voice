# SooVoice Production Launch Readiness — Billing, Payments and Integrations

Last reviewed: 2026-11-18

This runbook separates what is implemented and CI-verified from what still requires real provider credentials and an operator decision. A green CI run proves the code paths; it does not prove that production providers are configured. Nothing on this list is done until it has been exercised with real keys in a staging environment.

## 1. Environment variables (complete inventory)

All values are server-only. `.env.example` mirrors this list with comments.

| Variable | Required for | When empty |
| --- | --- | --- |
| `GEMINI_API_KEY` | Voice widget ephemeral tokens (`/api/gemini-session`) | Voice routes answer 503 |
| `WEBHOOK_SECRET` | Inbound catalog webhooks (`x-soovoice-signature`) | Webhooks rejected 503 |
| `API_KEY` | Admin/data API routes (`x-api-key`) | Routes reject 401 |
| `APP_URL` | OAuth callbacks, self-referential links | OAuth redirects break |
| `ALLOWED_ORIGINS` | CORS allowlist | All origins allowed (intentional while the widget is embedded on arbitrary storefronts) |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Browser Supabase client | Frontend cannot reach the database |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Server-side Supabase access | POS/billing/orders APIs answer 503 |
| `ORDER_TOKEN_SECRET` | Guest order capability tokens (HMAC, ≥32 chars) | Guest tracking fails closed |
| `POS_CREDENTIALS_ENCRYPTION_KEY`, `POS_CREDENTIALS_ENCRYPTION_KEY_VERSION` | AES-256-GCM encryption of POS provider credentials | POS connections cannot store credentials |
| `POS_OUTBOX_WORKER_SECRET` | Scheduled POS outbox dispatcher | Dispatcher rejects 401 |
| `CRON_SECRET` | Cron-only routes (vercel.json schedules) | Cron routes reject 401 |
| `STRIPE_SECRET_KEY` | Checkout Sessions, subscription cancel/resume | Billing routes answer explicit 503 `BILLING_NOT_CONFIGURED`; nothing is charged |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signature verification (`whsec_...`) | Webhook ingress answers 503 `BILLING_WEBHOOK_NOT_CONFIGURED` |
| `BILLING_CHECKOUT_SUCCESS_URL`, `BILLING_CHECKOUT_CANCEL_URL` | Optional absolute redirect URLs after Checkout | Derived from the request origin |
| `FOODICS_CLIENT_ID`, `FOODICS_CLIENT_SECRET` | Foodics OAuth (`/api/pos/foodics/oauth/*`) | OAuth routes answer 503 |

## 2. Database migrations

Apply `sql/` files in the exact order used by the CI `pos-migrations` job (see `.github/workflows/ci.yml`). Notes for production:

- The two newest billing files are additive and idempotent:
  - `sql/2026_12_10_billing_subscriptions_external_unique.sql` — partial unique index enforcing one `merchant_subscriptions` row per gateway `external_subscription_id` (protects webhook ingestion from select-then-insert races).
  - `sql/2026_12_11_billing_plans_seed.sql` — upserts the `free` / `pro` / `enterprise` plans and seeds prices **only when no active open-ended price exists** for that (plan, currency, interval). Safe to re-run.
- The seed amounts are operator defaults, not approved pricing. Review and adjust them through the billing admin API (`PATCH /api/admin/billing/prices/:id`) or in the file **before** enabling live payments.
- All migrations are additive; no column is dropped or rewritten. Rollback is not required to redeploy older code: newer code degrades to explicit 503s when its provider variables are unset, and older code simply ignores the new tables.

## 3. Stripe production setup

1. Activate the account and copy the live secret key into `STRIPE_SECRET_KEY`.
2. Register one webhook endpoint pointing at `https://<your-domain>/api/billing/webhooks/stripe` and subscribe to exactly these events:
   - `checkout.session.completed` — creates the merchant subscription row (idempotent).
   - `customer.subscription.updated` — syncs status, periods and `cancel_at_period_end`.
   - `customer.subscription.deleted` — cancels the row.
3. Copy the endpoint's signing secret (`whsec_...`) into `STRIPE_WEBHOOK_SECRET`. Every delivery is verified against the documented v1 HMAC scheme before processing; unsigned or tampered requests get 400.
4. Optionally set the checkout redirect URLs; otherwise the request origin is used.
5. Verify with the Stripe CLI: `stripe trigger checkout.session.completed` against a staging deployment, then confirm a `merchant_subscriptions` row was created for the merchant.

## 4. Monitoring

- `GET /api/health` — liveness (`{status, timestamp}`).
- `GET /api/health/billing` — configuration readiness booleans only (`stripeConfigured`, `stripeWebhookConfigured`, `stripeCheckoutRedirectsConfigured`, `posBackendConfigured`, `posCredentialsEncryptionConfigured`, `foodicsOAuthConfigured`). The probe never returns secret material; a test asserts the serialized response contains neither the Stripe key nor the webhook secret. Alert when `stripeConfigured` is `false` after the go-live date.
- Log lines to alert on: `Stripe webhook signature verification failed` (repeated occurrences indicate a misconfigured secret or an attacker), `Stripe subscription insert/update failed` (billing storage degraded), `Billing checkout error`.
- Cron schedules (POS outbox dispatcher, vercel.json) require `CRON_SECRET` / `POS_OUTBOX_WORKER_SECRET` to match the deployment environment.

## 5. Security posture (implemented and CI-verified)

- Merchant billing routes (`/api/billing/plans`, `/api/billing/subscription`, `/api/billing/checkout`, `/api/billing/subscription/cancel`) require a valid merchant session; the entitlements RPC runs with the merchant's own JWT, never the service key.
- The Stripe webhook route is the only unauthenticated billing ingress and is protected by signature verification over the raw body, a 1 MiB size cap, and per-subscription idempotency backed by a database-level unique index.
- Stripe API credentials are sent only to `api.stripe.com` over HTTPS as bearer tokens; errors returned to clients carry no gateway detail (generic 502/503 codes, details only in server logs).
- The health probe exposes booleans, never values. Secrets are never logged.
- Billing data access follows the RLS policies from the billing foundation migration (owner-read, platform-admin-read); the SQL integration tests assert tenant isolation.

## 6. Go-live checklist (ordered)

1. Apply all `sql/` migrations in CI order against the production database.
2. Re-run `sql/2026_12_11_billing_plans_seed.sql`; review seeded prices with the commercial owner; adjust via the admin API.
3. Set `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` (+ redirect URLs) in the deployment environment; redeploy.
4. Register the Stripe webhook endpoint and confirm `GET /api/health/billing` reports `stripeConfigured: true` and `stripeWebhookConfigured: true`.
5. Run one real test-mode purchase on staging: checkout → webhook → subscription row → cancel → resume.
6. Set Foodics app credentials if POS OAuth is in scope; verify an install against a Foodics sandbox tenant.
7. Rotate `ORDER_TOKEN_SECRET`, `CRON_SECRET`, `POS_OUTBOX_WORKER_SECRET` only with an explicit rotation plan; they are not safe to change ad hoc.

## 7. Not ready to claim as live

- No real Stripe account has been connected from this repository; the integration is CI-verified against documented API behavior and mocked HTTP only.
- Foodics OAuth has the same status: the code path is implemented and tested, but no partner app credentials exist yet, so no real install has been performed.
- Seeded prices are defaults pending commercial approval; the Billing page will render real subscribe buttons as soon as Stripe is configured, so pricing must be finalized first.
- Load behavior of webhook ingestion under Stripe retry storms has not been profiled; the unique index makes duplicate deliveries safe, but sustained failure will surface as Stripe-side pending deliveries to monitor in the Stripe Dashboard.
