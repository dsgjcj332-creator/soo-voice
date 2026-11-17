-- Secure guest checkout foundation.
-- Prices are read from the merchant's persisted menu_items rows. The browser
-- supplies item IDs and quantities only. Order + outbox are committed in one
-- database transaction; guest tokens are stored only as SHA-256 hashes.

begin;

alter table public.orders
  add column if not exists guest_token_hash text,
  add column if not exists guest_token_expires_at timestamptz,
  add column if not exists idempotency_key text,
  add column if not exists request_hash text;

create index if not exists orders_guest_token_expiry_idx
  on public.orders(id, guest_token_expires_at)
  where guest_token_hash is not null;

create unique index if not exists orders_owner_idempotency_uidx
  on public.orders ("ownerId", idempotency_key)
  where idempotency_key is not null;

create table if not exists public.order_outbox (
  id uuid primary key default gen_random_uuid(),
  order_id text not null references public.orders(id) on delete cascade,
  owner_id text not null,
  event_type text not null,
  payload jsonb not null,
  status text not null default 'pending'
    check (status in ('pending','processing','delivered','failed','dead_letter')),
  attempts integer not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  delivered_at timestamptz,
  last_error_code text,
  unique(order_id, event_type)
);

create index if not exists order_outbox_worker_idx
  on public.order_outbox(status, next_attempt_at)
  where status in ('pending','failed');

alter table public.order_outbox enable row level security;
revoke all on public.order_outbox from anon, authenticated;
grant select, insert, update, delete on public.order_outbox to service_role;

create or replace function public.create_guest_order(
  p_owner_id text,
  p_table_number text,
  p_items jsonb,
  p_idempotency_key text,
  p_guest_token_hash text,
  p_request_hash text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id text;
  v_existing_id text;
  v_existing_request_hash text;
  v_items jsonb := '[]'::jsonb;
  v_total numeric(12,2) := 0;
  v_line record;
  v_item_id text;
  v_item_name text;
  v_item_price numeric(12,2);
  v_quantity integer;
  v_created_at bigint := floor(extract(epoch from clock_timestamp()) * 1000);
begin
  if p_owner_id is null or p_owner_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception 'INVALID_STORE';
  end if;
  if p_table_number is null or length(p_table_number) > 24 then
    raise exception 'INVALID_TABLE';
  end if;
  if p_idempotency_key is null or length(p_idempotency_key) < 16 or length(p_idempotency_key) > 100 then
    raise exception 'INVALID_IDEMPOTENCY_KEY';
  end if;
  if p_guest_token_hash is null or p_guest_token_hash !~ '^[0-9a-f]{64}$'
     or p_request_hash is null or p_request_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'INVALID_SECURITY_TOKEN';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 50 then
    raise exception 'INVALID_ITEMS';
  end if;

  -- Serialize requests for the same merchant/idempotency key.
  perform pg_advisory_xact_lock(hashtext(p_owner_id), hashtext(p_idempotency_key));
  select id, request_hash into v_existing_id, v_existing_request_hash
    from public.orders
   where "ownerId" = p_owner_id and idempotency_key = p_idempotency_key
   limit 1;
  if v_existing_id is not null then
    if v_existing_request_hash is distinct from p_request_hash then
      raise exception 'IDEMPOTENCY_CONFLICT';
    end if;
    return jsonb_build_object(
      'orderId', v_existing_id,
      'items', (select items from public.orders where id = v_existing_id),
      'total', (select total from public.orders where id = v_existing_id),
      'tableNumber', (select "tableNumber" from public.orders where id = v_existing_id),
      'createdAt', (select "createdAt" from public.orders where id = v_existing_id),
      'replayed', true
    );
  end if;

  for v_line in
    select value as line from jsonb_array_elements(p_items)
  loop
    v_item_id := v_line.line->>'id';
    v_quantity := (v_line.line->>'quantity')::integer;
    if v_item_id is null or length(v_item_id) < 1 or length(v_item_id) > 128
       or v_quantity is null or v_quantity < 1 or v_quantity > 20 then
      raise exception 'INVALID_ITEM_LINE';
    end if;

    select mi.id::text, mi.name::text, mi.price::numeric
      into v_item_id, v_item_name, v_item_price
      from public.menu_items mi
     where mi.id::text = v_line.line->>'id'
       and mi."ownerId"::text = p_owner_id
       and coalesce(mi."isAiOnly", false) = false
     limit 1;

    if not found or v_item_price is null or v_item_price <= 0 then
      raise exception 'ITEM_UNAVAILABLE';
    end if;
    if v_item_price > 1000000 then
      raise exception 'INVALID_CATALOG_PRICE';
    end if;

    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'id', v_item_id,
      'name', left(coalesce(v_item_name, ''), 200),
      'price', v_item_price,
      'quantity', v_quantity
    ));
    v_total := v_total + (v_item_price * v_quantity);
  end loop;

  if v_total <= 0 or v_total > 10000000 then
    raise exception 'INVALID_ORDER_TOTAL';
  end if;

  v_order_id := 'order_' || replace(gen_random_uuid()::text, '-', '');
  insert into public.orders (
    id, "ownerId", "tableNumber", items, total, status, "createdAt",
    guest_token_hash, guest_token_expires_at, idempotency_key, request_hash
  ) values (
    v_order_id, p_owner_id, p_table_number, v_items, v_total, 'pending',
    v_created_at, p_guest_token_hash, now() + interval '7 days', p_idempotency_key, p_request_hash
  );

  insert into public.order_outbox(order_id, owner_id, event_type, payload)
  values (
    v_order_id, p_owner_id, 'order.created',
    jsonb_build_object(
      'orderId', v_order_id,
      'ownerId', p_owner_id,
      'tableNumber', p_table_number,
      'items', v_items,
      'total', v_total,
      'currency', null,
      'status', 'pending'
    )
  );

  return jsonb_build_object(
    'orderId', v_order_id,
    'items', v_items,
    'total', v_total,
    'tableNumber', p_table_number,
    'createdAt', v_created_at,
    'replayed', false
  );
end;
$$;

revoke all on function public.create_guest_order(text,text,jsonb,text,text,text) from public, anon, authenticated;
grant execute on function public.create_guest_order(text,text,jsonb,text,text,text) to service_role;

commit;
