-- Complete the store profile schema used by the Settings page.
-- Safe to apply to projects that already ran sql/store_settings.sql.

begin;

alter table public.store_settings
  add column if not exists "logoUrl" text not null default '',
  add column if not exists "workingHours" text not null default '',
  add column if not exists instagram text not null default '',
  add column if not exists facebook text not null default '',
  add column if not exists whatsapp text not null default '';

alter table public.store_settings enable row level security;

drop policy if exists "store_settings_public_read" on public.store_settings;
create policy "store_settings_public_read"
  on public.store_settings for select
  to anon
  using (true);

drop policy if exists "store_settings_owner_read" on public.store_settings;
create policy "store_settings_owner_read"
  on public.store_settings for select
  to authenticated
  using ("ownerId" = auth.uid());

drop policy if exists "store_settings_owner_insert" on public.store_settings;
create policy "store_settings_owner_insert"
  on public.store_settings for insert
  to authenticated
  with check ("ownerId" = auth.uid());

drop policy if exists "store_settings_owner_update" on public.store_settings;
create policy "store_settings_owner_update"
  on public.store_settings for update
  to authenticated
  using ("ownerId" = auth.uid())
  with check ("ownerId" = auth.uid());

revoke all on public.store_settings from public;
revoke all on public.store_settings from anon;
revoke all on public.store_settings from authenticated;
grant select on public.store_settings to anon, authenticated;
grant insert, update on public.store_settings to authenticated;
grant all on public.store_settings to service_role;

commit;
