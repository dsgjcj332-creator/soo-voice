# POS sandbox adapter and end-to-end gate

## Purpose

The in-memory sandbox adapter is a test/developer fixture for proving SooVoice's provider-neutral adapter contract before connecting a real POS account. It is not a vendor integration, does not make network requests, and must never be registered in the production adapter registry.

## Included scenario

- One active sandbox branch and one seeded EGP catalog item with a required size modifier.
- Capability discovery, health check, branch discovery and normalized catalog read.
- Server-shaped order submission with merchant, branch, item, quantity, modifier and currency validation.
- Explicit accepted response with a deterministic provider order reference.
- Idempotent retry: identical request + key returns the original provider reference; changed payload with the same key is rejected.
- Tenant and branch mismatch rejection.

## Automated verification

Run `npm run test:pos`. The sandbox tests run through the same `PosAdapter` contract and the read-only conformance harness. They do not create real orders or contact any provider.

## What this does not close

A real POS integration still requires:
1. Vendor-approved API access and sandbox/production credentials.
2. A provider-specific adapter for OAuth/API-key authentication, token refresh, pagination, rate limits, menu/modifier/tax mapping and order submission.
3. A trusted worker deployment that resolves the merchant's active connection and mapped branch, decrypts credentials server-side, dispatches the durable outbox, and reconciles provider order status.
4. Verified webhook subscription setup or scheduled polling for catalog/order updates.
5. Supabase Staging migration/RLS validation and deployment-secret configuration.

The merchant's final cashier test remains the last external acceptance step after the above provider-specific work and credentials are available.
