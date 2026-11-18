# POS webhook secret operations

Each POS connection has its own inbound webhook secret. The merchant creates or rotates it from **POS integrations → Generate / rotate webhook secret**.

- The secret is generated server-side from 32 cryptographically random bytes and encoded as base64url.
- The server preserves all provider credentials, replaces only `webhookSecret`, and re-encrypts the object with AES-256-GCM.
- Plaintext is returned only in the successful rotation response with `Cache-Control: no-store` and `Pragma: no-cache`. It is never included in connection-list responses, plaintext database columns, or logs.
- The UI holds the secret only in component memory and offers a copy action. Reloading or hiding removes it from the UI. If lost, rotate again.
- Rotation immediately invalidates the previous secret. Update the POS provider's webhook configuration before expecting further deliveries.

## Activating inbound webhooks

After creating the connection:

1. Add at least one active branch with the provider's exact branch/location ID.
2. Generate the per-connection webhook secret and copy it once.
3. Configure the provider or merchant middleware to POST the canonical webhook contract to the URL shown in POS integrations, using the secret for HMAC signing.
4. In SooVoice, choose **Activate inbound webhooks** and confirm that the provider/middleware has been configured.

The activation endpoint verifies merchant ownership, the encrypted webhook secret, and at least one active branch before changing the connection from pending/degraded to connected. It does not test a live provider handshake and does not install provider-side webhook subscriptions.

**Scope:** activation enables inbound catalog snapshots (and canonical order-status events when that endpoint version is deployed). It does not enable outbound order creation; that still requires a provider-specific order adapter and worker.

## Signing

For each delivery send `x-pos-event-id`, `x-pos-event-type`, `x-pos-timestamp`, and `x-pos-signature: sha256=<hex>`. Compute HMAC-SHA256 over the UTF-8 timestamp, a literal dot, and the exact raw HTTP body bytes. The webhook ingress validates the digest with a timing-safe comparison and a five-minute timestamp window.

## Safeguards and limits

- Rotation requires a verified merchant session and scopes lookup/update to the authenticated owner.
- An optimistic ciphertext match prevents a concurrent credential update from being overwritten.
- The encrypted credential key version must be available to the deployment. Cross-version key-ring migration is not part of this change.
- Rotation does not automatically register webhook subscriptions with POS vendors.
