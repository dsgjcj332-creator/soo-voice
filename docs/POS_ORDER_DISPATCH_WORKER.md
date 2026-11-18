# POS order dispatch worker

How a guest order travels from SooVoice to the restaurant's point of sale,
and what happens when delivery fails.

## Flow

1. **Order creation.** Guest checkout writes the order row and one
   `order_outbox` event (`status='pending'`) in the same database transaction.
2. **Scheduled dispatch.** Vercel cron calls `GET /api/pos/outbox/cron` every
   two minutes (`vercel.json → crons`). The platform injects the
   `CRON_SECRET` bearer token; calls without it are rejected (401), and the
   endpoint is disabled (503) until `CRON_SECRET` is configured.
3. **Batch processing.** The endpoint runs `processOrderOutboxBatch` with a
   `SupabaseOutboxStore`: events are leased (`claim_order_outbox`), resolved
   to the merchant's POS connection (routes → connection → location → menu
   mappings), and delivered through the provider's order webhook.
   A `pending` provider response stays retryable; only an explicit `accepted`
   completes the event (`complete_order_outbox`).
4. **Retries and dead letters.** Failed deliveries call `retry_order_outbox`;
   events keep retrying with backoff until attempts are exhausted, then move
   to `dead_letter`.
5. **Merchant alerting.** After every batch the endpoint syncs one
   `pos_dispatch_alerts` row per dead-lettered event (idempotent on
   `event_id`). Merchants read their own alerts through owner-scoped RLS;
   alert rows cannot be created or modified from clients.

## Manual worker invocation

Operators (or an external scheduler) can also call the original endpoint:

```
POST /api/pos/outbox/dispatch
Authorization: Bearer $POS_OUTBOX_WORKER_SECRET
```

`GET` is supported as well. This path requires `POS_OUTBOX_WORKER_SECRET`
(≥ 32 chars) and is independent of the cron secret.

## Required environment variables

| Variable | Used by | Purpose |
| --- | --- | --- |
| `CRON_SECRET` | `/api/pos/outbox/cron` | Vercel cron bearer token |
| `POS_OUTBOX_WORKER_SECRET` | `/api/pos/outbox/dispatch` | manual worker bearer token |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_ANON_KEY` | dispatch pipeline | database access |
| `POS_CREDENTIALS_ENCRYPTION_KEY` | credential decryption | provider credentials |

## Status parity

Outbound delivery completion marks the outbox event `delivered` and stores
the provider order id. Inbound status changes arrive through the POS order
status webhook (`2026_12_02_pos_order_status_webhook.sql`), which updates the
local order state that the kitchen display reads. End-to-end parity between
SooVoice, the POS and the kitchen is verified per provider in the production
readiness phase.
