# Merchant billing entitlements

The migration `sql/2026_11_30_merchant_billing_entitlements.sql` adds
`public.get_my_billing_entitlements()`, a caller-scoped database function for
resolving the merchant's latest subscription, plan feature flags, usage limits,
billing period and usage totals.

## Security and access rules

- The function accepts no owner/merchant identifier. It derives the tenant only
  from `auth.uid()`, preventing a caller from requesting another merchant's data.
- Anonymous execution is revoked; authenticated callers and service-role
  workflows may execute it.
- An `active` subscription grants access only while its current period has not
  ended (or when no period end is defined).
- A `trialing` subscription grants access only while `trial_ends_at` is in the
  future. An expired trial, past-due, paused, canceled, incomplete or expired
  subscription does not grant paid access.
- `cancel_at_period_end` does not revoke access early; an active subscription
  remains valid until its period end.
- No subscription returns `has_subscription=false` and `access=false`.
- The result includes plan features and usage limits as configured by an admin,
  plus summed usage records within the effective period.

This is a database entitlement resolver, not yet a global API middleware or a
payment workflow. Feature routes must explicitly call it before granting paid
capabilities. No plan prices, free-tier allowance, grace period, trial length,
or payment provider are assumed by this change.

## Apply and verify

Apply the billing foundation migration, platform admin audit migration, then
this migration in order. CI runs
`tests/billing-entitlements-integration.sql` against PostgreSQL 16.
