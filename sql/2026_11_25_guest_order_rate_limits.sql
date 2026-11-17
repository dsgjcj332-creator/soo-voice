-- Durable guest-checkout rate limits shared by every serverless instance.
-- Bucket identifiers are HMACs generated server-side; raw IP addresses are never stored.

begin;

create table if not exists public.guest_order_rate_limit_buckets (
  bucket_key text primary key
    check (bucket_key ~ '^(owner|client):[0-9a-f]{64}$'),
  window_started_at timestamptz not null,
  request_count integer not null default 0 check (request_count >= 0),
  last_seen_at timestamptz not null default now()
);

create index if not exists guest_order_rate_limit_last_seen_idx
  on public.guest_order_rate_limit_buckets(last_seen_at);

alter table public.guest_order_rate_limit_buckets enable row level security;
revoke all on public.guest_order_rate_limit_buckets from public, anon, authenticated;
grant select, insert, update, delete on public.guest_order_rate_limit_buckets to service_role;

create or replace function public.consume_guest_order_rate_limit(
  p_owner_bucket text,
  p_client_bucket text,
  p_window_seconds integer default 60,
  p_owner_limit integer default 120,
  p_client_limit integer default 20
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_window_start timestamptz;
  v_owner_count integer;
  v_client_count integer;
begin
  if p_owner_bucket is null or p_owner_bucket !~ '^owner:[0-9a-f]{64}$'
     or p_client_bucket is null or p_client_bucket !~ '^client:[0-9a-f]{64}$'
     or p_window_seconds is null or p_window_seconds < 10 or p_window_seconds > 3600
     or p_owner_limit is null or p_owner_limit < 1 or p_owner_limit > 10000
     or p_client_limit is null or p_client_limit < 1 or p_client_limit > 1000 then
    raise exception 'INVALID_GUEST_ORDER_RATE_LIMIT';
  end if;

  v_window_start := to_timestamp(
    floor(extract(epoch from v_now) / p_window_seconds) * p_window_seconds
  );

  -- A stable lock order prevents deadlocks when many clients hit one merchant.
  perform pg_advisory_xact_lock(hashtextextended(p_owner_bucket, 0));
  perform pg_advisory_xact_lock(hashtextextended(p_client_bucket, 0));

  insert into public.guest_order_rate_limit_buckets(
    bucket_key, window_started_at, request_count, last_seen_at
  ) values (p_owner_bucket, v_window_start, 1, v_now)
  on conflict (bucket_key) do update
    set window_started_at = case
          when guest_order_rate_limit_buckets.window_started_at < excluded.window_started_at
          then excluded.window_started_at
          else guest_order_rate_limit_buckets.window_started_at
        end,
        request_count = case
          when guest_order_rate_limit_buckets.window_started_at < excluded.window_started_at
          then 1
          else guest_order_rate_limit_buckets.request_count + 1
        end,
        last_seen_at = excluded.last_seen_at
  returning request_count into v_owner_count;

  insert into public.guest_order_rate_limit_buckets(
    bucket_key, window_started_at, request_count, last_seen_at
  ) values (p_client_bucket, v_window_start, 1, v_now)
  on conflict (bucket_key) do update
    set window_started_at = case
          when guest_order_rate_limit_buckets.window_started_at < excluded.window_started_at
          then excluded.window_started_at
          else guest_order_rate_limit_buckets.window_started_at
        end,
        request_count = case
          when guest_order_rate_limit_buckets.window_started_at < excluded.window_started_at
          then 1
          else guest_order_rate_limit_buckets.request_count + 1
        end,
        last_seen_at = excluded.last_seen_at
  returning request_count into v_client_count;

  -- Opportunistic cleanup bounds storage without requiring pg_cron. A stale
  -- request arriving after a newer window is conservatively counted forward.
  if mod(floor(extract(epoch from v_now))::bigint, 60) = 0 then
    delete from public.guest_order_rate_limit_buckets
     where last_seen_at < v_now - interval '24 hours';
  end if;

  return v_owner_count <= p_owner_limit and v_client_count <= p_client_limit;
end;
$$;

revoke all on function public.consume_guest_order_rate_limit(text,text,integer,integer,integer)
  from public, anon, authenticated;
grant execute on function public.consume_guest_order_rate_limit(text,text,integer,integer,integer)
  to service_role;

commit;
