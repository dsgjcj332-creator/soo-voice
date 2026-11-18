-- Server-authoritative checkout validation and pricing for structured menu modifiers.
begin;

alter table public.orders
  add column if not exists order_notes text not null default '';

create or replace function public.create_guest_order(
  p_owner_id text,
  p_table_number text,
  p_items jsonb,
  p_order_notes text,
  p_modifiers_version integer,
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
  v_group record;
  v_option record;
  v_item_id text;
  v_item_name text;
  v_item_price numeric(12,2);
  v_quantity integer;
  v_notes text := left(btrim(coalesce(p_order_notes, '')), 1000);
  v_line_modifiers jsonb;
  v_group_modifiers jsonb;
  v_option_ids jsonb;
  v_selected_count integer;
  v_modifier_total numeric(12,2);
  v_line_price numeric(12,2);
  v_modifier_entry jsonb;
  v_group_options jsonb;
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
  if p_order_notes is not null and length(p_order_notes) > 1000 then
    raise exception 'INVALID_ORDER_NOTES';
  end if;
  if p_modifiers_version is distinct from 1 then
    raise exception 'INVALID_MODIFIERS_VERSION';
  end if;
  if p_items is null or jsonb_typeof(p_items) is distinct from 'array'
     or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 50 then
    raise exception 'INVALID_ITEMS';
  end if;

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
      'notes', coalesce((select order_notes from public.orders where id = v_existing_id), ''),
      'replayed', true
    );
  end if;

  for v_line in select value as line from jsonb_array_elements(p_items)
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
     limit 1;
    if not found or v_item_price is null or v_item_price <= 0 then
      raise exception 'ITEM_UNAVAILABLE';
    end if;
    if v_item_price > 1000000 then
      raise exception 'INVALID_CATALOG_PRICE';
    end if;

    v_line_modifiers := coalesce(v_line.line->'modifiers', '[]'::jsonb);
    if jsonb_typeof(v_line_modifiers) is distinct from 'array'
       or jsonb_array_length(v_line_modifiers) > 20 then
      raise exception 'INVALID_MODIFIERS';
    end if;
    if exists (
      select 1
        from jsonb_array_elements(v_line_modifiers) m
       group by m->>'groupId'
      having count(*) > 1 or m->>'groupId' is null
    ) then
      raise exception 'INVALID_MODIFIER_GROUP';
    end if;

    v_group_modifiers := '[]'::jsonb;
    v_modifier_total := 0;

    for v_group in
      select g.id, g.name, g.min_select, g.max_select
        from public.menu_modifier_groups g
       where g.owner_id::text = p_owner_id
         and g.menu_item_id = v_item_id
         and g.is_active = true
       order by g.sort_order, g.id
    loop
      select m into v_modifier_entry
        from jsonb_array_elements(v_line_modifiers) m
       where m->>'groupId' = v_group.id::text
       limit 1;

      v_option_ids := case
        when v_modifier_entry is null then '[]'::jsonb
        else v_modifier_entry->'optionIds'
      end;
      if v_option_ids is null or jsonb_typeof(v_option_ids) is distinct from 'array'
         or jsonb_array_length(v_option_ids) > 20 then
        raise exception 'INVALID_MODIFIER_OPTIONS';
      end if;

      select count(*)::integer into v_selected_count
        from jsonb_array_elements(v_option_ids);
      if v_selected_count < v_group.min_select or v_selected_count > v_group.max_select then
        raise exception 'INVALID_MODIFIER_SELECTION';
      end if;
      if exists (
        select 1 from jsonb_array_elements_text(v_option_ids) as chosen(option_id)
        group by option_id having count(*) > 1
      ) then
        raise exception 'DUPLICATE_MODIFIER_OPTION';
      end if;

      v_group_options := '[]'::jsonb;
      for v_option in
          select o.id, o.name, o.price_delta
            from jsonb_array_elements_text(v_option_ids) chosen(option_id)
            join public.menu_modifier_options o
              on o.id::text = chosen.option_id
             and o.group_id = v_group.id
             and o.owner_id::text = p_owner_id
             and o.is_active = true
           order by o.sort_order, o.id
        loop
          v_group_options := v_group_options || jsonb_build_array(jsonb_build_object(
            'id', v_option.id,
            'name', v_option.name,
            'priceDelta', v_option.price_delta
          ));
          v_modifier_total := v_modifier_total + v_option.price_delta;
      end loop;

      if jsonb_array_length(v_group_options) <> v_selected_count then
        raise exception 'MODIFIER_UNAVAILABLE';
      end if;
      if v_selected_count > 0 then
        v_group_modifiers := v_group_modifiers || jsonb_build_array(jsonb_build_object(
          'groupId', v_group.id,
          'groupName', v_group.name,
          'options', v_group_options
        ));
      end if;
    end loop;

    -- Reject groups that are inactive, belong to another item, or another merchant.
    if jsonb_array_length(v_line_modifiers) <> (
      select count(*)
        from jsonb_array_elements(v_line_modifiers) submitted
        join public.menu_modifier_groups g
          on g.id::text = submitted->>'groupId'
         and g.owner_id::text = p_owner_id
         and g.menu_item_id = v_item_id
         and g.is_active = true
    ) then
      raise exception 'INVALID_MODIFIER_GROUP';
    end if;

    v_line_price := v_item_price + v_modifier_total;
    if v_line_price > 1000000 then
      raise exception 'INVALID_ORDER_TOTAL';
    end if;

    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'id', v_item_id,
      'name', left(coalesce(v_item_name, ''), 200),
      'price', v_line_price,
      'basePrice', v_item_price,
      'quantity', v_quantity,
      'modifiers', v_group_modifiers
    ));
    v_total := v_total + (v_line_price * v_quantity);
  end loop;

  if v_total <= 0 or v_total > 10000000 then
    raise exception 'INVALID_ORDER_TOTAL';
  end if;

  v_order_id := 'order_' || replace(gen_random_uuid()::text, '-', '');
  insert into public.orders (
    id, "ownerId", "tableNumber", items, total, status, "createdAt", order_notes,
    guest_token_hash, guest_token_expires_at, idempotency_key, request_hash
  ) values (
    v_order_id, p_owner_id, p_table_number, v_items, v_total, 'pending',
    v_created_at, v_notes, p_guest_token_hash, now() + interval '7 days',
    p_idempotency_key, p_request_hash
  );

  insert into public.order_outbox(order_id, owner_id, event_type, payload)
  values (
    v_order_id, p_owner_id, 'order.created',
    jsonb_build_object(
      'orderId', v_order_id, 'ownerId', p_owner_id, 'tableNumber', p_table_number,
      'items', v_items, 'total', v_total, 'currency', null, 'notes', v_notes, 'status', 'pending'
    )
  );

  return jsonb_build_object(
    'orderId', v_order_id, 'items', v_items, 'total', v_total,
    'tableNumber', p_table_number, 'createdAt', v_created_at, 'notes', v_notes, 'replayed', false
  );
end;
$$;

revoke all on function public.create_guest_order(text,text,jsonb,text,integer,text,text,text) from public, anon, authenticated;
grant execute on function public.create_guest_order(text,text,jsonb,text,integer,text,text,text) to service_role;

commit;
