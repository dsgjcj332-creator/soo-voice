# SooVoice production readiness and multi-POS roadmap

## Product direction

SooVoice is a multi-tenant voice-ordering and restaurant integration platform. POS is a first-class integration category, not a single-vendor feature. The platform must support independent adapters for each POS vendor and a documented generic integration path.

## Current repository findings (main branch snapshot reviewed)

- `src/lib/api.ts` returns placeholder empty arrays/zero analytics for orders, conversations and analytics; order PATCH/DELETE report success without persistence.
- `src/lib/api.ts` OAuth callback acknowledges receipt but does not exchange the authorization code or persist credentials.
- Product/order/uninstall webhook handlers only log messages and acknowledge; they do not enqueue durable sync work.
- `src/pages/OAuthInstall.tsx` creates a random merchant id and inserts a merchant record without validating a provider-issued OAuth grant; it can show success even when the insert returns an error because the Supabase error is not checked.
- `src/pages/Integration.tsx` is currently a generic outbound webhook + widget embed screen, not a POS connector marketplace. Its test request is not signed with the configured HMAC protocol.
- `src/components/widget/VoiceWidget.tsx` reads the merchant identifier from query parameters and loads menu rows directly from Supabase. When the identifier is absent, its menu query is not tenant-filtered. A URL parameter is not proof of tenant authorization.
- `sql/orders_setup.sql` grants broad anonymous SELECT and UPDATE policies on all orders. This exposes cross-merchant order data and permits guests to change order status. These policies are not suitable for a commercial multi-tenant product.
- `api/gemini-session.ts` and `api/voice-preview.ts` are public serverless endpoints with no merchant authentication, tenant-level quotas, or durable usage accounting.
- `src/lib/api.ts` uses a single static API_KEY for data routes and an in-memory per-instance rate limiter. This is not a tenant-authentication or serverless-wide quota system.
- `package.json` had a broken start command (`node server.tsx` although the server entrypoint is `server.ts`). The branch changes it to `node --import tsx server.ts`; this must be validated in CI/runtime before release.

## Target architecture

1. **Tenant and identity layer**: authenticated Supabase user, merchant membership, branch/location membership, role-based permissions, server-verified tenant context. Never trust `ownerId`, `storeId`, or provider account IDs supplied by the browser as authorization.
2. **POS connection registry**: provider, merchant, location, encrypted credentials, scopes, status, last successful sync, cursor, error state, created/rotated/revoked timestamps.
3. **Adapter contract**: provider-specific adapters implement OAuth/connect, capability discovery, menu import, inventory/availability, order create/read/cancel, webhook verification, and health checks. Unsupported capabilities must be explicit.
4. **Canonical catalog**: categories, products, variants, modifier groups/options, taxes, prices, availability, images, provider IDs and source version. Preserve source IDs and provenance; do not overwrite POS-managed data with stale local copies.
5. **Order orchestration**: validate items, modifiers, branch, hours, price and availability server-side; calculate totals from trusted catalog; require guest confirmation; create an idempotent order; dispatch to POS; reconcile status; handle retries and dead letters.
6. **Events and synchronization**: verified provider webhooks, durable queue/outbox, deduplication, replay protection, retries with backoff, reconciliation polling and audit log.
7. **Generic integration**: versioned REST API, signed webhooks, test/sandbox mode, API credential rotation and developer docs for POS vendors without a native adapter.
8. **Commercial SaaS operations**: plans, per-tenant limits, usage metering, billing lifecycle, observability, alerts, backups, incident procedures and support tooling.

## Delivery phases and acceptance criteria

### P0 — Stop unsafe production behavior
- Replace broad anonymous order policies with a guest capability-token design (store only token hashes; guest may read only the matching order; guest cannot update status).
- Move all order status transitions and order deletion to authenticated server-side operations with merchant/branch authorization.
- Enforce tenant scoping in every menu, knowledge, settings, order and analytics query. Missing tenant identity must fail closed.
- Remove browser reliance on a shared static admin API key. Verify Supabase JWT server-side and derive tenant membership from trusted database records.
- Add rate limits and abuse controls to Gemini token and TTS endpoints; enforce per-tenant usage budgets.
- Fix OAuth install flow so it cannot claim installation without a verified provider grant and successful persistence.
- Correct the production start command (change already made on this branch; validate it).

**Gate:** no cross-tenant reads/writes; no anonymous order enumeration/status mutation; no unmetered public AI endpoint.

### P1 — Real application data
- Implement real Supabase-backed orders, conversations, analytics, user and webhook-settings endpoints.
- Validate input with schemas; use transactions/RPC for order creation and status transitions.
- Add database migrations, constraints, indexes and tenant-aware RLS tests.
- Add idempotency keys and audit records for all order mutations.

**Gate:** integration tests prove persisted CRUD, tenant isolation and correct analytics against seeded data.

### P2 — POS platform foundation
- Add the canonical adapter interfaces and capability model.
- Add connection lifecycle, encrypted secrets, token refresh/revocation, per-location connections and sync state.
- Add durable event inbox/outbox and webhook delivery verification.
- Publish versioned generic REST API and webhook contracts.

**Gate:** a fake/sandbox adapter can sync a menu and accept an order end-to-end with retries and idempotency.

### P3 — Native POS integrations
Prioritize based on restaurant customer demand and actual partner/API access. Candidate adapters to evaluate include Foodics, Odoo POS, Oracle Simphony, Toast, Square, Clover, Lightspeed, Revel, Shopify POS, Salla and custom POS vendors. This is a candidate list, not a claim that all provide open APIs or approve access.

For every vendor, document: supported countries, partner approval, API scopes, OAuth method, menu/modifier model, tax/discount semantics, order submission, status callbacks, rate limits, sandbox availability and certification requirements.

**Gate:** each adapter passes vendor-specific sandbox/certification tests and production credentials are separately approved.

### P4 — Merchant experience
- POS directory with capability matrix, connection wizard, location selection and clear permission disclosure.
- Menu mapping/preview, conflict resolution, sync history, test order and connection health.
- Manual fallback and safe disconnect/reconnect behavior.

### P5 — Commercial launch
- Billing plans and usage metering, tenant quotas, invoices/payment provider, support console, monitoring, backups, security review, load tests and incident runbooks.
- Staged rollout: internal sandbox → pilot restaurants → limited production → general availability.

## Non-negotiable order flow

Customer voice intent → resolve canonical product and modifiers → check availability and branch → calculate trusted price/tax → read back the complete order → explicit customer confirmation → create idempotent local order → dispatch to POS → persist provider order ID → reconcile status → notify customer and restaurant.

If the POS is unavailable, do not silently claim the order reached the cashier. Show a clear pending/manual-confirmation state and alert restaurant staff.

## Known unknowns / external dependencies

Native POS integrations cannot be completed by code alone. Each provider may require a partner agreement, merchant authorization, approved scopes, sandbox credentials, certification and country-specific access. Do not store production credentials in GitHub or expose them to the browser. Configure secrets only in the deployment secret manager.
