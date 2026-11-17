# SooVoice Launch-Day Readiness

Last reviewed: 2026-11-18

This document separates implemented product behavior from items that still require infrastructure, provider credentials, or a real staging test. A green CI run is not proof that production services are configured.

## Included in the launch-readiness batch

- Conversation list synchronization now merges Realtime inserts and updates, removes deleted rows, and replays changes received during the initial fetch.
- Conversation review includes search, status filtering, CSV export, and a detail view for transcript/audio fields when those fields are actually present. Missing media is not fabricated.
- Dashboard overview includes a daily operations checklist linking to the kitchen, conversations, digital menu, voice studio, and integrations.
- The daily checklist is intentionally stored in the current browser, per merchant and local calendar day. It is not yet a shared, database-backed team task system.
- Merchant administration now merges Realtime events, handles deletes, reports database errors, and provides working search/status filters.
- Merchant approval/block/delete operations now fail visibly when Supabase reports an error instead of silently appearing successful.
- Admin settings writes now propagate Supabase errors.
- The /admin UI routes require a trusted Supabase app_metadata.role = admin claim or app_metadata.roles containing admin. User-editable user_metadata is not trusted for this decision.
- Billing no longer pretends a local button click activates a subscription. Paid plan prices are shown as unconfirmed and subscription buttons remain disabled until real billing is connected.

## Not ready to claim as live

- Automated subscription creation, payment collection, invoices, refunds, coupons, timed promotions, and the first-10-restaurants founding offer are not implemented by this batch.
- The paid plan amounts and limits still require product approval and cost validation.
- The admin UI route check is not a replacement for database RLS or server-side authorization. Confirm that merchants, system_settings, and all admin data tables are protected by trusted admin-only database policies before exposing admin capabilities.
- Real POS providers are not connected merely because the provider-neutral webhook and adapter infrastructure exists. Provider credentials, per-provider adapters, field mapping, and staging tests remain necessary.
- Conversation recordings/transcripts only work when the corresponding fields and authorized storage URLs are actually supplied by the backend.
- The dashboard checklist is local to one browser; it does not synchronize across team members.

## Required production release checks

1. Deploy to a staging environment with the intended production-like Supabase project and verify authentication/session refresh.
2. Confirm tenant isolation for restaurants, menus, conversations, and orders using two separate merchant accounts.
3. Verify the live voice flow with the real server-side Gemini configuration; confirm missing credentials fail visibly and no secret is exposed to the browser.
4. Complete a real end-to-end guest order: menu item selection, server-side price calculation, order persistence, kitchen visibility, status update, and guest tracking. Verify retries do not duplicate orders.
5. Confirm storage permissions for recordings and transcripts; test that one merchant cannot access another merchant's media.
6. Confirm trusted admin claims and admin-only RLS with a normal merchant account and an administrator account.
7. Configure production environment variables, domain, HTTPS, logging/alerts, backups, and rollback procedure.
8. Run the full GitHub Actions suite and smoke-test the deployed build on desktop and mobile.
9. Keep live POS cashier certification as the final integration test, after the non-POS MVP has passed.

## Suggested safe launch scope

A limited pilot can launch without automated billing or live POS only if the owner explicitly accepts a manual founding-customer process, all required staging checks above pass, and the customer-facing site clearly explains which capabilities are available. Do not advertise automatic payments, universal POS connectivity, or fully automated subscription management until those flows are implemented and verified.
