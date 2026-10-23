-- =============================================================================
-- Phase 4: Web Push notifications
--   push_subscriptions: one row per device (and account) that turned notifications on
--   sent_reminders:     what the sender already sent, so a reminder goes out only once
-- The cron job that calls the Edge Function is in supabase/sql/schedule-reminders.sql
-- (it needs the project URL and a secret, so it's run by hand after deploying).
-- =============================================================================

create table public.push_subscriptions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint        text not null check (endpoint like 'https://%'),
  p256dh          text not null,
  auth            text not null,
  user_agent      text,
  created_at      timestamptz not null default now(),
  last_success_at timestamptz,
  unique (user_id, endpoint)
);

alter table public.push_subscriptions enable row level security;

create policy "push_subscriptions: select own" on public.push_subscriptions
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "push_subscriptions: insert own" on public.push_subscriptions
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "push_subscriptions: update own" on public.push_subscriptions
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "push_subscriptions: delete own" on public.push_subscriptions
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on table public.push_subscriptions from anon;
grant select, insert, update, delete on table public.push_subscriptions to authenticated;

-- Only the Edge Function (service role) reads and writes this table: RLS on and no policies.
create table public.sent_reminders (
  kind          text not null check (kind in ('habit', 'todo')),
  item_id       uuid not null,
  local_date    date not null,
  reminder_time time not null,
  user_id       uuid not null references auth.users (id) on delete cascade,
  sent_at       timestamptz not null default now(),
  primary key (kind, item_id, local_date, reminder_time)
);

create index sent_reminders_sent_at_idx on public.sent_reminders (sent_at);

alter table public.sent_reminders enable row level security;
revoke all on table public.sent_reminders from anon, authenticated;
