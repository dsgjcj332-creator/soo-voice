-- Structured modifier schema constraints and tenant isolation.
begin;

insert into auth.users(id) values
 ('11111111-1111-4111-8111-111111111111'),
 ('22222222-2222-4222-8222-222222222222')
on conflict do nothing;

insert into public.menu_items(id, "ownerId", name, price)
values
 ('modifier-test-item-a', '11111111-1111-4111-8111-111111111111', 'Burger', 100),
 ('modifier-test-item-b', '22222222-2222-4222-8222-222222222222', 'Pizza', 120)
on conflict (id) do nothing;

insert into public.menu_modifier_groups(
  id, owner_id, menu_item_id, name, is_required, min_select, max_select
) values (
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 '11111111-1111-4111-8111-111111111111',
 'modifier-test-item-a', 'Choose size', true, 1, 1
);

insert into public.menu_modifier_options(
  id, owner_id, group_id, name, price_delta
) values (
 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
 '11111111-1111-4111-8111-111111111111',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Large', 25
);

do $$
begin
  begin
    insert into public.menu_modifier_groups(
      owner_id, menu_item_id, name, is_required, min_select, max_select
    ) values (
      '11111111-1111-4111-8111-111111111111',
      'modifier-test-item-a', 'Invalid required', true, 0, 1
    );
    raise exception 'REQUIRED_GROUP_ACCEPTED_ZERO_MINIMUM';
  exception when check_violation then null;
  end;

  begin
    insert into public.menu_modifier_groups(
      owner_id, menu_item_id, name, min_select, max_select
    ) values (
      '11111111-1111-4111-8111-111111111111',
      'modifier-test-item-a', 'Invalid bounds', 3, 2
    );
    raise exception 'INVALID_SELECTION_BOUNDS_ACCEPTED';
  exception when check_violation then null;
  end;

  begin
    insert into public.menu_modifier_options(owner_id, group_id, name, price_delta)
    values (
      '22222222-2222-4222-8222-222222222222',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Cross tenant', 10
    );
    raise exception 'CROSS_TENANT_OPTION_ACCEPTED';
  exception when foreign_key_violation then null;
  end;
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
do $$
declare
  visible_groups integer;
begin
  select count(*) into visible_groups from public.menu_modifier_groups;
  if visible_groups <> 1 then
    raise exception 'OWNER_CANNOT_READ_OWN_GROUP';
  end if;
  if exists (
    select 1 from public.menu_modifier_groups
     where owner_id <> auth.uid()
  ) then
    raise exception 'TENANT_ISOLATION_FAILED';
  end if;
end;
$$;
reset role;

rollback;
