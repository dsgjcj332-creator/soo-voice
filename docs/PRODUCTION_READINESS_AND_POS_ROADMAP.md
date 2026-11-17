# SooVoice production readiness and multi-POS roadmap

## Product direction

SooVoice is a multi-tenant voice-ordering and restaurant integration platform. POS is a first-class integration category, not a single-vendor feature. The platform must support independent adapters for each POS vendor and a documented generic integration path.

## Current repository findings (main branch snapshot reviewed)

- `src/lib/api.ts` returns placeholder empty arrays/zero analytics for orders, conversations and analytics; order PATCH/DELETE report success without persistence.
- `src/lib/api.ts` OAuth callback acknowledges receipt but does not exchange the authorization code or persist credentials.
- Product/order/uninstall webhook handlers only log messages and acknowledge; they do not enqueue durable sync work.
- `src/pages/OAuthInstall.tsx` creates a random merchant id and inserts a merchant record without validating a provider-issued OAuth grant; it can show success even when the insert returns an error because the Supabase error is not checked.
- `src/pages/Integration.tsx` is currently a generic outbound webhook + widget embed screen, not a POS connector marketplace. Its test request is not signed with the configured HMAC protocol.
- Guest checkout previously read merchant webhook settings in the browser and sent the webhook secret in the outgoing JSON body. The development branch removes this client-side secret exposure. The Connections screen no longer reads/displays webhook signing secrets or sends test webhooks directly from the browser; signed delivery and testing must be implemented by a trusted server-side outbox.
- `src/components/widget/VoiceWidget.tsx` reads the merchant identifier from query parameters and loads menu rows directly from Supabase. A URL parameter is not proof of tenant authorization. The development branch now fails closed and does not issue a menu query when the merchant identifier is absent; public menu visibility still depends on correctly configured Supabase RLS.
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
- Replace the remaining browser-side `orders` insert with a trusted server endpoint. It must resolve the merchant from a public store identifier, fetch authoritative item/modifier prices and availability, recalculate totals, enforce limits/idempotency, and write the order plus outbox record atomically.
- Move all order status transitions and order deletion to authenticated server-side operations with merchant/branch authorization. A first SQL hardening migration and safer setup script now remove broad anonymous access; apply and verify them in a staging Supabase project before rollout.
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
- Add a tenant-scoped POS connection/location registry, encrypted-credential storage contract, webhook event inbox, and POS order-link/idempotency tables. Writes are reserved for trusted server-side code; authenticated merchants have read-only access to their own records.
- Add connection lifecycle, encrypted secrets, token refresh/revocation, per-location connections and sync state.
- Add durable event inbox/outbox and webhook delivery verification.
- Publish versioned generic REST API and webhook contracts.

**Gate:** a fake/sandbox adapter can sync a menu and accept an order end-to-end with retries and idempotency. The new registry migration must first pass Supabase migration and cross-tenant foreign-key/RLS tests.

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


## Secure guest checkout implementation checkpoint (2026-11-17)

Implemented on `feat/secure-guest-checkout`:

- Guest browser sends only merchant ID, item IDs, quantities, table number and an idempotency key. It does not submit item names or prices.
- A server-only API uses the Supabase service role and a database RPC to re-read merchant-owned, non-AI-only menu item names/prices and atomically create the order plus an `order.created` outbox event.
- The API derives a per-order capability token with a server-side HMAC key; only its SHA-256 hash is stored. Guest tracking reads only the matching order after presenting the token in a request header; tokens expire after seven days.
- Repeated requests with the same idempotency key and same cart return the existing order; reusing that key with a different cart is rejected.
- StoreDemo checkout and status polling now use the trusted endpoints instead of direct browser inserts or anonymous orders-table reads.

Required deployment work before enabling this flow:
1. Apply `orders_setup.sql` if needed, then the order RLS hardening, POS registry, and secure guest checkout migrations in a staging Supabase project.
2. Configure server-only `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and a random `ORDER_TOKEN_SECRET` (32+ characters). Never add the service role key to a `VITE_*` variable.
3. Verify the deployed `menu_items` schema uses the expected `id`, `ownerId`, `name`, `price`, and `isAiOnly` columns and that price values are numeric.
4. Add distributed abuse/rate limiting before public launch; current IP limits are per serverless instance.
5. Implement and operate an outbox worker, delivery retries/dead-letter handling, POS adapter execution, and order status reconciliation. An outbox row is not proof that a POS accepted an order.

Current limits:
- Catalog availability, modifiers, discounts, tax, service charges, branch selection and currency are not yet modeled in the existing `menu_items` schema and are not guessed by this endpoint.
- Orders are durably recorded locally but are not yet dispatched to a real POS. No vendor adapter is connected.
- Guest capability tokens are held in page memory for the current checkout/tracking session; refreshing the page loses the guest's tracking capability.
- The migration and endpoint still require staging database execution, security tests, and successful CI/deployment checks before production use.


## Outbox worker foundation checkpoint (2026-11-17)

Added the leased outbox lifecycle to the secure checkout migration:
- `claim_order_outbox` atomically claims due rows using `FOR UPDATE SKIP LOCKED`, with bounded batch size and lease duration.
- Expired processing leases can be reclaimed by another worker.
- `complete_order_outbox` requires the active lease, verifies that the POS connection belongs to the event's merchant and is connected, verifies the optional active location, and persists the provider order ID in `pos_order_links` before marking the event delivered.
- `retry_order_outbox` requires the active lease, increments attempts, applies exponential backoff (capped at one hour), and moves exhausted events to `dead_letter`.
- Added an injectable server-side batch processor. It marks an event delivered only after the provider explicitly returns `accepted` with a provider order ID. Pending/rejected/error responses are retried.
- Added tests for accepted, pending, missing-connection and invalid-batch cases.

**Not yet an operating worker:** no provider adapter is registered, no connection credential encryption/decryption or connection-to-order routing policy exists, and no scheduled worker is deployed. The batch processor is an execution core, not proof that orders are currently delivered. Do not manually mark outbox rows delivered. Before enabling a worker, implement authenticated merchant location/connection selection, server-side secret decryption, adapter registration, a scheduled runner protected by a dedicated worker secret, and end-to-end sandbox tests.


## POS credential encryption checkpoint (2026-11-17)

Added a server-only AES-256-GCM utility for POS credential objects. It uses a fresh 96-bit IV per encryption, an authentication tag, version-bound additional authenticated data, and a versioned envelope stored in the existing `pos_connections.credentials_ciphertext` plus `credentials_key_version` fields. Invalid/missing keys, version mismatches, malformed envelopes and authentication failures fail closed. Tests cover round-trip, nonce uniqueness, tampering, key-version mismatch and invalid inputs.

This is an encryption primitive only: no connection-management endpoint, merchant authorization flow, credential persistence, key-ring rotation, provider adapter or scheduled worker is implemented by this checkpoint. The deployment key must be generated and stored in the server secret manager. Before storing live credentials, implement an authenticated server route that derives the merchant from a verified session and never returns decrypted credentials.


## Authenticated POS connection API checkpoint (2026-11-17)

Added `GET /api/pos/connections` and `POST /api/pos/connections`. Both require a Supabase Bearer access token and verify it with the Supabase Auth `/auth/v1/user` endpoint. The owner ID is taken from the verified user response, never request data. Creation accepts an allowlisted provider ID, optional display name and a non-empty credentials object capped at 16 KiB; credentials are encrypted before writing to `pos_connections`. List and create responses use explicit metadata allowlists and never return credential ciphertext or plaintext. Requests fail closed unless the server has the Supabase URL, anon key, service-role key and POS encryption key configured.

This does not yet validate vendor-specific credential formats, connect to a provider, create branch records, decrypt credentials for a worker, or mark a connection connected. Newly created connections deliberately remain `pending`. The UI must send the current Supabase session access token; local demo users are not accepted as authenticated merchants.


## Merchant POS management checkpoint (2026-11-17)

The Integrations page now embeds a bilingual merchant panel for creating/listing POS connections and manually mapping/listing/deactivating branches. Deactivation is a soft state change so existing order history is retained. The authenticated endpoints derive the tenant from a verified Supabase session; branch create/delete operations are scoped to that tenant, and branch creation verifies connection ownership. Credential values are encrypted before persistence and are never returned in API responses. Shared branch-input validation has unit tests for UUIDs, required fields, length limits, IANA timezones and currency codes.

This is still configuration management, not a live provider integration. Branch discovery remains manual; no vendor-specific credential validation, health check, OAuth, menu sync, provider order delivery, adapter registration or scheduled worker is available. Newly saved connections stay `pending`. The migration `sql/2026_11_18_multi_pos_registry.sql` must be applied in the target Supabase project before these routes can work. CI and deployment checks must pass before this work is considered verified.


## Outbox lease-expiry hardening checkpoint (2026-11-17)

Added `sql/2026_11_20_enforce_outbox_lease_expiry.sql` as a follow-up migration. The original worker lifecycle identified expired leases for reclaim, but completion/retry only checked the worker ID; a slow worker could therefore attempt to acknowledge an event after its lease deadline if no other worker had reclaimed it yet. The new migration stores `lease_expires_at`, sets it atomically when claiming, permits reclaim only after expiry, and requires an unexpired lease for both completion and retry. Completion/retry clear all lease fields. Existing processing rows with missing lease metadata are safely returned to pending; existing active leases receive a bounded fallback expiry.

Apply this migration after `2026_11_19_secure_guest_checkout.sql` in staging and test two-worker contention, expiry, reclaim, and stale-worker completion/retry rejection before enabling any worker. This is a SQL hardening change only; it does not deploy a worker or connect a provider adapter.


## Canonical POS catalog validation checkpoint (2026-11-17)

Added `src/lib/pos/catalog-normalizer.ts` as a strict boundary for vendor adapters to map external menu payloads into SooVoice's canonical `PosCatalogItem` contract. It bounds payload sizes and text lengths; validates currency codes, finite/non-negative item prices, signed modifier price deltas, timestamps, location IDs, provider item IDs, modifier IDs and selection constraints; and returns copied, normalized records with ISO timestamps. Duplicate provider item, branch, modifier-group and modifier-option identifiers are rejected rather than silently overwritten.

Added `tests/pos-catalog-normalizer.test.ts` for valid normalization, signed modifier deltas, invalid currency/prices/timestamps, duplicate IDs, invalid modifier rules and malformed payloads.

This is an adapter-facing validation layer only. It does not claim that any vendor adapter is registered, does not fetch a provider menu, and does not persist/synchronize the catalog. A real provider adapter and staging integration tests are still required.


## POS catalog synchronization planner checkpoint (2026-11-17)

Added a pure, deterministic catalog sync planner for one manually mapped provider location. It keys records by provider item ID within the caller's connection/location scope and emits create, update, unchanged, stale and deactivate operations. Older provider timestamps are rejected; equal timestamps with different content are treated as ambiguous/stale rather than overwriting data. Deactivation is emitted only when the caller explicitly declares the provider response to be a complete snapshot, so paginated or partial fetches cannot accidentally hide products.

The planner's content fingerprint is a compact change detector, not a cryptographic integrity primitive. It only describes POS-owned catalog fields; persistence code must keep merchant-authored fields/overrides separate and must scope every database read/write by verified owner, connection and mapped location. No catalog table, database write path, provider fetcher, scheduled sync or live menu import is added by this checkpoint.


## Durable POS catalog storage checkpoint (2026-11-17)

Added `sql/2026_11_21_pos_catalog_storage.sql` with a tenant-scoped `pos_catalog_items` table linked by composite owner/connection/location foreign keys. Merchants may read only their own rows; browser writes are revoked. A service-role-only atomic RPC validates the connection is actually `connected`, verifies the mapped location is active and belongs to that connection/merchant, upserts only strictly newer provider timestamps, marks stale incoming IDs as seen without overwriting newer stored content, and deactivates missing products only for an explicitly complete snapshot.

Added `src/lib/pos/catalog-persistence.ts` as a narrow persistence boundary: it validates tenant/connection/location UUIDs, runs the canonical catalog normalizer, filters to the selected provider location, and calls only the privileged RPC. Unit tests cover scope validation, filtering, malformed payload rejection, safe RPC error handling and explicit empty complete snapshots.

This is storage and a server-side persistence primitive, not a live sync feature. No API route currently invokes it, no provider adapter fetches menus, and no scheduled synchronization is running. Apply the migration in staging and test RLS, service-role authorization, timestamp conflicts, tenant/location isolation and complete-versus-partial snapshot behavior before wiring a provider.


## Merchant-reviewed POS menu import checkpoint (2026-11-17)

Added `src/lib/pos/catalog-review-planner.ts` as a read-only proposal layer between a future provider snapshot and the merchant's menu. It classifies proposed additions, ordinary field updates, merchant-edit conflicts, unchanged/stale provider rows, and products missing from an explicitly complete snapshot. Per-field merchant override flags protect locally curated names, descriptions, prices, availability and categories; conflicting provider values are shown as proposals rather than silently applied. The planner always marks the result as requiring merchant approval and performs no database writes.

Added `tests/pos-catalog-review-planner.test.ts` for new products, protected fields, ordinary updates, partial/complete snapshot removal behavior, stale snapshots and duplicate links.

This is not yet a connected review screen or import action. There is no API route fetching a real provider snapshot, no persisted merchant override schema, and no UI to approve/reject proposals. Until those pieces exist, the review planner is a tested pure foundation only; it must not be represented as live POS menu synchronization.


## CI test repair checkpoint (2026-11-17)

The first CI retry reached the test suite after dependencies installed successfully. It exposed two test-only defects: the POS credential test had an unmatched closing delimiter, and the catalog persistence test expected the wrong validator error code for a malformed catalog row. Both test files were corrected to match the actual implementation. The next CI run must confirm the full suite, TypeScript check and production build; no pass is claimed yet.
