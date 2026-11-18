-- Conversations and merchant webhook settings: owner-scoped reads, no client writes.
insert into auth.users(id) values
 ('aaaa1111-1111-4111-8111-111111111111'),
 ('bbbb2222-2222-4222-8222-222222222222')
on conflict do nothing;
set role service_role;
insert into public.conversations(owner_id, session_id, status, message_count, last_message_at)
values
 ('aaaa1111-1111-4111-8111-111111111111', 'sess-a-1', 'open', 2, now());
insert into public.conversations(owner_id, session_id)
values ('bbbb2222-2222-4222-8222-222222222222', 'sess-b-1');
insert into public.conversation_messages(conversation_id, role, content)
select id, 'user', 'عايز برجر' from public.conversations where owner_id = 'aaaa1111-1111-4111-8111-111111111111';
insert into public.conversation_messages(conversation_id, role, content)
select id, 'assistant', 'تمام، برجر واحد؟' from public.conversations where owner_id = 'aaaa1111-1111-4111-8111-111111111111';
insert into public.merchant_webhook_settings(owner_id, url, secret, events)
values ('aaaa1111-1111-4111-8111-111111111111', 'https://merchant-a.example.com/hooks', '0123456789abcdef0123456789abcdef', array['orders']);
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', 'aaaa1111-1111-4111-8111-111111111111', false);
do $$
declare v_count integer; v_insert_blocked boolean := false;
begin
 select count(*) into v_count from public.conversations where owner_id = auth.uid();
 if v_count <> 1 then raise exception 'CONVERSATIONS_OWNER_READ_FAILED'; end if;
 select count(*) into v_count from public.conversations;
 if v_count <> 1 then raise exception 'CONVERSATIONS_TENANT_LEAK'; end if;
 select count(*) into v_count from public.conversation_messages;
 if v_count <> 2 then raise exception 'CONVERSATION_MESSAGES_OWNER_READ_FAILED'; end if;
 select count(*) into v_count from public.merchant_webhook_settings;
 if v_count <> 1 then raise exception 'WEBHOOK_SETTINGS_OWNER_READ_FAILED'; end if;
 begin
  insert into public.conversations(owner_id, session_id) values (auth.uid(), 'sess-x');
 exception when insufficient_privilege then v_insert_blocked := true;
 end;
 if not v_insert_blocked then raise exception 'CONVERSATIONS_MERCHANT_INSERT_ALLOWED'; end if;
end;
$$;
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', 'bbbb2222-2222-4222-8222-222222222222', false);
do $$
declare v_count integer;
begin
 select count(*) into v_count from public.conversations;
 if v_count <> 1 then raise exception 'CONVERSATIONS_TENANT_LEAK_B'; end if;
 select count(*) into v_count from public.conversation_messages;
 if v_count <> 0 then raise exception 'CONVERSATION_MESSAGES_TENANT_LEAK'; end if;
 select count(*) into v_count from public.merchant_webhook_settings;
 if v_count <> 0 then raise exception 'WEBHOOK_SETTINGS_TENANT_LEAK'; end if;
end;
$$;
reset role;
do $$
begin
 if has_table_privilege('anon', 'public.conversations', 'SELECT')
    or has_table_privilege('anon', 'public.conversation_messages', 'SELECT')
    or has_table_privilege('anon', 'public.merchant_webhook_settings', 'SELECT') then
   raise exception 'LEGACY_STORAGE_ANON_GRANTS_INVALID';
 end if;
 if not has_table_privilege('authenticated', 'public.conversations', 'SELECT')
    or has_table_privilege('authenticated', 'public.conversations', 'INSERT')
    or has_table_privilege('authenticated', 'public.conversations', 'DELETE') then
   raise exception 'LEGACY_STORAGE_AUTHENTICATED_GRANTS_INVALID';
 end if;
end;
$$;
select 'CONVERSATIONS_WEBHOOK_SETTINGS_MIGRATION_TESTS_PASSED' as result;
