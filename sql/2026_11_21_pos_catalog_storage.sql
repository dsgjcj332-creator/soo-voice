-- Durable, tenant-scoped POS catalog snapshot storage.
-- Only trusted server code (service_role) may write catalog rows.
begin;

create table if not exists public.pos_catalog_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  connection_id uuid not null,
  location_id uuid not null,
  provider_item_id text not null,
  category_id text,
  name text not null,
  description text,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  unit_price numeric(12,2) not null check (unit_price >= 0 and unit_price <= 1000000),
  available boolean not null,
  modifier_groups jsonb not null default '[]'::jsonb check (jsonb_typeof(modifier_groups) = 'array'),
  source_version text,
  source_updated_at timestamptz not null,
  content_fingerprint text not null,
  active boolean not null default true,
  last_seen_sync_id uuid,
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(connection_id, location_id, provider_item_id),
  foreign key(owner_id, connection_id)
    references public.pos_connections(owner_id, id) on delete cascade,
  foreign key(owner_id, location_id)
    references public.pos_locations(owner_id, id) on delete cascade
);

create index if not exists pos_catalog_items_owner_location_idx
  on public.pos_catalog_items(owner_id, location_id, active, name);
create index if not exists pos_catalog_items_connection_sync_idx
  on public.pos_catalog_items(connection_id, location_id, last_synced_at desc);

alter table public.pos_catalog_items enable row level security;
drop policy if exists pos_catalog_items_owner_read on public.pos_catalog_items;
create policy pos_catalog_items_owner_read on public.pos_catalog_items
  for select to authenticated using (owner_id = auth.uid());

revoke all on public.pos_catalog_items from anon, authenticated;
grant select on public.pos_catalog_items to authenticated;
revoke all on public.pos_catalog_items from public;

create or replace function public.sync_pos_catalog_snapshot(
  p_owner_id uuid,
  p_connection_id uuid,
  p_location_id uuid,
  p_items jsonb,
  p_complete_snapshot boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sync_id uuid := gen_random_uuid();
  v_count integer;
  v_upserted integer := 0;
  v_deactivated integer := 0;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'SERVICE_ROLE_REQUIRED' using errcode = '42501';
  end if;
  if p_owner_id is null or p_connection_id is null or p_location_id is null then
    raise exception 'INVALID_POS_CATALOG_SCOPE' using errcode = '22023';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'INVALID_POS_CATALOG_ITEMS' using errcode = '22023';
  end if;
  if octet_length(p_items::text) > 8388608 then
    raise exception 'POS_CATALOG_PAYLOAD_TOO_LARGE' using errcode = '22023';
  end if;

  select count(*) into v_count from jsonb_array_elements(p_items);
  if v_count > 10000 then
    raise exception 'POS_CATALOG_ITEM_LIMIT_EXCEEDED' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_items) as e(item)
    where jsonb_typeof(e.item) <> 'object'
       or coalesce(e.item->>'providerId', '') = ''
       or length(e.item->>'providerId') > 160
       or coalesce(e.item->>'name', '') = ''
       or length(e.item->>'name') > 200
       or coalesce(e.item->>'currency', '') !~ '^[A-Z]{3}$'
       or coalesce(e.item->>'available', '') not in ('true','false')
       or jsonb_typeof(e.item->'modifierGroups') <> 'array'
       or coalesce(e.item->>'updatedAt', '') = ''
       or coalesce(e.item->>'unitPrice', '') !~ '^[0-9]+(\\.[0-9]{1,2})?$'
       or (e.item->>'unitPrice')::numeric > 1000000
  ) then
    raise exception 'INVALID_POS_CATALOG_ITEM' using errcode = '22023';
  end if;

  if (select count(*) from (
        select e.item->>'providerId' as provider_id
        from jsonb_array_elements(p_items) as e(item)
        group by e.item->>'providerId'
        having count(*) > 1
      ) duplicates) > 0 then
    raise exception 'DUPLICATE_POS_CATALOG_PROVIDER_ITEM' using errcode = '22023';
  end if;

  if p_complete_snapshot is null then
    raise exception 'INVALID_POS_CATALOG_SNAPSHOT_MODE' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.pos_connections c
    where c.id = p_connection_id and c.owner_id = p_owner_id and c.status = 'connected'
  ) then
    raise exception 'POS_CONNECTION_NOT_CONNECTED' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.pos_locations l
    where l.id = p_location_id and l.owner_id = p_owner_id
      and l.connection_id = p_connection_id and l.active = true
  ) then
    raise exception 'POS_LOCATION_NOT_ACTIVE_OR_NOT_OWNED' using errcode = '42501';
  end if;

  -- Serialize snapshots for this connection/location so concurrent complete
  -- imports cannot deactivate products seen by another in-flight import.
  perform pg_advisory_xact_lock(hashtextextended(p_connection_id::text || ':' || p_location_id::text, 0));

  insert into public.pos_catalog_items (
    owner_id, connection_id, location_id, provider_item_id,
    category_id, name, description, currency, unit_price, available,
    modifier_groups, source_version, source_updated_at, content_fingerprint,
    last_seen_sync_id, last_synced_at
  )
  select
    p_owner_id, p_connection_id, p_location_id, x."providerId",
    x."categoryId", x.name, x.description, x.currency, x."unitPrice", x.available,
    x."modifierGroups", x."sourceVersion", x."updatedAt",
    md5(e.item::text), v_sync_id, now()
  from jsonb_array_elements(p_items) as e(item)
  cross join lateral jsonb_to_record(e.item) as x(
    "providerId" text, "categoryId" text, name text, description text,
    currency text, "unitPrice" numeric, available boolean,
    "modifierGroups" jsonb, "sourceVersion" text, "updatedAt" timestamptz
  )
  on conflict (connection_id, location_id, provider_item_id) do update
  set category_id = excluded.category_id,
      name = excluded.name,
      description = excluded.description,
      currency = excluded.currency,
      unit_price = excluded.unit_price,
      available = excluded.available,
      modifier_groups = excluded.modifier_groups,
      source_version = excluded.source_version,
      source_updated_at = excluded.source_updated_at,
      content_fingerprint = excluded.content_fingerprint,
      updated_at = now()
  where excluded.source_updated_at > public.pos_catalog_items.source_updated_at;
  get diagnostics v_upserted = row_count;

  -- Mark all received IDs as seen, including stale records. This prevents a
  -- complete snapshot from deactivating a product merely because its payload
  -- carried an older timestamp than the last persisted version.
  update public.pos_catalog_items p
  set last_seen_sync_id = v_sync_id, last_synced_at = now(), active = true
  where p.owner_id = p_owner_id and p.connection_id = p_connection_id
    and p.location_id = p_location_id
    and p.provider_item_id in (
      select e.item->>'providerId' from jsonb_array_elements(p_items) as e(item)
    );

  if p_complete_snapshot then
    update public.pos_catalog_items p
    set active = false, updated_at = now()
    where p.owner_id = p_owner_id and p.connection_id = p_connection_id
      and p.location_id = p_location_id and p.active = true
      and p.last_seen_sync_id is distinct from v_sync_id;
    get diagnostics v_deactivated = row_count;
  end if;

  return jsonb_build_object(
    'syncId', v_sync_id,
    'received', v_count,
    'upserted', v_upserted,
    'deactivated', v_deactivated,
    'completeSnapshot', p_complete_snapshot
  );
end;
$$;

revoke all on function public.sync_pos_catalog_snapshot(uuid, uuid, uuid, jsonb, boolean) from public, anon, authenticated;
grant execute on function public.sync_pos_catalog_snapshot(uuid, uuid, uuid, jsonb, boolean) to service_role;

commit;
