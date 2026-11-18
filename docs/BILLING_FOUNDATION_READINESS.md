# Billing Foundation Readiness

This migration creates the data model required for managed plans, currency-specific
prices, merchant subscriptions/trials, time-limited promotions, first-ten offers,
invoices, payment records, usage metering, and an append-only subscription event log.

## Important scope boundaries

- No prices, plan names, discounts, first-ten offer terms, or payment gateway are seeded.
- Amounts are stored as integer minor units to avoid floating-point currency errors.
- Plan and price catalog rows are publicly readable only when active.
- Merchant billing records are readable only by their authenticated owner.
- Browser clients cannot create or mutate subscriptions, invoices, payments,
  promotions, redemptions, usage records, or subscription events.
- Mutations are reserved for trusted server-side service-role workflows.
- The event log rejects updates and deletes, including service-role attempts.
- No payment is captured and no subscription is activated by this migration.

## Next implementation stages

1. Admin-only server APIs to create/edit plans, prices, promotions, and trials.
2. A billing service abstraction with idempotent provider webhooks and ledger transitions.
3. A gateway decision (for example, Paymob or Fawry) after fees, settlement,
   refunds, recurring-payment support and reconciliation are reviewed.
4. Merchant billing UI and invoices after the provider flow is implemented.
5. Staging tests for subscription transitions, coupon concurrency, first-ten
   redemption limits, webhook replay, refunds and reconciliation.

Run `tests/billing-migrations-integration.sql` after applying the migration.


## Platform admin read access

The Super Admin overview now reads billing counts through RLS policies that
recognize only trusted JWT `app_metadata.role = admin` or
`app_metadata.roles` containing `admin`. User-editable `user_metadata` is
never accepted as an admin claim. Admin access is read-only from the browser;
all billing mutations remain reserved for trusted server-side workflows.
The overview intentionally omits revenue totals until verified payment
reconciliation is implemented.
