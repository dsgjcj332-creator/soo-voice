# Foodics API access and SooVoice onboarding

## What is implemented in this release

The Connections page has a dedicated Foodics API token field. The API accepts only an `apiToken` credential for a Foodics connection and stores it using the existing server-side AES-256-GCM credential envelope. The browser never receives the saved token back.

Saving the token creates a **pending** connection record. It does not verify the token, discover branches, sync the catalog, create orders, or mark Foodics as connected. Those capabilities must be enabled only after the provider-specific adapter and sandbox verification are complete.

## Obtain access from Foodics

Foodics' integration guidance says the request must be approved by the account owner and should identify the application and required API scopes. The API token is account-level rather than branch-specific, so the integration must apply branch filtering when using it.

Official references:
- https://apidocs.foodics.com/
- https://developers.foodics.com/
- https://apidocs.foodics.com/core/scopes.html
- https://sites.google.com/foodics.com/coe-foodics/product-knowledge/foodics-integration/support-sop/personal-integration

Before requesting access, describe SooVoice as a voice ordering and menu synchronization application. Request only the scopes needed for the intended features:
- Read branches/locations.
- Read categories, products, modifiers and modifier options.
- Create orders.
- Read order status if status synchronization is required.
- Webhook/event access only if the Foodics account and app approval support it.

Confirm the exact scope identifiers with Foodics; this document intentionally does not invent scope strings.

## Merchant steps

1. Ask the Foodics account owner to request/approve SooVoice integration access with Foodics.
2. Confirm the API token and scopes issued by Foodics.
3. In SooVoice, open Integrations and select Foodics.
4. Paste the token into the dedicated password field and save.
5. Treat the connection as pending until native adapter verification is delivered in a later release.

## Security and rollout notes

- Keep `POS_CREDENTIALS_ENCRYPTION_KEY` configured in the server secret store.
- Never paste the token into chat, issue comments, logs, screenshots, or source code.
- The token can access the Foodics account across branches. Branch filtering is an application responsibility.
- Do not activate inbound/outbound bridge controls as a substitute for the native Foodics adapter.
- Do not label the connection as connected until a server-side token check and staging tests have succeeded.
