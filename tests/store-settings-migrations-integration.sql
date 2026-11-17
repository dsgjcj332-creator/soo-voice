-- Store settings schema, explicit persistence and tenant isolation.

insert into auth.users(id) values
 ('11111111-1111-4111-8111-111111111111'),
 ('22222222-2222-4222-8222-222222222222')
on conflict do nothing;

set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false);
insert into public.store_settings(
  "ownerId", "restaurantName", "logoUrl", "workingHours",
  instagram, facebook, whatsapp, "showVoiceWidget"
) values (
  '11111111-1111-4111-8111-111111111111',
  'SooVoice Test Restaurant', 'https://example.test/logo.png',
  'Daily 10:00-22:00', 'https://instagram.com/test',
  'https://facebook.com/test', '+201000000000', true
);
do $$
declare v_count integer;
begin
  select count(*) into v_count from public.store_settings
   where "ownerId" = auth.uid()
     and "logoUrl" = 'https://example.test/logo.png'
     and "workingHours" = 'Daily 10:00-22:00';
  if v_count <> 1 then raise exception 'STORE_SETTINGS_OWNER_SAVE_FAILED'; end if;

  update public.store_settings set "restaurantName" = 'Updated name'
   where "ownerId" = '22222222-2222-4222-8222-222222222222';
  get diagnostics v_count = row_count;
  if v_count <> 0 then raise exception 'STORE_SETTINGS_CROSS_TENANT_UPDATE_ALLOWED'; end if;
end;
$$;
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', false);
do $$
declare v_count integer;
begin
  select count(*) into v_count from public.store_settings;
  if v_count <> 0 then raise exception 'STORE_SETTINGS_CROSS_TENANT_READ_LEAK'; end if;
end;
$$;
reset role;

set role anon;
do $$
declare v_count integer;
begin
  select count(*) into v_count from public.store_settings;
  if v_count <> 1 then raise exception 'STORE_SETTINGS_PUBLIC_MENU_READ_FAILED'; end if;
end;
$$;
reset role;

do $$
begin
  if not has_table_privilege('anon', 'public.store_settings', 'SELECT')
     or has_table_privilege('anon', 'public.store_settings', 'INSERT')
     or has_table_privilege('anon', 'public.store_settings', 'UPDATE')
     or has_table_privilege('authenticated', 'public.store_settings', 'DELETE') then
    raise exception 'STORE_SETTINGS_CLIENT_GRANTS_INVALID';
  end if;
  if not exists (
    select 1 from information_schema.columns
     where table_schema='public' and table_name='store_settings'
       and column_name='logoUrl'
  ) or not exists (
    select 1 from information_schema.columns
     where table_schema='public' and table_name='store_settings'
       and column_name='workingHours'
  ) then
    raise exception 'STORE_SETTINGS_PROFILE_COLUMNS_MISSING';
  end if;
end;
$$;

select 'STORE_SETTINGS_MIGRATION_TESTS_PASSED' as result;
