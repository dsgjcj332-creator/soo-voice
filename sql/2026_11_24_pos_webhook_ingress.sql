-- Provider-neutral, signed POS catalog webhook ingestion.
-- Event receipt and catalog snapshot persistence share one database transaction.
begin;

create or replace function public.ingest_pos_catalog_webhook(
  p_owner_id uuid,
  p_connection_id uuid,
  p_location_id uuid,
  p_provider_event_id text,
  p_event_type text,
  p_event_metadata jsonb,
  p_items jsonb,
  p_complete_snapshot boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
  v_sync_result jsonb;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'SERVICE_ROLE_REQUIRED' using errcode = '42501';
  end if;
  if p_owner_id is null or p_connection_id is null or p_location_id is null
     or coalesce(p_provider_event_id, '') = '' or length(p_provider_event_id) > 160
     or coalesce(p_event_type, '') <> 'catalog.snapshot'
     or p_event_metadata is null or jsonb_typeof(p_event_metadata) <> 'object'
     or p_items is null or jsonb_typeof(p_items) <> 'array'
     or p_complete_snapshot is null then
    raise exception 'INVALID_POS_WEBHOOK_EVENT' using errcode = '22023';
  end if;

  insert into public.pos_sync_events(owner_id, connection_id, provider_event_id, event_type, payload, status, attempts)
  values (p_owner_id, p_connection_id, p_provider_event_id, p_event_type, p_event_metadata, 'processing', 1)
  on conflict (connection_id, provider_event_id) do nothing
  returning id into v_event_id;

  if v_event_id is null then
    return jsonb_build_object('accepted', true, 'duplicate', true);
  end if;

  v_sync_result := public.sync_pos_catalog_snapshot(
    p_owner_id, p_connection_id, p_location_id, p_items, p_complete_snapshot
  );

  update public.pos_sync_events
  set status = 'processed', processed_at = now(), last_error_code = null
  where id = v_event_id and owner_id = p_owner_id;

  return jsonb_build_object('accepted', true, 'duplicate', false, 'eventId', v_event_id, 'catalog', v_sync_result);
end;
$$;

revoke all on function public.ingest_pos_catalog_webhook(uuid, uuid, uuid, text, text, jsonb, jsonb, boolean)
  from public, anon, authenticated;
grant execute on function public.ingest_pos_catalog_webhook(uuid, uuid, uuid, text, text, jsonb, jsonb, boolean)
  to service_role;

commit;
