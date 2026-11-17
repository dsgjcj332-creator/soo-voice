-- Minimal Supabase-compatible auth roles/functions for isolated PostgreSQL migration tests.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

create schema auth;
create table auth.users (
  id uuid primary key
);

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

create or replace function auth.role()
returns text
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.role', true), '');
$$;

grant usage on schema auth to anon, authenticated, service_role;
grant select on auth.users to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
grant execute on function auth.role() to anon, authenticated, service_role;

-- Minimal menu table matching the columns used by the production menu service
-- and the POS apply RPC. This is isolated CI schema, not a production migration.
create table public.menu_items (
  id text primary key,
  "ownerId" text not null,
  name text not null,
  description text,
  price numeric not null,
  "isAiOnly" boolean not null default false
);
