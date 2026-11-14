-- SooVoice — Orders table RLS policy for guest-side tracking
--
-- The guest (anonymous, scanning a QR code) needs to be able to READ
-- their order's status to see the live tracking timeline. Without this
-- policy, the realtime subscription silently fails and the tracking
-- modal stays stuck on "pending" even after the kitchen updates the
-- status.
--
-- Run once in the Supabase SQL Editor (Dashboard → SQL → New query → Run).
-- This assumes the orders table already exists (created manually or by
-- the app's first insert).

-- Allow anonymous read on orders (guests need to track their order status)
drop policy if exists "orders_public_read" on orders;
create policy "orders_public_read"
  on orders for select
  using (true);
