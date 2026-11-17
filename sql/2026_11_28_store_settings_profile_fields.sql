-- Complete the store profile schema used by the Settings page.
-- Safe to apply to projects that already ran sql/store_settings.sql.

begin;

-- The original hand-written SQL declared camelCase identifiers without
-- quotes, which PostgreSQL silently folded to lowercase. Rename those legacy
-- columns to the exact names used by the Supabase client before adding fields.
do $
declare
  v_pair text[];
begin
  foreach v_pair slice 1 in array array[
    array['ownerid','ownerId'],
    array['restaurantname','restaurantName'],
    array['restaurantnameen','restaurantNameEn'],
    array['showvoicewidget','showVoiceWidget'],
    array['geoenabled','geoEnabled'],
    array['georadiuskm','geoRadiusKm'],
    array['geolat','geoLat'],
    array['geolng','geoLng'],
    array['sessionminutes','sessionMinutes'],
    array['updatedat','updatedAt']
  ] loop
    if exists (
      select 1 from information_schema.columns
       where table_schema='public' and table_name='store_settings'
         and column_name=v_pair[1]
    ) and not exists (
      select 1 from information_schema.columns
       where table_schema='public' and table_name='store_settings'
         and column_name=v_pair[2]
    ) then
      execute format('alter table public.store_settings rename column %I to %I', v_pair[1], v_pair[2]);
    end if;
  end loop;
end;
$;

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
