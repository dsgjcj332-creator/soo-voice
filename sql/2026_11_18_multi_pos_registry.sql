-- SooVoice multi-POS foundation.
-- Credentials are ciphertext only. Encrypt/decrypt in trusted server code with
-- a key held in the deployment secret manager; never store provider tokens
-- in plaintext or expose them to browser clients.
begin;

create table if not exists public.pos_connections (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in (
    'foodics','toast','square','clover','lightspeed',
    'oracle_simphony','odoo','shopify_pos','salla','custom'
  )),
  display_name text,
  status text not null default 'pending'
    check (status in ('pending','connected','degraded','reauthorization_required','disconnected')),
  credentials_ciphertext text,
  credentials_key_version text,
  granted_scopes text[] not null default '{}',
  last_sync_at timestamptz,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pos_connections_owner_idx
  on public.pos_connections(owner_id, created_at desc);

create table if not exists public.pos_locations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  connection_id uuid not null references public.pos_connections(id) on delete cascade,
  provider_location_id text not null,
  name text not null,
  timezone text,
  currency text check (currency is null or currency ~ '^[A-Z]{3}$'),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(connection_id, provider_location_id),
  unique(owner_id, id)
);

create index if not exists pos_locations_owner_idx
  on public.pos_locations(owner_id, connection_id);

create table if not exists public.pos_sync_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  connection_id uuid not null references public.pos_connections(id) on delete cascade,
  provider_event_id text not null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending'
    check (status in ('pending','processing','processed','failed')),
  attempts integer not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz not null default now(),
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  last_error_code text,
  unique(connection_id, provider_event_id)
);

create index if not exists pos_sync_events_worker_idx
  on public.pos_sync_events(status, next_attempt_at)
  where status in ('pending','failed');

create table if not exists public.pos_order_links (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  connection_id uuid not null references public.pos_connections(id) on delete cascade,
  location_id uuid references public.pos_locations(id) on delete set null,
  local_order_id text not null,
  provider_order_id text,
  idempotency_key text not null,
  status text not null default 'pending'
    check (status in ('pending','accepted','rejected','cancelled','unknown')),
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(connection_id, idempotency_key),
  unique(connection_id, provider_order_id)
);

create index if not exists pos_order_links_owner_idx
  on public.pos_order_links(owner_id, created_at desc);

-- Tenant isolation: authenticated merchants can read only their own
-- connection metadata and sync/order history. All writes, webhook ingestion,
-- token rotation and credential handling must go through trusted server code
-- using service-role credentials stored only in the deployment secret store.
alter table public.pos_connections enable row level security;
alter table public.pos_locations enable row level security;
alter table public.pos_sync_events enable row level security;
alter table public.pos_order_links enable row level security;

drop policy if exists pos_connections_owner_read on public.pos_connections;
create policy pos_connections_owner_read on public.pos_connections
  for select to authenticated using (owner_id = auth.uid());

drop policy if exists pos_locations_owner_read on public.pos_locations;
create policy pos_locations_owner_read on public.pos_locations
  for select to authenticated using (owner_id = auth.uid());

drop policy if exists pos_sync_events_owner_read on public.pos_sync_events;
create policy pos_sync_events_owner_read on public.pos_sync_events
  for select to authenticated using (owner_id = auth.uid());

drop policy if exists pos_order_links_owner_read on public.pos_order_links;
create policy pos_order_links_owner_read on public.pos_order_links
  for select to authenticated using (owner_id = auth.uid());

-- No authenticated INSERT/UPDATE/DELETE policies are created intentionally.
-- The backend must validate tenant ownership and write using service role.

commit;
