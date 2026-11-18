-- Record when kitchen work is completed, independently of when the guest placed the order.
alter table public.orders
  add column if not exists "completedAt" bigint;

create index if not exists orders_owner_completed_idx
  on public.orders ("ownerId", "completedAt" desc)
  where "completedAt" is not null;
