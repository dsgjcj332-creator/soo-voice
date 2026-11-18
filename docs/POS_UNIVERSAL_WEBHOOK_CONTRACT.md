# POS universal webhook contract

SooVoice exposes a provider-neutral catalog snapshot ingress for POS systems that can send outbound webhooks or for merchant-operated middleware that can translate a vendor event.

## Endpoint

`POST /api/pos/webhooks/:connectionId`

Headers:
- `x-pos-event-id`: stable provider event ID (1–160 characters).
- `x-pos-event-type`: currently `catalog.snapshot`.
- `x-pos-timestamp`: Unix timestamp in seconds.
- `x-pos-signature`: `sha256=<hex>`, HMAC-SHA256 over the exact bytes `<timestamp>.<raw HTTP body>`.

The connection's encrypted credentials must contain a `webhookSecret` string of at least 32 characters. The secret is decrypted only on the server. Never put it in a URL, log, browser response, or event payload.

## JSON body

```json
{
  "providerLocationId": "vendor-branch-123",
  "completeSnapshot": false,
  "items": [
    {
      "id": "vendor-product-42",
      "providerId": "vendor-product-42",
      "locationIds": ["vendor-branch-123"],
      "name": "Example product",
      "description": "Optional description",
      "currency": "EGP",
      "unitPrice": 125,
      "available": true,
      "modifierGroups": [],
      "updatedAt": "2026-11-17T10:00:00.000Z"
    }
  ]
}
```

Each item must satisfy SooVoice's canonical catalog normalizer. Set `completeSnapshot` to true only when the payload contains the full catalog for that mapped branch; partial updates must use false. Provider-specific payloads must be translated into this contract by a vendor adapter or middleware.

## Order status events

The same endpoint accepts `x-pos-event-type: order.status` for a provider order that SooVoice previously submitted and linked to the local order.

Example JSON body:

```json
{
  "providerLocationId": "vendor-branch-123",
  "providerOrderId": "vendor-order-987",
  "status": "preparing",
  "occurredAt": "2026-11-18T10:05:00.000Z"
}
```

The `status` field must be one of SooVoice's canonical states: `pending`, `preparing`, `completed`, or `cancelled`. Vendor-specific states must be translated by the vendor adapter or merchant middleware. The provider order ID must match an accepted `pos_order_links` record for this exact connection and branch; a webhook cannot update an arbitrary local order.

Status events are deduplicated by connection and provider event ID. Local order transitions are monotonic: `pending` may advance to `preparing`, `completed`, or `cancelled`; `preparing` may advance to `completed` or `cancelled`; `completed` and `cancelled` are terminal. Late/out-of-order events are acknowledged but cannot regress a terminal order. Completing an order records `completedAt` for the dashboard.

## Delivery guarantees and limits

- HMAC verification uses the raw request body, timing-safe digest comparison, and a five-minute timestamp tolerance.
- The server resolves the connection and active branch from stored database records; request data cannot choose an owner or internal branch ID.
- Event IDs are unique per connection. Duplicate deliveries are acknowledged without applying the catalog twice.
- Event receipt and catalog snapshot sync execute in one database transaction.
- `catalog.snapshot` and `order.status` are supported canonical event types. Provider-specific OAuth, automatic webhook subscription setup, order creation adapters, secret provisioning/rotation UI, and polling adapters remain separate work.
- This bridge does not make every POS vendor compatible automatically. A vendor must support outbound webhooks or have a middleware adapter that can produce this signed canonical contract.
