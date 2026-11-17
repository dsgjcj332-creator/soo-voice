-- Merchant-approved, transactional application of selected POS catalog fields.
-- This migration deliberately updates only existing menu_items name/description/price fields.
begin;
create table if not exists public.pos_catalog_menu_apply_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  connection_id uuid not null,
  location_id uuid not null,
  mapping_id uuid not null,
  provider_item_id text not null,
  menu_item_id text not null,
  actor_id uuid not null references auth.users(id),
  request_id uuid not null,
  request_hash text not null check (request_hash ~ '^[a-f0-9]{32}$'),
  selected_fields text[] not null check (cardinality(selected_fields) > 0),
  before_state jsonb not null check (jsonb_typeof(before_state) = 'object'),
  after_state jsonb not null check (jsonb_typeof(after_state) = 'object'),
  applied_at timestamptz not null default now(),
  unique(owner_id, request_id),
  foreign key(owner_id, connection_id) references public.pos_connections(owner_id, id) on delete cascade,
  foreign key(owner_id, location_id) references public.pos_locations(owner_id, id) on delete cascade
);
create index if not exists pos_catalog_menu_apply_events_owner_location_idx
  on public.pos_catalog_menu_apply_events(owner_id, location_id, applied_at desc);
create index if not exists pos_catalog_menu_apply_events_mapping_idx
  on public.pos_catalog_menu_apply_events(mapping_id, applied_at desc);
alter table public.pos_catalog_menu_apply_events enable row level security;
drop policy if exists pos_catalog_menu_apply_events_owner_read on public.pos_catalog_menu_apply_events;
create policy pos_catalog_menu_apply_events_owner_read on public.pos_catalog_menu_apply_events
  for select to authenticated using (owner_id = auth.uid());
revoke all on public.pos_catalog_menu_apply_events from public, anon, authenticated, service_role;
grant select on public.pos_catalog_menu_apply_events to authenticated, service_role;

create or replace function public.apply_pos_catalog_menu_fields(
  p_owner_id uuid, p_actor_id uuid, p_location_id uuid,
  p_provider_item_id text, p_menu_item_id text, p_request_id uuid,
  p_selected_fields text[], p_expected jsonb, p_patch jsonb
)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  v_mapping public.pos_catalog_menu_links%rowtype;
  v_menu public.menu_items%rowtype;
  v_current jsonb;
  v_before jsonb := '{}'::jsonb;
  v_after jsonb := '{}'::jsonb;
  v_event public.pos_catalog_menu_apply_events%rowtype;
  v_field text;
  v_hash text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'SERVICE_ROLE_REQUIRED' using errcode = '42501';
  end if;
  if p_owner_id is null or p_actor_id is null or p_actor_id <> p_owner_id
     or p_location_id is null or p_request_id is null
     or coalesce(p_provider_item_id, '') = '' or length(p_provider_item_id) > 160
     or coalesce(p_menu_item_id, '') = '' or length(p_menu_item_id) > 128 then
    raise exception 'INVALID_POS_MENU_APPLY_SCOPE' using errcode = '22023';
  end if;
  if p_selected_fields is null or cardinality(p_selected_fields) = 0
     or cardinality(p_selected_fields) > 3
     or (select count(distinct f) from unnest(p_selected_fields) as f) <> cardinality(p_selected_fields)
     or exists (select 1 from unnest(p_selected_fields) as f where f not in ('name','description','price')) then
    raise exception 'INVALID_POS_MENU_APPLY_FIELDS' using errcode = '22023';
  end if;
  if p_expected is null or jsonb_typeof(p_expected) <> 'object'
     or p_patch is null or jsonb_typeof(p_patch) <> 'object'
     or jsonb_object_length(p_expected) <> cardinality(p_selected_fields)
     or jsonb_object_length(p_patch) <> cardinality(p_selected_fields) then
    raise exception 'INVALID_POS_MENU_APPLY_PAYLOAD' using errcode = '22023';
  end if;
  foreach v_field in array p_selected_fields loop
    if not (p_expected ? v_field) or not (p_patch ? v_field) then
      raise exception 'INVALID_POS_MENU_APPLY_PAYLOAD' using errcode = '22023';
    end if;
    if v_field = 'name' and (jsonb_typeof(p_patch->v_field) <> 'string'
       or length(btrim(p_patch->>v_field)) = 0 or length(p_patch->>v_field) > 200) then
      raise exception 'INVALID_POS_MENU_APPLY_NAME' using errcode = '22023';
    elsif v_field = 'description' and (jsonb_typeof(p_patch->v_field) <> 'string'
       or length(p_patch->>v_field) > 4000) then
      raise exception 'INVALID_POS_MENU_APPLY_DESCRIPTION' using errcode = '22023';
    elsif v_field = 'price' and (jsonb_typeof(p_patch->v_field) <> 'number'
       or (p_patch->>'price')::numeric < 0 or (p_patch->>'price')::numeric > 1000000) then
      raise exception 'INVALID_POS_MENU_APPLY_PRICE' using errcode = '22023';
    end if;
  end loop;

  v_hash := md5(p_owner_id::text || ':' || p_location_id::text || ':' ||
    p_provider_item_id || ':' || p_menu_item_id || ':' ||
    p_selected_fields::text || ':' || p_expected::text || ':' || p_patch::text);
  select * into v_event from public.pos_catalog_menu_apply_events
   where owner_id = p_owner_id and request_id = p_request_id;
  if found then
    if v_event.request_hash <> v_hash then
      raise exception 'POS_MENU_APPLY_IDEMPOTENCY_CONFLICT' using errcode = '23505';
    end if;
    return jsonb_build_object('eventId', v_event.id, 'applied', true, 'replayed', true,
      'selectedFields', to_jsonb(v_event.selected_fields),
      'before', v_event.before_state, 'after', v_event.after_state);
  end if;

  select * into v_mapping from public.pos_catalog_menu_links
   where owner_id = p_owner_id and location_id = p_location_id
     and provider_item_id = p_provider_item_id and menu_item_id = p_menu_item_id
   for update;
  if not found then
    raise exception 'POS_MENU_APPLY_MAPPING_NOT_APPROVED' using errcode = '42501';
  end if;
  if exists (select 1 from unnest(p_selected_fields) as f
      where coalesce(v_mapping.field_overrides->>f, 'false') = 'true') then
    raise exception 'POS_MENU_APPLY_FIELD_PROTECTED' using errcode = '42501';
  end if;
  if not exists (select 1 from public.pos_catalog_items c
      where c.owner_id = p_owner_id and c.connection_id = v_mapping.connection_id
        and c.location_id = p_location_id and c.provider_item_id = p_provider_item_id
        and c.active = true) then
    raise exception 'POS_MENU_APPLY_CATALOG_ITEM_INACTIVE' using errcode = '42501';
  end if;

  select * into v_menu from public.menu_items mi
   where mi.id::text = p_menu_item_id and mi."ownerId"::text = p_owner_id::text
     and coalesce(mi."isAiOnly", false) = false
   for update;
  if not found then
    raise exception 'POS_MENU_APPLY_MENU_ITEM_NOT_OWNED' using errcode = '42501';
  end if;
  v_current := to_jsonb(v_menu);
  foreach v_field in array p_selected_fields loop
    if v_current->v_field is distinct from p_expected->v_field then
      raise exception 'POS_MENU_APPLY_STALE_MENU_VALUE' using errcode = '40001';
    end if;
    v_before := v_before || jsonb_build_object(v_field, v_current->v_field);
  end loop;

  update public.menu_items mi
     set name = case when p_patch ? 'name' then p_patch->>'name' else mi.name end,
         description = case when p_patch ? 'description' then p_patch->>'description' else mi.description end,
         price = case when p_patch ? 'price' then (p_patch->>'price')::numeric else mi.price end
   where mi.id::text = p_menu_item_id and mi."ownerId"::text = p_owner_id::text
     and coalesce(mi."isAiOnly", false) = false
   returning to_jsonb(mi) into v_current;
  if not found then raise exception 'POS_MENU_APPLY_MENU_ITEM_CHANGED' using errcode = '40001'; end if;
  foreach v_field in array p_selected_fields loop
    v_after := v_after || jsonb_build_object(v_field, v_current->v_field);
  end loop;

  insert into public.pos_catalog_menu_apply_events(
    owner_id, connection_id, location_id, mapping_id, provider_item_id, menu_item_id,
    actor_id, request_id, request_hash, selected_fields, before_state, after_state
  ) values (
    p_owner_id, v_mapping.connection_id, p_location_id, v_mapping.id, p_provider_item_id,
    p_menu_item_id, p_actor_id, p_request_id, v_hash, p_selected_fields, v_before, v_after
  ) returning * into v_event;
  return jsonb_build_object('eventId', v_event.id, 'applied', true, 'replayed', false,
    'selectedFields', to_jsonb(v_event.selected_fields), 'before', v_before, 'after', v_after);
end;
$$;
revoke all on function public.apply_pos_catalog_menu_fields(uuid, uuid, uuid, text, text, uuid, text[], jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.apply_pos_catalog_menu_fields(uuid, uuid, uuid, text, text, uuid, text[], jsonb, jsonb)
  to service_role;
commit;
