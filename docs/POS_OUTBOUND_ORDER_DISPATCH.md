# POS outbound order dispatch

SooVoice writes every secure guest checkout to `orders` and `order_outbox` in the same database transaction. This worker claims those events with a database lease, resolves the merchant-approved menu mappings, and sends a signed canonical order to a merchant-operated POS bridge.

## What this milestone supports

- A provider-neutral HTTPS webhook bridge that can sit in front of Foodics, Toast, Square, Clover, Odoo, or another POS.
- Encrypted per-connection `orderWebhookUrl` and `orderWebhookSecret` credentials.
- Merchant-approved menu-to-POS item mappings and branch currency checks before dispatch.
- A stable idempotency key (`soovoice:<localOrderId>`) for safe delivery retries.
- Database leases, retry backoff, and dead-letter handling using the existing outbox RPCs.

This is **not** a native API adapter for every listed POS vendor. The merchant's middleware must translate the canonical payload into that vendor's API and return an explicit acceptance response. Direct OAuth/API adapters remain separate provider-specific work.

## Configure a connection

When creating the connection, include these encrypted JSON credential fields in addition to any provider-specific credentials:

```json
{
  "orderWebhookUrl": "https://middleware.example.com/soovoice/orders",
  "orderWebhookSecret": "REPLACE_WITH_A_RANDOM_SECRET_OF_AT_LEAST_32_CHARACTERS"
}
```

Then:

1. Save the connection.
2. Map the provider's branch in POS integrations and set its currency.
3. Import/sync the provider catalog.
4. Approve a menu mapping for every menu item that may appear in guest orders.
5. Configure the middleware to accept the signed order contract below.
6. Configure the inbound webhook secret separately if you also want catalog/status updates.

For safety, the current dispatcher requires exactly one connected POS connection with outbound webhook credentials and exactly one active branch for that merchant. If zero or multiple destinations are configured, the order remains in retry/dead-letter handling instead of being sent to an arbitrary branch. Multi-connection and multi-branch routing UI is a subsequent milestone.

## Outbound request contract

The worker sends `POST` to `orderWebhookUrl` with JSON:

```json
{
  "version": 1,
  "eventType": "order.created",
  "occurredAt": "2026-11-18T10:05:00.000Z",
  "idempotencyKey": "soovoice:order_abc123",
  "order": {
    "localOrderId": "order_abc123",
    "merchantId": "merchant-uuid",
    "locationId": "provider-branch-id",
    "currency": "EGP",
    "fulfillment": "dine_in",
    "tableReference": "12",
    "notes": null,
    "customer": null,
    "lines": [
      {
        "catalogItemId": "local-menu-item-id",
        "providerItemId": "provider-item-id",
        "quantity": 2,
        "modifierOptionIds": []
      }
    ]
  }
}
```

Headers:
- `x-soovoice-timestamp`: Unix seconds.
- `x-soovoice-signature`: `sha256=<hex>`, HMAC-SHA256 over the exact bytes `<timestamp>.<raw HTTP body>`, using `orderWebhookSecret`.
- `x-soovoice-event-id` and `idempotency-key`: stable `soovoice:<localOrderId>`.
- `x-soovoice-event-type`: `order.created`.

The middleware must verify the signature against the raw request bytes and atomically deduplicate by idempotency key. It must return HTTP 2xx and JSON `{"status":"accepted","providerOrderId":"vendor-order-id"}` only after the POS has accepted the order. A `pending` response, rejected response, malformed acknowledgement, timeout, or non-2xx status is not marked delivered. If the middleware accepted the order but its response was lost, it must return the same provider order ID for the repeated idempotency key.

The dispatcher uses HTTPS only, rejects IP-literal/private destinations, pins DNS resolution to a checked public address, does not follow redirects, and enforces an 8-second timeout and 32 KB response limit.

## Run the worker

Set the following server-side environment variables:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `POS_CREDENTIALS_ENCRYPTION_KEY` (base64-encoded 32-byte key)
- `POS_OUTBOX_WORKER_SECRET` (random secret, at least 32 characters)

The included GitHub Actions workflow calls the protected endpoint every five minutes. Add these repository Actions secrets to enable it:\n\n- `POS_OUTBOX_WORKER_URL` (the HTTPS application origin, without `/api/...`).\n- `POS_OUTBOX_WORKER_SECRET` (the same secret configured on the server).\n\nYou can also call the endpoint from another trusted scheduler:

```http
GET /api/pos/outbox/dispatch
Authorization: Bearer <POS_OUTBOX_WORKER_SECRET>
```

The endpoint claims up to 10 events with a 120-second lease. It is safe to run multiple workers because the database claim uses `FOR UPDATE SKIP LOCKED`. Do not expose the worker secret to the browser or call this endpoint from the public storefront. The included GitHub Actions scheduler remains idle until both repository secrets are configured.

## Retries and operations

The existing database retry function applies exponential backoff and moves events to `dead_letter` after the configured maximum attempts. Common error codes include:

- `POS_ORDER_TARGET_NOT_CONFIGURED`: add the outbound URL and secret to the encrypted connection credentials.
- `POS_ORDER_TARGET_AMBIGUOUS` / `POS_ORDER_LOCATION_AMBIGUOUS`: only one outbound destination is supported by this initial routing milestone.
- `POS_MENU_ITEM_NOT_MAPPED`: approve the menu-to-provider mapping.
- `POS_CATALOG_ITEM_UNAVAILABLE`: sync the catalog or make the POS item available.
- `POS_ORDER_CURRENCY_MISMATCH`: align branch and catalog currency.
- `POS_ACCEPTANCE_PENDING`: middleware has not yet confirmed POS acceptance.

No credentials, signatures, full webhook bodies, or customer details should be written to application logs. No new SQL migration is introduced by this worker; it relies on the outbox lease and POS catalog/mapping migrations already present in the prerequisite POS branch.
