# Guest Order Rate-Limit Readiness

The public guest checkout route calls the service-role-only
`consume_guest_order_rate_limit` RPC before creating an order.

- Per merchant: 120 requests per 60-second window by default.
- Per client and merchant: 20 requests per 60-second window by default.
- Bucket identifiers are HMAC-SHA256 values derived with the server-only
  `ORDER_TOKEN_SECRET`; raw client IPs are never persisted.
- Atomic database counters share enforcement across serverless instances.
- If the RPC or migration is unavailable, checkout fails closed with HTTP 503.
  It does not silently fall back to per-instance-only enforcement.
- Exceeded limits return HTTP 429 with `Retry-After: 60`.

## Deployment order

1. Apply `sql/2026_11_25_guest_order_rate_limits.sql` in Supabase Staging.
2. Verify service-role-only grants and run the rate-limit cases in
   `tests/pos-migrations-integration.sql`.
3. Deploy both the Vercel standalone handler and the local Express handler.
4. Confirm normal checkout, duplicate idempotent retry, per-client 429,
   per-merchant 429, and fail-closed behavior when the RPC is unavailable.
5. Apply the migration in production before deploying the API code.

These conservative defaults are not a substitute for a WAF or provider-level
DDoS protection. Tune them from observed legitimate traffic before a large launch.
