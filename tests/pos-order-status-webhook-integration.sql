-- Integration tests for provider-neutral POS order status webhooks.
-- Run after tests/pos-migrations-integration.sql in the disposable CI database.

insert into public.orders(id, "ownerId", "tableNumber", items, total, status, "createdAt")
values ('order_pos_webhook_1', '11111111-1111-4111-8111-111111111111', '12',
        '[{"id":"m1","name":"Burger","price":50,"quantity":1}]'::jsonb, 50, 'pending', 1795000000000)
on conflict (id) do update set status = 'pending', "completedAt" = null;

insert into public.pos_order_links(
  owner_id, connection_id, location_id, local_order_id,
  provider_order_id, idempotency_key, status
) values (
  '11111111-1111-4111-8111-111111111111',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  'order_pos_webhook_1', 'provider-order-1', 'soovoice:order_pos_webhook_1', 'accepted'
)
on conflict (connection_id, idempotency_key) do update
set provider_order_id = excluded.provider_order_id,
    status = 'accepted',
    location_id = excluded.location_id;

select set_config('request.jwt.claim.role', 'service_role', false);

do $$
declare
  v_result jsonb;
  v_status text;
  v_completed_at bigint;
  v_event_count integer;
begin
  v_result := public.ingest_pos_order_status_webhook(
    '11111111-1111-4111-8111-111111111111',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    'provider-event-preparing-1',
    '{"provider":"foodics","occurredAt":"2026-11-18T10:00:00Z"}'::jsonb,
    'provider-order-1', 'preparing'
  );
  if v_result->>'accepted' <> 'true' or v_result->>'updated' <> 'true'
     or v_result->>'status' <> 'preparing' then
    raise exception 'POS_ORDER_STATUS_PREPARING_NOT_APPLIED';
  end if;

  v_result := public.ingest_pos_order_status_webhook(
    '11111111-1111-4111-8111-111111111111',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    'provider-event-completed-1',
    '{"provider":"foodics","occurredAt":"2026-11-18T10:05:00Z"}'::jsonb,
    'provider-order-1', 'completed'
  );
  if v_result->>'updated' <> 'true' or v_result->>'status' <> 'completed' then
    raise exception 'POS_ORDER_STATUS_COMPLETED_NOT_APPLIED';
  end if;

  select status, "completedAt" into v_status, v_completed_at
    from public.orders where id = 'order_pos_webhook_1';
  if v_status <> 'completed' or v_completed_at is null then
    raise exception 'POS_ORDER_STATUS_COMPLETION_TIMESTAMP_MISSING';
  end if;

  -- An older preparing event arriving after completion must not regress state.
  v_result := public.ingest_pos_order_status_webhook(
    '11111111-1111-4111-8111-111111111111',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    'provider-event-late-preparing-1',
    '{"provider":"foodics","occurredAt":"2026-11-18T10:02:00Z"}'::jsonb,
    'provider-order-1', 'preparing'
  );
  select status into v_status from public.orders where id = 'order_pos_webhook_1';
  if v_status <> 'completed' or v_result->>'updated' <> 'false' then
    raise exception 'POS_ORDER_STATUS_LATE_EVENT_REGRESSED_COMPLETED_ORDER';
  end if;

  -- Duplicate delivery is acknowledged without a second state transition.
  v_result := public.ingest_pos_order_status_webhook(
    '11111111-1111-4111-8111-111111111111',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    'provider-event-completed-1',
    '{"provider":"foodics","occurredAt":"2026-11-18T10:05:00Z"}'::jsonb,
    'provider-order-1', 'completed'
  );
  if v_result->>'duplicate' <> 'true' or v_result->>'updated' <> 'false' then
    raise exception 'POS_ORDER_STATUS_DUPLICATE_EVENT_NOT_IDEMPOTENT';
  end if;

  select count(*) into v_event_count from public.pos_sync_events
   where connection_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
     and event_type = 'order.status';
  if v_event_count <> 3 then
    raise exception 'POS_ORDER_STATUS_EVENT_AUDIT_COUNT_INVALID';
  end if;

  -- Cross-tenant or unknown provider order IDs are rejected.
  begin
    perform public.ingest_pos_order_status_webhook(
      '11111111-1111-4111-8111-111111111111',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      'provider-event-unknown-order-1',
      '{}'::jsonb, 'provider-order-from-another-tenant', 'completed'
    );
    raise exception 'POS_ORDER_STATUS_UNKNOWN_PROVIDER_ORDER_WAS_ACCEPTED';
  exception when no_data_found then
    null;
  end;

  -- Only service role can call the webhook RPC.
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  begin
    perform public.ingest_pos_order_status_webhook(
      '11111111-1111-4111-8111-111111111111',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      'provider-event-forbidden-1', '{}'::jsonb,
      'provider-order-1', 'completed'
    );
    raise exception 'POS_ORDER_STATUS_AUTHENTICATED_RPC_WAS_NOT_REJECTED';
  exception when insufficient_privilege then
    null;
  end;
end;
$$;
