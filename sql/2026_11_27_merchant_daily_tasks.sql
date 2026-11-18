-- Shared daily execution checklist, scoped to one merchant and local calendar day.

begin;

create table if not exists public.merchant_daily_tasks (
  owner_id uuid not null references auth.users(id) on delete cascade,
  task_date date not null,
  task_key text not null check (task_key in ('kitchen','conversations','menu','voice','connections')),
  completed boolean not null default false,
  completed_by uuid references auth.users(id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(owner_id, task_date, task_key),
  check (
    (completed = true and completed_at is not null)
    or (completed = false and completed_at is null)
  ),
  check (completed_by is null or completed_by = owner_id)
);

create index if not exists merchant_daily_tasks_date_idx
  on public.merchant_daily_tasks(task_date, owner_id);

alter table public.merchant_daily_tasks enable row level security;
revoke all on public.merchant_daily_tasks from public, anon, authenticated;
grant select, insert, update on public.merchant_daily_tasks to authenticated;
grant all on public.merchant_daily_tasks to service_role;

drop policy if exists merchant_daily_tasks_owner_select on public.merchant_daily_tasks;
create policy merchant_daily_tasks_owner_select on public.merchant_daily_tasks
  for select to authenticated using (owner_id = auth.uid());

drop policy if exists merchant_daily_tasks_owner_insert on public.merchant_daily_tasks;
create policy merchant_daily_tasks_owner_insert on public.merchant_daily_tasks
  for insert to authenticated with check (
    owner_id = auth.uid()
    and (completed_by is null or completed_by = auth.uid())
  );

drop policy if exists merchant_daily_tasks_owner_update on public.merchant_daily_tasks;
create policy merchant_daily_tasks_owner_update on public.merchant_daily_tasks
  for update to authenticated
  using (owner_id = auth.uid())
  with check (
    owner_id = auth.uid()
    and (completed_by is null or completed_by = auth.uid())
  );

-- Enable realtime when the Supabase publication exists; polling remains the
-- application fallback if realtime is unavailable in a target project.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'merchant_daily_tasks'
     ) then
    alter publication supabase_realtime add table public.merchant_daily_tasks;
  end if;
end;
$$;

commit;
