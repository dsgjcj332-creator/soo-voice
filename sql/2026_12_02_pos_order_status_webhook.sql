-- Provider-neutral, signed POS order-status webhook ingestion.
-- Event deduplication and the local order status update are one transaction.
begin;

create or replace function public.ingest_pos_order_status_webhook(
  p_owner_id uuid,
  p_connection_id uuid,
  p_location_id uuid,
  p_provider_event_id text,
  p_event_metadata jsonb,
  p_provider_order_id text,
  p_order_status text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
  v_link public.pos_order_links%rowtype;
  v_current_status text;
  v_next_status text;
  v_completed_at bigint;
  v_updated boolean := false;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'SERVICE_ROLE_REQUIRED' using errcode = '42501';
  end if;
  if p_owner_id is null or p_connection_id is null or p_location_id is null
     or coalesce(p_provider_event_id, '') = '' or length(p_provider_event_id) > 160
     or p_event_metadata is null or jsonb_typeof(p_event_metadata) <> 'object'
     or coalesce(p_provider_order_id, '') = '' or length(p_provider_order_id) > 200
     or p_order_status not in ('pending','preparing','completed','cancelled') then
    raise exception 'INVALID_POS_ORDER_STATUS_EVENT' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.pos_connections c
     where c.id = p_connection_id and c.owner_id = p_owner_id and c.status = 'connected'
  ) or not exists (
    select 1 from public.pos_locations l
     where l.id = p_location_id and l.owner_id = p_owner_id
       and l.connection_id = p_connection_id and l.active = true
  ) then
    raise exception 'POS_ORDER_STATUS_SCOPE_INVALID' using errcode = '42501';
  end if;

  insert into public.pos_sync_events(
    owner_id, connection_id, provider_event_id, event_type, payload, status, attempts
  ) values (
    p_owner_id, p_connection_id, p_provider_event_id, 'order.status',
    p_event_metadata || jsonb_build_object(
      'providerOrderId', p_provider_order_id,
      'status', p_order_status,
      'locationId', p_location_id
    ),
    'processing', 1
  )
  on conflict (connection_id, provider_event_id) do nothing
  returning id into v_event_id;

  if v_event_id is null then
    return jsonb_build_object('accepted', true, 'duplicate', true, 'updated', false);
  end if;

  select * into v_link
    from public.pos_order_links
   where owner_id = p_owner_id
     and connection_id = p_connection_id
     and location_id = p_location_id
     and provider_order_id = p_provider_order_id
     and status = 'accepted'
   for update;

  if not found then
    raise exception 'POS_ORDER_LINK_NOT_FOUND' using errcode = 'P0002';
  end if;

  select status, "completedAt" into v_current_status, v_completed_at
    from public.orders
   where id = v_link.local_order_id and "ownerId" = p_owner_id::text
   for update;

  if not found then
    raise exception 'LOCAL_ORDER_NOT_FOUND' using errcode = 'P0002';
  end if;

  -- Never regress a local order because an older provider webhook arrived late.
  -- completed/cancelled are terminal; pending may advance to preparing,
  -- completed or cancelled; preparing may advance to completed or cancelled.
  if v_current_status not in ('completed','cancelled')
     and (
       (v_current_status = 'pending' and p_order_status in ('preparing','completed','cancelled'))
       or (v_current_status = 'preparing' and p_order_status in ('completed','cancelled'))
       or (v_current_status = p_order_status)
     ) then
    v_next_status := p_order_status;
    update public.orders
       set status = v_next_status,
           "completedAt" = case
             when v_next_status = 'completed' then coalesce(v_completed_at, floor(extract(epoch from clock_timestamp()) * 1000)::bigint)
             else "completedAt"
           end
     where id = v_link.local_order_id and "ownerId" = p_owner_id::text;
    v_updated := true;
  end if;

  update public.pos_order_links
     set last_synced_at = now(), updated_at = now()
   where id = v_link.id;

  update public.pos_sync_events
     set status = 'processed', processed_at = now(), last_error_code = null
   where id = v_event_id and owner_id = p_owner_id;

  return jsonb_build_object(
    'accepted', true,
    'duplicate', false,
    'updated', v_updated,
    'localOrderId', v_link.local_order_id,
    'status', case when v_updated then p_order_status else v_current_status end
  );
end;
$$;

revoke all on function public.ingest_pos_order_status_webhook(uuid, uuid, uuid, text, jsonb, text, text)
  from public, anon, authenticated;
grant execute on function public.ingest_pos_order_status_webhook(uuid, uuid, uuid, text, jsonb, text, text)
  to service_role;

commit;
