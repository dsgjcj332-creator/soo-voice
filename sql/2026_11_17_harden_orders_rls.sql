-- Security hardening: orders are private to the authenticated merchant owner.
-- IMPORTANT: This intentionally disables anonymous guest order creation/tracking.
-- Re-enable guest checkout only after a server-side capability-token flow exists:
-- random high-entropy token shown to the guest, hash stored server-side, and
-- narrowly scoped read access to exactly one order. Never restore USING (true).
begin;

alter table public.orders enable row level security;

drop policy if exists "orders_public_read" on public.orders;
drop policy if exists "orders_public_insert" on public.orders;
drop policy if exists "orders_public_update_status" on public.orders;
drop policy if exists "orders_authenticated_delete" on public.orders;

drop policy if exists "orders_owner_select" on public.orders;
drop policy if exists "orders_owner_insert" on public.orders;
drop policy if exists "orders_owner_update" on public.orders;
drop policy if exists "orders_owner_delete" on public.orders;

create policy "orders_owner_select"
  on public.orders for select
  to authenticated
  using ("ownerId" = auth.uid()::text);

create policy "orders_owner_insert"
  on public.orders for insert
  to authenticated
  with check ("ownerId" = auth.uid()::text);

create policy "orders_owner_update"
  on public.orders for update
  to authenticated
  using ("ownerId" = auth.uid()::text)
  with check ("ownerId" = auth.uid()::text);

create policy "orders_owner_delete"
  on public.orders for delete
  to authenticated
  using ("ownerId" = auth.uid()::text);

commit;
