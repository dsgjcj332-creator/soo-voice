-- SooVoice — Menu categories (per merchant)
-- The merchant's own list of menu categories. Replaces the hardcoded
-- "Main Course / Appetizers / Drinks / Desserts / Secret Menu" list with
-- a dynamic per-merchant array, so each restaurant can define its own
-- taxonomy (e.g. a pizzeria can have "Antipasti", "Pizze", "Dolci").
--
-- Schema: one row per merchant. The `categories` column holds a JSON
-- array of objects { id, labelAr, labelEn, emoji?, order }. The id is a
-- stable slug stored on each MenuItem.category — changing a label does
-- NOT orphan existing items.
--
-- Run once in the Supabase SQL Editor (Dashboard → SQL → New query → Run).

create table if not exists menu_categories (
  ownerId uuid primary key,
  categories jsonb not null default '[]'::jsonb,
  updatedAt bigint not null default 0
);

alter table menu_categories enable row level security;

-- Customers scanning a table QR need to be able to READ the categories
-- so the guest-side filter pills reflect what the merchant has set up.
drop policy if exists "menu_categories_public_read" on menu_categories;
create policy "menu_categories_public_read"
  on menu_categories for select
  using (true);

-- Merchants can insert/update only their own row.
drop policy if exists "menu_categories_owner_insert" on menu_categories;
create policy "menu_categories_owner_insert"
  on menu_categories for insert
  to authenticated
  with check (ownerId = auth.uid());

drop policy if exists "menu_categories_owner_update" on menu_categories;
create policy "menu_categories_owner_update"
  on menu_categories for update
  to authenticated
  using (ownerId = auth.uid())
  with check (ownerId = auth.uid());
