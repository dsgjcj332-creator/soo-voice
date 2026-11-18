-- Merchant daily task tenant isolation and write-policy tests.

insert into public.merchant_daily_tasks(
  owner_id, task_date, task_key, completed, completed_by, completed_at
) values (
  '11111111-1111-4111-8111-111111111111',
  date '2026-11-18', 'kitchen', true,
  '11111111-1111-4111-8111-111111111111', now()
);

set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false);
do $$
declare
  v_count integer;
begin
  select count(*) into v_count from public.merchant_daily_tasks;
  if v_count <> 1 then raise exception 'DAILY_TASKS_OWNER_READ_FAILED'; end if;

  update public.merchant_daily_tasks
     set completed = false, completed_by = null, completed_at = null
   where task_key = 'kitchen';
  select count(*) into v_count from public.merchant_daily_tasks where completed = false;
  if v_count <> 1 then raise exception 'DAILY_TASKS_OWNER_UPDATE_FAILED'; end if;

  begin
    insert into public.merchant_daily_tasks(
      owner_id, task_date, task_key, completed
    ) values (
      '22222222-2222-4222-8222-222222222222', date '2026-11-18', 'menu', true
    );
    raise exception 'DAILY_TASKS_CROSS_TENANT_INSERT_ALLOWED';
  exception when insufficient_privilege then
    null;
  end;
end;
$$;
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', false);
do $$
declare
  v_count integer;
begin
  select count(*) into v_count from public.merchant_daily_tasks;
  if v_count <> 0 then raise exception 'DAILY_TASKS_CROSS_TENANT_READ_LEAK'; end if;
end;
$$;
reset role;

do $$
begin
  if has_table_privilege('anon', 'public.merchant_daily_tasks', 'SELECT')
     or has_table_privilege('authenticated', 'public.merchant_daily_tasks', 'DELETE') then
    raise exception 'DAILY_TASKS_CLIENT_GRANTS_TOO_BROAD';
  end if;
end;
$$;

select 'DAILY_TASKS_RLS_TESTS_PASSED' as result;
