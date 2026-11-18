-- Structured, merchant-owned product modifier groups and choices.
-- menu_items is an existing application table whose id type is text and whose
-- ownerId column is the merchant UUID stored as text. We intentionally avoid
-- a hard FK so existing menu installations are not coupled to a bootstrap schema.
begin;

create table if not exists public.menu_modifier_groups (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  menu_item_id text not null,
  name text not null check (length(btrim(name)) between 1 and 120),
  is_required boolean not null default false,
  min_select integer not null default 0 check (min_select between 0 and 20),
  max_select integer not null default 1 check (max_select between 1 and 20),
  sort_order integer not null default 0 check (sort_order between 0 and 10000),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint menu_modifier_group_selection_bounds check (
    min_select <= max_select and
    (not is_required or min_select >= 1)
  ),
  constraint menu_modifier_group_item_name_uidx unique (owner_id, menu_item_id, name),
  constraint menu_modifier_groups_id_owner_uidx unique (id, owner_id)
);

create index if not exists menu_modifier_groups_item_idx
  on public.menu_modifier_groups(owner_id, menu_item_id, sort_order)
  where is_active = true;

create table if not exists public.menu_modifier_options (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  group_id uuid not null references public.menu_modifier_groups(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 120),
  price_delta numeric(12,2) not null default 0
    check (price_delta >= 0 and price_delta <= 1000000),
  sort_order integer not null default 0 check (sort_order between 0 and 10000),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint menu_modifier_option_owner_group_fk
    foreign key (group_id, owner_id)
    references public.menu_modifier_groups(id, owner_id)
    on delete cascade,
  constraint menu_modifier_option_group_name_uidx unique (group_id, name)
);

create index if not exists menu_modifier_options_group_idx
  on public.menu_modifier_options(owner_id, group_id, sort_order)
  where is_active = true;

alter table public.menu_modifier_groups enable row level security;
alter table public.menu_modifier_options enable row level security;

drop policy if exists menu_modifier_groups_public_read on public.menu_modifier_groups;
create policy menu_modifier_groups_public_read
  on public.menu_modifier_groups for select
  to anon, authenticated
  using (is_active = true);

drop policy if exists menu_modifier_groups_owner_manage on public.menu_modifier_groups;
create policy menu_modifier_groups_owner_manage
  on public.menu_modifier_groups for all
  to authenticated
  using (owner_id = auth.uid())
  with check (
    owner_id = auth.uid()
    and exists (
      select 1 from public.menu_items mi
       where mi.id = menu_item_id and mi."ownerId" = auth.uid()::text
    )
  );

drop policy if exists menu_modifier_options_public_read on public.menu_modifier_options;
create policy menu_modifier_options_public_read
  on public.menu_modifier_options for select
  to anon, authenticated
  using (
    is_active = true
    and exists (
      select 1 from public.menu_modifier_groups g
       where g.id = group_id and g.owner_id = owner_id and g.is_active = true
    )
  );

drop policy if exists menu_modifier_options_owner_manage on public.menu_modifier_options;
create policy menu_modifier_options_owner_manage
  on public.menu_modifier_options for all
  to authenticated
  using (
    owner_id = auth.uid()
    and exists (
      select 1 from public.menu_modifier_groups g
       where g.id = group_id and g.owner_id = auth.uid()
    )
  )
  with check (
    owner_id = auth.uid()
    and exists (
      select 1 from public.menu_modifier_groups g
       where g.id = group_id and g.owner_id = auth.uid()
    )
  );

grant select on public.menu_modifier_groups, public.menu_modifier_options to anon, authenticated;
grant insert, update, delete on public.menu_modifier_groups, public.menu_modifier_options to authenticated;
revoke all on public.menu_modifier_groups, public.menu_modifier_options from public;

commit;
