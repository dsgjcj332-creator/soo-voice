-- Explicit, merchant-approved links between POS catalog products and SooVoice menu rows.
-- This table stores mapping metadata only; it never writes to menu_items.
begin;

create table if not exists public.pos_catalog_menu_links (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  connection_id uuid not null,
  location_id uuid not null,
  provider_item_id text not null check (length(provider_item_id) between 1 and 160),
  menu_item_id text not null check (length(menu_item_id) between 1 and 128),
  field_overrides jsonb not null default '{}'::jsonb
    check (jsonb_typeof(field_overrides) = 'object'),
  approved_by uuid not null references auth.users(id),
  approved_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(connection_id, location_id, provider_item_id),
  unique(connection_id, location_id, menu_item_id),
  foreign key(owner_id, connection_id)
    references public.pos_connections(owner_id, id) on delete cascade,
  foreign key(owner_id, location_id)
    references public.pos_locations(owner_id, id) on delete cascade
);

create index if not exists pos_catalog_menu_links_owner_location_idx
  on public.pos_catalog_menu_links(owner_id, location_id);

alter table public.pos_catalog_menu_links enable row level security;
drop policy if exists pos_catalog_menu_links_owner_read on public.pos_catalog_menu_links;
create policy pos_catalog_menu_links_owner_read on public.pos_catalog_menu_links
  for select to authenticated using (owner_id = auth.uid());

revoke all on public.pos_catalog_menu_links from anon, authenticated;
grant select on public.pos_catalog_menu_links to authenticated;
grant all on public.pos_catalog_menu_links to service_role;
revoke all on public.pos_catalog_menu_links from public;

commit;
