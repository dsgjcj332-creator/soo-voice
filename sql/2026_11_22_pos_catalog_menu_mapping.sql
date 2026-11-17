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

-- Append-only history for merchant mapping approvals and protection changes.
create table if not exists public.pos_catalog_menu_link_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  mapping_id uuid not null references public.pos_catalog_menu_links(id) on delete cascade,
  connection_id uuid not null,
  location_id uuid not null,
  provider_item_id text not null,
  menu_item_id text not null,
  actor_id uuid not null references auth.users(id),
  event_type text not null check (event_type in ('created', 'relinked', 'protection_updated', 'reapproved')),
  previous_state jsonb,
  current_state jsonb not null check (jsonb_typeof(current_state) = 'object'),
  created_at timestamptz not null default now(),
  foreign key(owner_id, connection_id)
    references public.pos_connections(owner_id, id) on delete cascade,
  foreign key(owner_id, location_id)
    references public.pos_locations(owner_id, id) on delete cascade
);

create index if not exists pos_catalog_menu_link_events_owner_location_idx
  on public.pos_catalog_menu_link_events(owner_id, location_id, created_at desc);
create index if not exists pos_catalog_menu_link_events_mapping_idx
  on public.pos_catalog_menu_link_events(mapping_id, created_at desc);

alter table public.pos_catalog_menu_link_events enable row level security;
drop policy if exists pos_catalog_menu_link_events_owner_read on public.pos_catalog_menu_link_events;
create policy pos_catalog_menu_link_events_owner_read on public.pos_catalog_menu_link_events
  for select to authenticated using (owner_id = auth.uid());

revoke all on public.pos_catalog_menu_link_events from public, anon, authenticated;
grant select on public.pos_catalog_menu_link_events to authenticated;
grant all on public.pos_catalog_menu_link_events to service_role;

create or replace function public.log_pos_catalog_menu_link_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $
declare
  v_event_type text;
  v_previous jsonb;
  v_current jsonb;
begin
  v_current := jsonb_build_object(
    'menu_item_id', new.menu_item_id,
    'field_overrides', new.field_overrides,
    'approved_at', new.approved_at
  );

  if tg_op = 'INSERT' then
    v_event_type := 'created';
    v_previous := null;
  else
    v_previous := jsonb_build_object(
      'menu_item_id', old.menu_item_id,
      'field_overrides', old.field_overrides,
      'approved_at', old.approved_at
    );
    if old.menu_item_id is distinct from new.menu_item_id then
      v_event_type := 'relinked';
    elsif old.field_overrides is distinct from new.field_overrides then
      v_event_type := 'protection_updated';
    else
      v_event_type := 'reapproved';
    end if;
  end if;

  insert into public.pos_catalog_menu_link_events (
    owner_id, mapping_id, connection_id, location_id,
    provider_item_id, menu_item_id, actor_id, event_type,
    previous_state, current_state
  ) values (
    new.owner_id, new.id, new.connection_id, new.location_id,
    new.provider_item_id, new.menu_item_id, new.approved_by, v_event_type,
    v_previous, v_current
  );
  return new;
end;
$;

revoke all on function public.log_pos_catalog_menu_link_change() from public, anon, authenticated;
drop trigger if exists pos_catalog_menu_link_audit on public.pos_catalog_menu_links;
create trigger pos_catalog_menu_link_audit
  after insert or update on public.pos_catalog_menu_links
  for each row execute function public.log_pos_catalog_menu_link_change();

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
