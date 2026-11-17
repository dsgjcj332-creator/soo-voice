# OAuth Installation Readiness

## Current behavior

- `/oauth/authorize` is an informational handoff page, not a live OAuth implementation.
- It does not create a merchant row, generate a random merchant identifier, or claim that a store was connected.
- It does not grant provider permissions, exchange authorization codes, or persist provider tokens.
- The page sends the merchant to the Connections area to use an actually available setup flow.

## Requirements before enabling a provider OAuth flow

Each provider must have its own server-side implementation and verification:

1. Register a provider application and store client credentials only in server-side environment variables.
2. Create a cryptographically random, single-use OAuth state bound to the authenticated merchant and intended provider; persist its hash and expiry server-side.
3. Redirect to the provider's official authorization URL with least-privilege scopes and an exact registered redirect URI.
4. On callback, validate state, provider identity, expiry, and one-time use before exchanging the code server-side.
5. Validate the resulting access token against the provider API and discover the merchant's actual store/branch identifiers.
6. Encrypt tokens at rest, store them against the authenticated merchant and provider, and never return secrets to the browser.
7. Record granted scopes, connection status, token expiry, and audit events. Support revocation and token refresh where the provider allows it.
8. Only show a connected/success state after the provider verification and database transaction both succeed.

## Release gate

Do not enable an OAuth button or report a successful installation until the provider-specific callback, token validation, persistence, and staging tests exist. The generic POS webhook/catalog ingress is not equivalent to provider OAuth or order delivery.
