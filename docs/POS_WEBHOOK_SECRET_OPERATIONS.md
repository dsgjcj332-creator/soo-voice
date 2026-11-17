# POS webhook secret operations

Each POS connection has its own inbound webhook secret. The merchant creates or rotates it from **POS integrations → Generate / rotate webhook secret**.

## One-time secret display

- The secret is generated server-side from 32 cryptographically random bytes and encoded as base64url.
- The API decrypts the connection's existing credential envelope, preserves all provider credentials, replaces only `webhookSecret`, and re-encrypts the complete object with AES-256-GCM.
- The plaintext is returned only in the successful rotation response with `Cache-Control: no-store` and `Pragma: no-cache`. It is not included in connection-list responses, database plaintext columns, logs, or analytics.
- The UI holds the plaintext only in component memory and offers a copy action. Reloading or hiding the secret removes it from the UI. If it is lost, rotate again.
- Rotation immediately invalidates the previous secret. Update the POS provider's webhook configuration before expecting further deliveries.

## Request signing

For each delivery, send:
- `x-pos-event-id`: stable provider event ID.
- `x-pos-event-type`: `catalog.snapshot` for the first supported event.
- `x-pos-timestamp`: Unix seconds.
- `x-pos-signature`: `sha256=<hex>`.

Compute HMAC-SHA256 with the per-connection secret over the UTF-8 timestamp, a literal dot, and the exact raw HTTP body bytes. The API checks the digest with a timing-safe comparison and rejects timestamps outside the five-minute tolerance window.

The endpoint is `POST /api/pos/webhooks/:connectionId`. Never place the secret in a URL, query string, provider payload, or application log.

## Operational safeguards and limitations

- Rotation requires a verified merchant session and filters both the connection ID and owner ID on the server.
- An optimistic ciphertext match prevents a concurrent rotation or credential update from being silently overwritten; retry if the connection changed during rotation.
- The encrypted credential key version must be available to the running deployment. The current encryption helper supports the configured key version; cross-version key-ring migration is a separate key-management task.
- Secret rotation does not create vendor webhook subscriptions automatically. Each vendor adapter or merchant configuration must register the endpoint and signing scheme.
- Only catalog snapshot events are supported in the current ingress milestone. Orders and other event families are not yet enabled.
