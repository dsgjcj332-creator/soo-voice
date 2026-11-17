-- Enforce lease expiry at completion/retry time, not only when another
-- worker reclaims a row. A worker whose lease expired must not be able to
-- acknowledge delivery after a slow provider call.
begin;

alter table public.order_outbox
  add column if not exists lease_expires_at timestamptz;

-- Recover legacy processing rows that have no usable lease metadata.
update public.order_outbox
   set status = 'pending',
       locked_at = null,
       locked_by = null,
       lease_expires_at = null
 where status = 'processing'
   and locked_at is null;

-- Preserve still-live leases created before this migration. Their original
-- claim duration was bounded to 900 seconds; use the maximum allowed 15-minute lease as a safe
-- fallback when a timestamp is unexpectedly absent.
update public.order_outbox
   set lease_expires_at = coalesce(lease_expires_at, locked_at + interval '15 minutes')
 where status = 'processing'
   and locked_at is not null
   and lease_expires_at is null;

create index if not exists order_outbox_lease_expiry_idx
  on public.order_outbox(lease_expires_at)
  where status = 'processing';

create or replace function public.claim_order_outbox(
  p_worker_id text,
  p_limit integer default 10,
  p_lease_seconds integer default 120
) returns setof public.order_outbox
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_worker_id is null or length(p_worker_id) < 8 or length(p_worker_id) > 128
     or p_limit is null or p_limit < 1 or p_limit > 50
     or p_lease_seconds is null or p_lease_seconds < 30 or p_lease_seconds > 900 then
    raise exception 'INVALID_WORKER_CLAIM';
  end if;

  return query
  with candidates as (
    select id
      from public.order_outbox
     where (
       (status in ('pending','failed') and next_attempt_at <= now())
       or (status = 'processing' and lease_expires_at <= now())
     )
       and attempts < max_attempts
     order by created_at asc
     limit p_limit
     for update skip locked
  )
  update public.order_outbox o
     set status = 'processing',
         locked_at = now(),
         locked_by = p_worker_id,
         lease_expires_at = now() + make_interval(secs => p_lease_seconds)
    from candidates c
   where o.id = c.id
  returning o.*;
end;
$$;

create or replace function public.complete_order_outbox(
  p_event_id uuid,
  p_worker_id text,
  p_provider_id text,
  p_connection_id uuid,
  p_location_id uuid,
  p_provider_order_id text
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.order_outbox%rowtype;
  v_provider text;
begin
  if p_provider_id is null or p_provider_order_id is null
     or length(p_provider_order_id) < 1 or length(p_provider_order_id) > 200 then
    raise exception 'INVALID_PROVIDER_ACCEPTANCE';
  end if;

  select * into v_event
    from public.order_outbox
   where id = p_event_id
     and status = 'processing'
     and locked_by = p_worker_id
     and lease_expires_at > now()
   for update;
  if not found then return false; end if;

  select provider into v_provider
    from public.pos_connections
   where id = p_connection_id
     and owner_id::text = v_event.owner_id
     and status = 'connected';
  if not found or v_provider is distinct from p_provider_id then
    raise exception 'POS_CONNECTION_NOT_AVAILABLE';
  end if;

  if p_location_id is not null and not exists (
    select 1 from public.pos_locations
     where id = p_location_id
       and connection_id = p_connection_id
       and owner_id::text = v_event.owner_id
       and active = true
  ) then
    raise exception 'POS_LOCATION_NOT_AVAILABLE';
  end if;

  insert into public.pos_order_links(
    owner_id, connection_id, location_id, local_order_id,
    provider_order_id, idempotency_key, status, last_synced_at
  ) values (
    v_event.owner_id::uuid, p_connection_id, p_location_id,
    v_event.payload->>'orderId', p_provider_order_id,
    'soovoice:' || (v_event.payload->>'orderId'), 'accepted', now()
  )
  on conflict (connection_id, idempotency_key)
  do update set
    provider_order_id = excluded.provider_order_id,
    status = 'accepted',
    last_synced_at = now(),
    updated_at = now();

  update public.order_outbox
     set status = 'delivered',
         delivered_at = now(),
         locked_at = null,
         locked_by = null,
         lease_expires_at = null,
         provider_id = p_provider_id,
         connection_id = p_connection_id,
         location_id = p_location_id,
         provider_order_id = p_provider_order_id,
         last_error_code = null
   where id = p_event_id;
  return true;
end;
$$;

create or replace function public.retry_order_outbox(
  p_event_id uuid,
  p_worker_id text,
  p_error_code text
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
begin
  update public.order_outbox
     set attempts = attempts + 1,
         status = case when attempts + 1 >= max_attempts then 'dead_letter' else 'failed' end,
         next_attempt_at = now() + make_interval(secs => least(3600, (power(2, least(attempts, 10))::integer * 5))),
         locked_at = null,
         locked_by = null,
         lease_expires_at = null,
         last_error_code = left(coalesce(p_error_code, 'DISPATCH_FAILED'), 80)
   where id = p_event_id
     and status = 'processing'
     and locked_by = p_worker_id
     and lease_expires_at > now()
  returning status into v_status;

  if not found then
    raise exception 'OUTBOX_LEASE_NOT_OWNED_OR_EXPIRED';
  end if;
  return v_status;
end;
$$;

revoke all on function public.claim_order_outbox(text,integer,integer) from public, anon, authenticated;
revoke all on function public.complete_order_outbox(uuid,text,text,uuid,uuid,text) from public, anon, authenticated;
revoke all on function public.retry_order_outbox(uuid,text,text) from public, anon, authenticated;
grant execute on function public.claim_order_outbox(text,integer,integer) to service_role;
grant execute on function public.complete_order_outbox(uuid,text,text,uuid,uuid,text) to service_role;
grant execute on function public.retry_order_outbox(uuid,text,text) to service_role;

commit;
