-- SooVoice — Restaurant floor plan (per merchant)
-- Stores the visual arrangement of tables the owner creates on the floor
-- plan page. Each table has a label and pixel coordinates on a 600x420
-- canvas; the QR for each table is generated deterministically from the
-- label + ownerId at render time, so it does not need to be stored.
--
-- Run once in the Supabase SQL Editor (Dashboard → SQL → New query → Run).

create table if not exists restaurant_floor_plan (
  ownerId uuid primary key,
  tables jsonb not null default '[]'::jsonb,
  updatedAt bigint not null default 0
);

alter table restaurant_floor_plan enable row level security;

-- Customers scanning a table QR need to be able to confirm the table layout
-- belongs to the merchant whose ownerId they're visiting. For now we allow
-- anonymous read on this table — only the table coordinates and labels are
-- exposed, not the menu or anything sensitive.
drop policy if exists "restaurant_floor_plan_public_read" on restaurant_floor_plan;
create policy "restaurant_floor_plan_public_read"
  on restaurant_floor_plan for select
  using (true);

-- Merchants can insert/update only their own row.
drop policy if exists "restaurant_floor_plan_owner_insert" on restaurant_floor_plan;
create policy "restaurant_floor_plan_owner_insert"
  on restaurant_floor_plan for insert
  to authenticated
  with check (ownerId = auth.uid());

drop policy if exists "restaurant_floor_plan_owner_update" on restaurant_floor_plan;
create policy "restaurant_floor_plan_owner_update"
  on restaurant_floor_plan for update
  to authenticated
  using (ownerId = auth.uid())
  with check (ownerId = auth.uid());
