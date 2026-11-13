-- SooVoice — Store & Access Settings (per merchant)
-- Controls: restaurant identity shown to customers, voice waiter visibility,
-- geo-fence radius around the restaurant location, and menu session duration.
--
-- Run once in the Supabase SQL Editor (Dashboard → SQL → New query → Run).

create table if not exists store_settings (
  ownerId uuid primary key,
  restaurantName text not null default '',
  restaurantNameEn text not null default '',
  phone text not null default '',
  address text not null default '',
  showVoiceWidget boolean not null default true,
  geoEnabled boolean not null default false,
  geoRadiusKm numeric not null default 0.5,
  geoLat double precision,
  geoLng double precision,
  sessionMinutes integer not null default 0,
  updatedAt bigint not null default 0
);

alter table store_settings enable row level security;

-- Customers scanning the QR must be able to READ the settings (anon, public).
drop policy if exists "store_settings_public_read" on store_settings;
create policy "store_settings_public_read"
  on store_settings for select
  using (true);

-- Merchants can insert/update only their own row.
drop policy if exists "store_settings_owner_insert" on store_settings;
create policy "store_settings_owner_insert"
  on store_settings for insert
  to authenticated
  with check (ownerId = auth.uid());

drop policy if exists "store_settings_owner_update" on store_settings;
create policy "store_settings_owner_update"
  on store_settings for update
  to authenticated
  using (ownerId = auth.uid())
  with check (ownerId = auth.uid());
