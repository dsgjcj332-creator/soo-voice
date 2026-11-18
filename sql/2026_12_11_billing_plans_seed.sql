-- Billing plans and prices: idempotent operator defaults.
--
-- SAFE TO RE-RUN: plans are upserted on plan_key (unique), and a price row is
-- inserted only when no active, open-ended price exists for that
-- (plan, currency, interval) combination.
--
-- IMPORTANT: the amounts below are OPERATOR DEFAULTS seeded so that the
-- subscription flow can be exercised end-to-end. They are NOT approved
-- commercial pricing. Adjust them through the billing admin API
-- (PATCH /api/admin/billing/prices/:id) or this file before going live.

-- ---------- Plans ----------
insert into public.billing_plans (plan_key, display_name, description, features, usage_limits, is_active, sort_order)
values
  ('free',
   'Starter Free',
   'For trying the voice assistant on a small menu before committing.',
   '{"email_support": true}'::jsonb,
   '{"max_products": 10, "max_ai_conversations_monthly": 100, "max_custom_voices": 1, "max_qr_stands": 1}'::jsonb,
   true,
   10),
  ('pro',
   'Growth Pro',
   'For growing restaurants and stores that need QR ordering and higher limits.',
   '{"email_support": true, "custom_voices": true, "unlimited_qr_stands": true, "webhook_sync": true}'::jsonb,
   '{"max_products": 1000, "max_ai_conversations_monthly": null, "max_custom_voices": 10, "max_qr_stands": null}'::jsonb,
   true,
   20),
  ('enterprise',
   'Scale Enterprise',
   'For large operations and spare-parts dealers with massive hidden catalogs.',
   '{"email_support": true, "custom_voices": true, "unlimited_qr_stands": true, "webhook_sync": true, "hidden_ai_catalog": true, "api_routing": true, "advanced_analytics": true}'::jsonb,
   '{"max_products": null, "max_ai_conversations_monthly": null, "max_custom_voices": null, "max_qr_stands": null}'::jsonb,
   true,
   30)
on conflict (plan_key) do update
set display_name = excluded.display_name,
    description = excluded.description,
    is_active = true,
    updated_at = now();

-- ---------- Prices ----------
-- Guard: seed a price only when the plan has no active open-ended price for
-- the same currency and interval, so re-runs and admin-managed prices are kept.
with seeded as (
  select id, plan_key from public.billing_plans
  where plan_key in ('free', 'pro', 'enterprise')
)
insert into public.billing_plan_prices (plan_id, currency, billing_interval, amount_minor, is_active)
select s.id, v.currency, v.billing_interval, v.amount_minor, true
from seeded s
join (values
  ('free', 'EGP', 'monthly', 0::bigint),
  ('free', 'SAR', 'monthly', 0::bigint),
  ('free', 'USD', 'monthly', 0::bigint),
  ('pro', 'EGP', 'monthly', 490::bigint),
  ('pro', 'EGP', 'yearly', 4900::bigint),
  ('pro', 'SAR', 'monthly', 99::bigint),
  ('pro', 'SAR', 'yearly', 990::bigint),
  ('pro', 'USD', 'monthly', 19::bigint),
  ('pro', 'USD', 'yearly', 190::bigint),
  ('enterprise', 'EGP', 'monthly', 1490::bigint),
  ('enterprise', 'EGP', 'yearly', 14900::bigint),
  ('enterprise', 'SAR', 'monthly', 299::bigint),
  ('enterprise', 'SAR', 'yearly', 2990::bigint),
  ('enterprise', 'USD', 'monthly', 59::bigint),
  ('enterprise', 'USD', 'yearly', 590::bigint)
) as v(plan_key, currency, billing_interval, amount_minor)
  on v.plan_key = s.plan_key
where not exists (
  select 1 from public.billing_plan_prices p
  where p.plan_id = s.id
    and p.currency = v.currency
    and p.billing_interval = v.billing_interval
    and p.is_active = true
    and p.effective_until is null
);
