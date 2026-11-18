# Admin Billing API

This change adds a server-side management boundary for the billing schema introduced by the billing foundation PR.

## Authentication and authorization

- Every endpoint requires a Supabase access token in `Authorization: Bearer <token>`.
- The API validates the token against Supabase Auth at `/auth/v1/user`.
- Platform-admin access is granted only when the verified user's `app_metadata.role` equals `admin`, or `app_metadata.roles` contains `admin`.
- Editable `user_metadata` is never used for authorization.
- The service-role key is read only from server environment variables and is never returned to the browser.
- Responses use `Cache-Control: no-store`.

Required server environment:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY` (or `VITE_SUPABASE_ANON_KEY`)
- `SUPABASE_SERVICE_ROLE_KEY`

## Endpoints

All routes are prefixed with `/api/admin/billing`.

| Method | Path | Purpose |
|---|---|---|
| GET | `/plans` | List plans and historical/current price rows |
| POST | `/plans` | Create an inactive-by-default plan |
| PATCH | `/plans/:planId` | Update allowlisted plan presentation/features/limits/activation |
| POST | `/prices` | Add an effective-dated monthly/yearly price |\n| PATCH | `/prices/:priceId` | Activate or deactivate an existing price row without rewriting its history |
| GET | `/promotions` | List promotions |
| POST | `/promotions` | Create a bounded percentage or fixed-amount promotion |
| GET | `/subscriptions` | Paginated read-only subscription list; optional status filter |

## Financial safety boundaries

- Prices use integer minor units and ISO-style three-letter uppercase currency codes.
- New plans, prices, and promotions default to inactive.
- Promotions enforce bounded percent/fixed discount inputs, date windows, optional redemption caps, and optional plan-key allowlists.
- Price history is additive; this API does not overwrite existing price rows.
- Subscription status, invoices, payment records, refunds, and payment-provider identifiers cannot be mutated through these endpoints.
- No payment gateway is selected, no charge is initiated, and no invoice is marked paid.
- First-ten and launch-promotion records are configuration only; redemption enforcement and transactional checkout are separate work.
- Successful plan, price and promotion mutations append an administrator audit event with the verified actor, action, resource and resulting non-secret state.
- Audit events are append-only, readable by platform admins only, and never writable from browser sessions.

The append-only audit table is created by `sql/2026_11_29_platform_admin_audit.sql`. Apply it after the billing foundation migration. CI validates admin-only reads, service-role inserts, and rejection of updates/deletes.

## Verification and deployment

The validation tests run under `npm run test:pos`. CI also runs TypeScript checks and the production build.

This API depends on the billing tables and policies from the billing foundation migration. Apply the billing migration in Supabase Staging before using these endpoints. The current change does not include the Super Admin management UI or a real payment provider.
