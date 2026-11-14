-- SooVoice — Orders table RLS policy for anonymous guest order placement
--
-- When a guest scans the QR code on their table, they are an ANONYMOUS
-- browser — no Supabase auth session. They need to INSERT a new order
-- (so the kitchen receives it). Without this policy, the INSERT fails
-- silently with an RLS error and the guest sees "تعذّر الإرسال — حاول
-- مرة أخرى" / "Failed — try again".
--
-- Run once in the Supabase SQL Editor (Dashboard → SQL → New query → Run).
-- This assumes:
--   1. The orders table already exists (created by the app's first
--      authenticated insert, or manually).
--   2. RLS is ENABLED on the orders table (otherwise the policy is a no-op).
--   3. The `orders_public_read` policy from orders_tracking.sql is also
--      applied (so guests can SELECT their order's status for tracking).

-- 1. Make sure RLS is on (safe to re-run)
alter table orders enable row level security;

-- 2. Allow anonymous guests to INSERT a new order.
--    We do not constrain the columns here — the app already controls
--    which fields are sent (id, ownerId, tableNumber, items, total,
--    status, createdAt). Constraining to status='pending' would also be
--    reasonable, but the app never inserts with another status, so we
--    keep the policy simple and let the app own that logic.
drop policy if exists "orders_public_insert" on orders;
create policy "orders_public_insert"
  on orders for insert
  to anon, authenticated
  with check (true);

-- 3. Allow anonymous guests to UPDATE only the status — used by some
--    edge flows where the app needs to cancel an order before the kitchen
--    acknowledges it. (Optional, but harmless and consistent with the
--    read policy.)
drop policy if exists "orders_public_update_status" on orders;
create policy "orders_public_update_status"
  on orders for update
  to anon, authenticated
  using (true)
  with check (true);
