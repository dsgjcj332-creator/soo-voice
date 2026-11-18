do $$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public'
       and table_name = 'orders'
       and column_name = 'completedAt'
       and data_type = 'bigint'
  ) then
    raise exception 'ORDERS_COMPLETED_AT_COLUMN_MISSING';
  end if;
  if not exists (
    select 1 from pg_indexes
     where schemaname = 'public'
       and tablename = 'orders'
       and indexname = 'orders_owner_completed_idx'
  ) then
    raise exception 'ORDERS_COMPLETED_AT_INDEX_MISSING';
  end if;
end
$$;
