-- Merchant voice and assistant preferences.
-- These columns are read/written by SettingsContext, VoiceStudio and the guest
-- voice experience. Keep this table private to the owning authenticated merchant.
begin;
create table if not exists public.merchant_settings (
  "ownerId" uuid primary key,
  dialect text not null default 'standard',
  "voiceTone" text not null default 'Zephyr',
  "businessType" text not null default 'restaurant',
  currency text not null default 'EGP',
  "updatedAt" bigint not null default 0
);
-- Upgrade installations that created the table manually with PostgreSQL-folded
-- camelCase names, without dropping existing merchant preferences.
do $migration$
declare v_pair text[];
begin
  foreach v_pair slice 1 in array array[
    array['ownerid','ownerId'], array['voicetone','voiceTone'],
    array['businesstype','businessType'], array['updatedat','updatedAt']
  ] loop
    if exists (select 1 from information_schema.columns where table_schema='public' and table_name='merchant_settings' and column_name=v_pair[1])
       and not exists (select 1 from information_schema.columns where table_schema='public' and table_name='merchant_settings' and column_name=v_pair[2]) then
      execute format('alter table public.merchant_settings rename column %I to %I', v_pair[1], v_pair[2]);
    end if;
  end loop;
end;
$migration$;
alter table public.merchant_settings
  add column if not exists "ownerId" uuid,
  add column if not exists dialect text not null default 'standard',
  add column if not exists "voiceTone" text not null default 'Zephyr',
  add column if not exists "businessType" text not null default 'restaurant',
  add column if not exists currency text not null default 'EGP',
  add column if not exists "updatedAt" bigint not null default 0;
create unique index if not exists merchant_settings_owner_id_uidx on public.merchant_settings ("ownerId");
alter table public.merchant_settings enable row level security;
drop policy if exists "merchant_settings_owner_read" on public.merchant_settings;
create policy "merchant_settings_owner_read" on public.merchant_settings for select to authenticated using ("ownerId" = auth.uid());
drop policy if exists "merchant_settings_owner_insert" on public.merchant_settings;
create policy "merchant_settings_owner_insert" on public.merchant_settings for insert to authenticated with check ("ownerId" = auth.uid());
drop policy if exists "merchant_settings_owner_update" on public.merchant_settings;
create policy "merchant_settings_owner_update" on public.merchant_settings for update to authenticated using ("ownerId" = auth.uid()) with check ("ownerId" = auth.uid());
revoke all on public.merchant_settings from public;
revoke all on public.merchant_settings from anon;
revoke all on public.merchant_settings from authenticated;
grant select, insert, update on public.merchant_settings to authenticated;
grant all on public.merchant_settings to service_role;
commit;
