-- =============================================================================
-- Phase 6: habits filled in from Apple Health
--   Fitbit → Google's app → Salud (Apple Health) → an Atajos shortcut → `health` Edge Function.
--
--   - api_tokens: personal keys created in Ajustes → Salud. The app creates the key on the
--     device and stores only its SHA-256 hash; the shortcut sends the key itself.
--   - habits.health_metric: null = filled in by hand; otherwise the Health metric that fills it.
--   - habit_logs.health_value / manual: the last value received from Health, and whether the
--     user changed the day by hand. A manual value wins until the user goes back to Health's.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- api_tokens
-- -----------------------------------------------------------------------------
create table public.api_tokens (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name         text not null check (char_length(btrim(name)) between 1 and 40),
  token_hash   text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  token_prefix text not null check (char_length(token_prefix) between 4 and 16),
  created_at   timestamptz not null default now(),
  last_used_at timestamptz,
  -- What the last sync brought for its most recent day, shown in Ajustes:
  -- {"date": "2026-10-24", "steps": 8432, "sleep": 7.25, "workouts": 1}
  last_sync    jsonb
);

create index api_tokens_user_idx on public.api_tokens (user_id);

alter table public.api_tokens enable row level security;

-- No update policy: a key can't be changed from the app, only revoked (deleted).
create policy "api_tokens: select own" on public.api_tokens
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "api_tokens: insert own" on public.api_tokens
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "api_tokens: delete own" on public.api_tokens
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on table public.api_tokens from anon;
grant select, insert, delete on table public.api_tokens to authenticated;

-- -----------------------------------------------------------------------------
-- habits: where the value comes from
-- -----------------------------------------------------------------------------
alter table public.habits
  add column health_metric text check (health_metric in ('steps', 'sleep', 'workouts')),
  -- Health habits always have a number and a target (8.432 / 10.000 pasos).
  add constraint habits_health_quantitative check (health_metric is null or type = 'quantitative');

-- -----------------------------------------------------------------------------
-- habit_logs: Health's value and manual changes
-- -----------------------------------------------------------------------------
alter table public.habit_logs
  add column health_value numeric check (health_value >= 0),
  add column manual boolean not null default false;

-- A day set to 0 by hand needs a row, so the next sync doesn't fill it in again.
alter table public.habit_logs drop constraint habit_logs_value_check;
alter table public.habit_logs add constraint habit_logs_value_check check (value > 0 or (manual and value = 0));

-- -----------------------------------------------------------------------------
-- apply_health_values: what the `health` Edge Function writes, in one statement.
--   p_rows: [{"habit_id": "…", "log_date": "2026-10-24", "value": 8432}, …]
--   Saves Health's value in every row; `value` follows it unless the day was set by hand.
--   Only for the user's own, active Health habits. Service role only (not callable from the app).
-- -----------------------------------------------------------------------------
create or replace function public.apply_health_values(p_user_id uuid, p_rows jsonb)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  changed integer;
begin
  insert into public.habit_logs as l (habit_id, user_id, log_date, value, health_value, manual)
  select r.habit_id, p_user_id, r.log_date, r.value, r.value, false
    from jsonb_to_recordset(p_rows) as r (habit_id uuid, log_date date, value numeric)
    join public.habits h
      on h.id = r.habit_id
     and h.user_id = p_user_id
     and h.health_metric is not null
     and h.archived_at is null
   where r.value > 0
  on conflict (habit_id, log_date) do update
    set health_value = excluded.health_value,
        value = case when l.manual then l.value else excluded.value end
    where l.health_value is distinct from excluded.health_value
       or (not l.manual and l.value is distinct from excluded.value);
  get diagnostics changed = row_count;
  return changed;
end;
$$;

revoke execute on function public.apply_health_values(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.apply_health_values(uuid, jsonb) to service_role;
