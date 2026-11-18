-- Merchant preference schema, explicit upsert compatibility and tenant isolation.
insert into auth.users(id) values
 ('55555555-5555-4555-8555-555555555555'),
 ('66666666-6666-4666-8666-666666666666')
on conflict do nothing;
set role authenticated;
select set_config('request.jwt.claim.sub', '55555555-5555-4555-8555-555555555555', false);
insert into public.merchant_settings("ownerId", dialect, "voiceTone", "businessType", currency, "updatedAt")
values (auth.uid(), 'egyptian', 'Kore', 'restaurant', 'EGP', 1795029000000)
on conflict ("ownerId") do update set dialect=excluded.dialect, "voiceTone"=excluded."voiceTone",
 "businessType"=excluded."businessType", currency=excluded.currency, "updatedAt"=excluded."updatedAt";
do $$
declare v_count integer;
begin
 select count(*) into v_count from public.merchant_settings where "ownerId"=auth.uid() and dialect='egyptian' and "voiceTone"='Kore' and currency='EGP';
 if v_count <> 1 then raise exception 'MERCHANT_SETTINGS_OWNER_SAVE_FAILED'; end if;
 update public.merchant_settings set "voiceTone"='Puck' where "ownerId"='66666666-6666-4666-8666-666666666666';
 get diagnostics v_count = row_count;
 if v_count <> 0 then raise exception 'MERCHANT_SETTINGS_CROSS_TENANT_UPDATE_ALLOWED'; end if;
end;
$$;
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', '66666666-6666-4666-8666-666666666666', false);
do $$ declare v_count integer; begin
 select count(*) into v_count from public.merchant_settings;
 if v_count <> 0 then raise exception 'MERCHANT_SETTINGS_CROSS_TENANT_READ_LEAK'; end if;
end; $$;
reset role;
-- Anonymous access is denied at the SQL privilege layer; assert this as
-- the migration owner rather than issuing a query that is expected to error.
do $
begin
 if has_table_privilege('anon','public.merchant_settings','SELECT')
    or has_table_privilege('anon','public.merchant_settings','INSERT')
    or has_table_privilege('anon','public.merchant_settings','UPDATE') then
   raise exception 'MERCHANT_SETTINGS_ANON_GRANTS_INVALID';
 end if;
 if not has_table_privilege('authenticated','public.merchant_settings','SELECT')
    or not has_table_privilege('authenticated','public.merchant_settings','INSERT')
    or not has_table_privilege('authenticated','public.merchant_settings','UPDATE')
    or has_table_privilege('authenticated','public.merchant_settings','DELETE') then
   raise exception 'MERCHANT_SETTINGS_AUTHENTICATED_GRANTS_INVALID';
 end if;
end;
$$;
select 'MERCHANT_SETTINGS_MIGRATION_TESTS_PASSED' as result;
