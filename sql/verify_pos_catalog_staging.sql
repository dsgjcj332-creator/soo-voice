-- Read-only post-migration verification for SooVoice POS catalog staging.
-- Run after applying, in order:
--   2026_11_18_multi_pos_registry.sql
--   2026_11_21_pos_catalog_storage.sql
--   2026_11_22_pos_catalog_menu_mapping.sql
--   2026_11_23_pos_catalog_menu_apply.sql
--   2026_11_24_pos_webhook_ingress.sql
-- This script creates/updates no objects and writes no rows.

do $$
declare
  v_sync_fn regprocedure := to_regprocedure(
    'public.sync_pos_catalog_snapshot(uuid,uuid,uuid,jsonb,boolean)'
  );
  v_trigger_fn regprocedure := to_regprocedure(
    'public.log_pos_catalog_menu_link_change()'
  );
  v_webhook_fn regprocedure := to_regprocedure(
    'public.ingest_pos_catalog_webhook(uuid,uuid,uuid,text,text,jsonb,jsonb,boolean)'
  );
  v_missing text;
begin
  if to_regclass('public.pos_connections') is null
     or to_regclass('public.pos_locations') is null
     or to_regclass('public.pos_catalog_items') is null
     or to_regclass('public.pos_catalog_menu_links') is null
     or to_regclass('public.pos_catalog_menu_link_events') is null then
    raise exception 'POS_STAGING_MISSING_REQUIRED_TABLES';
  end if;

  if v_sync_fn is null or v_trigger_fn is null or v_webhook_fn is null then
    raise exception 'POS_STAGING_MISSING_REQUIRED_FUNCTIONS';
  end if;

  if not (select relrowsecurity from pg_class where oid = 'public.pos_catalog_items'::regclass)
     or not (select relrowsecurity from pg_class where oid = 'public.pos_catalog_menu_links'::regclass)
     or not (select relrowsecurity from pg_class where oid = 'public.pos_catalog_menu_link_events'::regclass) then
    raise exception 'POS_STAGING_RLS_NOT_ENABLED';
  end if;

  if not exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'pos_catalog_items'
       and policyname = 'pos_catalog_items_owner_read'
       and cmd = 'SELECT' and roles @> array['authenticated']::name[]
  ) or not exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'pos_catalog_menu_links'
       and policyname = 'pos_catalog_menu_links_owner_read'
       and cmd = 'SELECT' and roles @> array['authenticated']::name[]
  ) or not exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'pos_catalog_menu_link_events'
       and policyname = 'pos_catalog_menu_link_events_owner_read'
       and cmd = 'SELECT' and roles @> array['authenticated']::name[]
  ) then
    raise exception 'POS_STAGING_OWNER_READ_POLICIES_MISSING';
  end if;

  if not has_table_privilege('authenticated', 'public.pos_catalog_items', 'SELECT')
     or not has_table_privilege('authenticated', 'public.pos_catalog_menu_links', 'SELECT')
     or not has_table_privilege('authenticated', 'public.pos_catalog_menu_link_events', 'SELECT') then
    raise exception 'POS_STAGING_AUTHENTICATED_READ_GRANTS_MISSING';
  end if;

  if has_table_privilege('anon', 'public.pos_catalog_items', 'SELECT')
     or has_table_privilege('anon', 'public.pos_catalog_menu_links', 'SELECT')
     or has_table_privilege('anon', 'public.pos_catalog_menu_link_events', 'SELECT')
     or has_table_privilege('authenticated', 'public.pos_catalog_items', 'INSERT')
     or has_table_privilege('authenticated', 'public.pos_catalog_items', 'UPDATE')
     or has_table_privilege('authenticated', 'public.pos_catalog_items', 'DELETE')
     or has_table_privilege('authenticated', 'public.pos_catalog_menu_links', 'INSERT')
     or has_table_privilege('authenticated', 'public.pos_catalog_menu_links', 'UPDATE')
     or has_table_privilege('authenticated', 'public.pos_catalog_menu_links', 'DELETE')
     or has_table_privilege('authenticated', 'public.pos_catalog_menu_link_events', 'INSERT')
     or has_table_privilege('authenticated', 'public.pos_catalog_menu_link_events', 'UPDATE')
     or has_table_privilege('authenticated', 'public.pos_catalog_menu_link_events', 'DELETE')
     or has_table_privilege('service_role', 'public.pos_catalog_menu_link_events', 'INSERT')
     or has_table_privilege('service_role', 'public.pos_catalog_menu_link_events', 'UPDATE')
     or has_table_privilege('service_role', 'public.pos_catalog_menu_link_events', 'DELETE') then
    raise exception 'POS_STAGING_UNEXPECTED_CLIENT_WRITE_GRANTS';
  end if;

  if has_function_privilege('anon', v_sync_fn, 'EXECUTE')
     or has_function_privilege('authenticated', v_sync_fn, 'EXECUTE')
     or not has_function_privilege('service_role', v_sync_fn, 'EXECUTE') then
    raise exception 'POS_STAGING_CATALOG_RPC_GRANTS_INVALID';
  end if;

  if not exists (
    select 1 from pg_trigger
     where tgrelid = 'public.pos_catalog_menu_links'::regclass
       and tgname = 'pos_catalog_menu_link_audit'
       and not tgisinternal and tgenabled <> 'D'
  ) then
    raise exception 'POS_STAGING_MAPPING_AUDIT_TRIGGER_MISSING_OR_DISABLED';
  end if;

  if not exists (
    select 1 from pg_proc
     where oid = v_trigger_fn and prosecdef
       and proconfig @> array['search_path=public']::text[]
  ) then
    raise exception 'POS_STAGING_AUDIT_FUNCTION_SECURITY_CONFIG_INVALID';
  end if;

  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.pos_catalog_items'::regclass
       and contype = 'f'
  ) or not exists (
    select 1 from pg_constraint
     where conrelid = 'public.pos_catalog_menu_links'::regclass
       and contype = 'f'
  ) then
    raise exception 'POS_STAGING_TENANT_FOREIGN_KEYS_MISSING';
  end if;


  if to_regclass('public.pos_catalog_menu_apply_events') is null
     or to_regprocedure('public.apply_pos_catalog_menu_fields(uuid,uuid,uuid,text,text,uuid,text[],jsonb,jsonb)') is null then
    raise exception 'POS_STAGING_MISSING_MENU_APPLY_OBJECTS';
  end if;

  if not (select relrowsecurity from pg_class where oid = 'public.pos_catalog_menu_apply_events'::regclass)
     or not exists (
       select 1 from pg_policies
        where schemaname = 'public' and tablename = 'pos_catalog_menu_apply_events'
          and policyname = 'pos_catalog_menu_apply_events_owner_read'
          and cmd = 'SELECT' and roles @> array['authenticated']::name[]
     ) then
    raise exception 'POS_STAGING_MENU_APPLY_AUDIT_RLS_INVALID';
  end if;

  if not has_table_privilege('authenticated', 'public.pos_catalog_menu_apply_events', 'SELECT')
     or not has_table_privilege('service_role', 'public.pos_catalog_menu_apply_events', 'SELECT')
     or has_table_privilege('anon', 'public.pos_catalog_menu_apply_events', 'SELECT')
     or has_table_privilege('authenticated', 'public.pos_catalog_menu_apply_events', 'INSERT')
     or has_table_privilege('authenticated', 'public.pos_catalog_menu_apply_events', 'UPDATE')
     or has_table_privilege('authenticated', 'public.pos_catalog_menu_apply_events', 'DELETE')
     or has_table_privilege('service_role', 'public.pos_catalog_menu_apply_events', 'INSERT')
     or has_table_privilege('service_role', 'public.pos_catalog_menu_apply_events', 'UPDATE')
     or has_table_privilege('service_role', 'public.pos_catalog_menu_apply_events', 'DELETE') then
    raise exception 'POS_STAGING_MENU_APPLY_AUDIT_GRANTS_INVALID';
  end if;

  if has_function_privilege('anon', 'public.apply_pos_catalog_menu_fields(uuid,uuid,uuid,text,text,uuid,text[],jsonb,jsonb)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.apply_pos_catalog_menu_fields(uuid,uuid,uuid,text,text,uuid,text[],jsonb,jsonb)', 'EXECUTE')
     or not has_function_privilege('service_role', 'public.apply_pos_catalog_menu_fields(uuid,uuid,uuid,text,text,uuid,text[],jsonb,jsonb)', 'EXECUTE')
     or not exists (
       select 1 from pg_proc
        where oid = 'public.apply_pos_catalog_menu_fields(uuid,uuid,uuid,text,text,uuid,text[],jsonb,jsonb)'::regprocedure
          and prosecdef and proconfig @> array['search_path=public']::text[]
     ) then
    raise exception 'POS_STAGING_MENU_APPLY_RPC_SECURITY_INVALID';
  end if;

  if has_function_privilege('anon', v_webhook_fn, 'EXECUTE')
     or has_function_privilege('authenticated', v_webhook_fn, 'EXECUTE')
     or not has_function_privilege('service_role', v_webhook_fn, 'EXECUTE')
     or not exists (
       select 1 from pg_proc
        where oid = v_webhook_fn and prosecdef
          and proconfig @> array['search_path=public']::text[]
     ) then
    raise exception 'POS_STAGING_WEBHOOK_RPC_SECURITY_INVALID';
  end if;

  raise notice 'POS_STAGING_VERIFICATION_PASSED: RLS, grants, RPC privileges, tenant foreign keys, audit trigger and webhook ingress are present.';
end;
$$;
