-- Merchant-managed POS order routing: one default destination plus exact table overrides.
begin;

alter table public.pos_connections
  add column if not exists inbound_webhooks_enabled boolean not null default false,
  add column if not exists outbound_orders_enabled boolean not null default false;

create table if not exists public.pos_order_routes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  connection_id uuid not null,
  location_id uuid not null,
  route_type text not null check (route_type in ('default','table')),
  route_value text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pos_order_routes_shape check (
    (route_type = 'default' and route_value is null) or
    (route_type = 'table' and route_value is not null and length(route_value) between 1 and 40)
  ),
  foreign key(owner_id, connection_id)
    references public.pos_connections(owner_id, id) on delete cascade,
  foreign key(owner_id, location_id)
    references public.pos_locations(owner_id, id) on delete cascade
);

create unique index if not exists pos_order_routes_one_default_idx
  on public.pos_order_routes(owner_id) where route_type = 'default';
create unique index if not exists pos_order_routes_table_key_idx
  on public.pos_order_routes(owner_id, route_value) where route_type = 'table';
create index if not exists pos_order_routes_location_idx
  on public.pos_order_routes(owner_id, connection_id, location_id);

alter table public.pos_order_routes enable row level security;
drop policy if exists pos_order_routes_owner_read on public.pos_order_routes;
create policy pos_order_routes_owner_read on public.pos_order_routes
  for select to authenticated using (owner_id = auth.uid());
revoke all on public.pos_order_routes from public, anon, authenticated;
grant select on public.pos_order_routes to authenticated, service_role;
revoke insert, update, delete on public.pos_order_routes from service_role;

-- Preserve existing single-branch setups by selecting their only active POS
-- location as the initial default. Ambiguous multi-branch merchants must choose.
insert into public.pos_order_routes(owner_id, connection_id, location_id, route_type)
select c.owner_id, c.id, l.id, 'default'
from public.pos_connections c
join public.pos_locations l
  on l.owner_id = c.owner_id and l.connection_id = c.id and l.active = true
where c.status = 'connected'
  and not exists (select 1 from public.pos_order_routes r where r.owner_id = c.owner_id)
  and 1 = (
    select count(*)
    from public.pos_connections c2
    join public.pos_locations l2
      on l2.owner_id = c2.owner_id and l2.connection_id = c2.id and l2.active = true
    where c2.owner_id = c.owner_id and c2.status = 'connected'
  );

create or replace function public.save_pos_order_route(
  p_owner_id uuid,
  p_connection_id uuid,
  p_location_id uuid,
  p_route_type text,
  p_route_value text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_route public.pos_order_routes%rowtype;
  v_value text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'SERVICE_ROLE_REQUIRED' using errcode = '42501';
  end if;
  if p_owner_id is null or p_connection_id is null or p_location_id is null
     or p_route_type is null or p_route_type not in ('default','table') then
    raise exception 'INVALID_POS_ORDER_ROUTE' using errcode = '22023';
  end if;
  if p_route_type = 'default' then
    if p_route_value is not null then
      raise exception 'DEFAULT_ROUTE_VALUE_MUST_BE_EMPTY' using errcode = '22023';
    end if;
    v_value := null;
  else
    v_value := upper(btrim(coalesce(p_route_value, '')));
    if length(v_value) not between 1 and 40 or v_value !~ '^[A-Z0-9][A-Z0-9 _./-]*$' then
      raise exception 'INVALID_TABLE_ROUTE_VALUE' using errcode = '22023';
    end if;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_owner_id::text || ':pos-order-routes', 0));

  if not exists (
    select 1 from public.pos_connections c
    where c.id = p_connection_id and c.owner_id = p_owner_id and c.status = 'connected'
  ) then
    raise exception 'POS_ROUTE_CONNECTION_NOT_CONNECTED' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.pos_locations l
    where l.id = p_location_id and l.owner_id = p_owner_id
      and l.connection_id = p_connection_id and l.active = true
  ) then
    raise exception 'POS_ROUTE_LOCATION_NOT_ACTIVE_OR_NOT_OWNED' using errcode = '42501';
  end if;

  delete from public.pos_order_routes
  where owner_id = p_owner_id and route_type = p_route_type
    and ((p_route_type = 'default' and route_value is null) or
         (p_route_type = 'table' and route_value = v_value));

  insert into public.pos_order_routes(owner_id, connection_id, location_id, route_type, route_value)
  values (p_owner_id, p_connection_id, p_location_id, p_route_type, v_value)
  returning * into v_route;

  return jsonb_build_object(
    'id', v_route.id, 'connection_id', v_route.connection_id,
    'location_id', v_route.location_id, 'route_type', v_route.route_type,
    'route_value', v_route.route_value, 'created_at', v_route.created_at,
    'updated_at', v_route.updated_at
  );
end;
$$;

create or replace function public.clear_pos_order_routes_for_inactive_location()
returns trigger
language plpgsql
security definer
set search_path = public
as $
begin
  if old.active = true and new.active = false then
    delete from public.pos_order_routes
    where owner_id = new.owner_id and location_id = new.id;
  end if;
  return new;
end;
$;

drop trigger if exists pos_order_routes_clear_inactive_location on public.pos_locations;
create trigger pos_order_routes_clear_inactive_location
after update of active on public.pos_locations
for each row execute function public.clear_pos_order_routes_for_inactive_location();

revoke all on function public.clear_pos_order_routes_for_inactive_location() from public, anon, authenticated, service_role;

create or replace function public.delete_pos_order_route(p_owner_id uuid, p_route_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'SERVICE_ROLE_REQUIRED' using errcode = '42501';
  end if;
  if p_owner_id is null or p_route_id is null then
    raise exception 'INVALID_POS_ORDER_ROUTE' using errcode = '22023';
  end if;
  delete from public.pos_order_routes where id = p_route_id and owner_id = p_owner_id;
  get diagnostics v_deleted = row_count;
  return v_deleted = 1;
end;
$$;

revoke all on function public.save_pos_order_route(uuid,uuid,uuid,text,text) from public, anon, authenticated;
grant execute on function public.save_pos_order_route(uuid,uuid,uuid,text,text) to service_role;
revoke all on function public.delete_pos_order_route(uuid,uuid) from public, anon, authenticated;
grant execute on function public.delete_pos_order_route(uuid,uuid) to service_role;

commit;
