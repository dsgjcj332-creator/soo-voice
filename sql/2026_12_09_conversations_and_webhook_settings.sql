-- Legacy admin-API storage: conversation transcripts and merchant webhook
-- settings. Both are written by the server-side API (service role) and read
-- by the owning merchant through owner-scoped RLS.
begin;
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  owner_id text not null,
  session_id text not null,
  status text not null default 'open' check (status in ('open', 'closed')),
  message_count integer not null default 0 check (message_count >= 0),
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, session_id)
);
create index if not exists conversations_owner_updated_idx
  on public.conversations (owner_id, updated_at desc);
create table if not exists public.conversation_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null check (length(btrim(content)) between 1 and 8000),
  created_at timestamptz not null default now()
);
create index if not exists conversation_messages_conversation_idx
  on public.conversation_messages (conversation_id, created_at);
create table if not exists public.merchant_webhook_settings (
  owner_id text primary key,
  url text not null check (url ~ '^https://'),
  secret text not null check (length(secret) >= 32),
  events text[] not null default '{}',
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.conversations enable row level security;
drop policy if exists "conversations_owner_read" on public.conversations;
create policy "conversations_owner_read" on public.conversations
  for select to authenticated using (owner_id = auth.uid()::text);
alter table public.conversation_messages enable row level security;
drop policy if exists "conversation_messages_owner_read" on public.conversation_messages;
create policy "conversation_messages_owner_read" on public.conversation_messages
  for select to authenticated using (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id and c.owner_id = auth.uid()::text
    )
  );
alter table public.merchant_webhook_settings enable row level security;
drop policy if exists "merchant_webhook_settings_owner_read" on public.merchant_webhook_settings;
create policy "merchant_webhook_settings_owner_read" on public.merchant_webhook_settings
  for select to authenticated using (owner_id = auth.uid()::text);
revoke all on public.conversations from public;
revoke all on public.conversations from anon;
revoke all on public.conversations from authenticated;
grant select on public.conversations to authenticated;
revoke all on public.conversation_messages from public;
revoke all on public.conversation_messages from anon;
revoke all on public.conversation_messages from authenticated;
grant select on public.conversation_messages to authenticated;
revoke all on public.merchant_webhook_settings from public;
revoke all on public.merchant_webhook_settings from anon;
revoke all on public.merchant_webhook_settings from authenticated;
grant select on public.merchant_webhook_settings to authenticated;
grant all on public.conversations to service_role;
grant all on public.conversation_messages to service_role;
grant all on public.merchant_webhook_settings to service_role;
commit;
