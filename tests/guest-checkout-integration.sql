-- Secure checkout must accept an AI-only item when the voice assistant offers it.
-- The database remains authoritative for item ownership, names and prices.
insert into auth.users(id) values ('77777777-7777-4777-8777-777777777777')
on conflict do nothing;

insert into public.menu_items(id, "ownerId", name, description, price, "isAiOnly")
values
 ('checkout-public-item', '77777777-7777-4777-8777-777777777777', 'Public Burger', 'Visible catalog item', 50, false),
 ('checkout-secret-item', '77777777-7777-4777-8777-777777777777', 'Chef Secret Burger', 'Assistant-only item', 75, true)
on conflict (id) do update set price = excluded.price, "isAiOnly" = excluded."isAiOnly";

set role service_role;
select set_config('request.jwt.claim.role', 'service_role', false);

do $$
declare
  v_result jsonb;
  v_replay jsonb;
  v_order_id text;
begin
  v_result := public.create_guest_order(
    '77777777-7777-4777-8777-777777777777',
    '12',
    '[{"id":"checkout-secret-item","quantity":2}]'::jsonb,
    'No onions, sauce on the side',
    'checkout-secret-order-key-01',
    repeat('a', 64),
    repeat('b', 64)
  );
  v_order_id := v_result->>'orderId';

  if v_order_id is null or v_result->>'replayed' <> 'false' then
    raise exception 'VOICE_SECRET_ITEM_ORDER_NOT_CREATED: %', v_result;
  end if;
  if v_result #>> '{items,0,name}' <> 'Chef Secret Burger'
     or (v_result #>> '{items,0,price}')::numeric <> 75
     or (v_result #>> '{items,0,quantity}')::integer <> 2
     or (v_result->>'total')::numeric <> 150 then
    raise exception 'CHECKOUT_DID_NOT_USE_AUTHORITATIVE_CATALOG: %', v_result;
  end if;
  if not exists (select 1 from public.order_outbox where order_id = v_order_id and event_type = 'order.created'
    and payload->>'notes' = 'No onions, sauce on the side') then
    raise exception 'GUEST_ORDER_OUTBOX_EVENT_OR_NOTES_MISSING';
  end if;
  v_replay := public.create_guest_order(
    '77777777-7777-4777-8777-777777777777',
    '12',
    '[{"id":"checkout-secret-item","quantity":2}]'::jsonb,
    'No onions, sauce on the side',
    'checkout-secret-order-key-01',
    repeat('a', 64),
    repeat('b', 64)
  );
  if v_replay->>'orderId' <> v_order_id or v_replay->>'replayed' <> 'true'
     or v_replay->>'notes' <> 'No onions, sauce on the side' then
    raise exception 'GUEST_CHECKOUT_IDEMPOTENT_RETRY_FAILED: %', v_replay;
  end if;
end;
$$;

reset role;

do $
begin
  -- Direct row assertion runs as the database test owner, after resetting
  -- the restricted service_role used to exercise the checkout RPC.
  if not exists (
    select 1 from public.orders o
    join public.order_outbox ob on ob.order_id = o.id
    where ob.payload->>'notes' = 'No onions, sauce on the side'
      and o.order_notes = 'No onions, sauce on the side'
  ) then
    raise exception 'GUEST_ORDER_NOTES_NOT_PERSISTED';
  end if;
end;
$$;

select 'GUEST_CHECKOUT_INTEGRATION_PASSED' as result;
