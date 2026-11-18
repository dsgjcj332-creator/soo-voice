-- Billing subscriptions: gateway integrity guard.
--
-- The Stripe webhook ingestion (/api/billing/webhooks/stripe) is idempotent by
-- checking for an existing merchant_subscriptions row with the same
-- external_subscription_id before inserting. A select-then-insert race between
-- two concurrent deliveries of checkout.session.completed would still produce
-- duplicate subscription rows, so the database enforces uniqueness for rows
-- that reference a real gateway subscription. Rows without a gateway reference
-- (future manual/admin subscriptions) remain unaffected.

create unique index if not exists merchant_subscriptions_external_unique
  on public.merchant_subscriptions (external_subscription_id)
  where external_subscription_id is not null;
