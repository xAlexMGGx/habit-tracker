-- =============================================================================
-- Habit tracker — Phase 1 schema
-- Tables: user_settings, habits, habit_logs, todos
-- Every table has Row Level Security: each user can only read/write their rows.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------

-- Keeps updated_at current on every UPDATE.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- A valid set of ISO weekdays (1 = Monday … 7 = Sunday), non-empty, no duplicates.
create or replace function public.is_valid_weekday_set(days smallint[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select days is not null
     and cardinality(days) between 1 and 7
     and days <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[]
     and cardinality(days) = (select count(distinct d) from unnest(days) as d);
$$;

-- -----------------------------------------------------------------------------
-- user_settings: one row per user
-- -----------------------------------------------------------------------------
create table public.user_settings (
  user_id               uuid primary key references auth.users (id) on delete cascade,
  -- null until the first launch, which stores the device language.
  language              text check (language in ('es', 'en')),
  timezone              text not null default 'UTC',
  tracker_columns       smallint not null default 2 check (tracker_columns in (1, 2)),
  tracker_sort          text not null default 'manual'
                        check (tracker_sort in ('manual', 'streak', 'completion', 'pending_first')),
  agenda_subtab         text not null default 'todos' check (agenda_subtab in ('todos', 'habits')),
  notifications_enabled boolean not null default false,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create trigger user_settings_updated_at
  before update on public.user_settings
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- habits
-- -----------------------------------------------------------------------------
create table public.habits (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name               text not null check (char_length(btrim(name)) between 1 and 60),
  icon               text not null check (char_length(icon) between 1 and 16),
  color              text not null check (color ~ '^[a-z]{2,20}$'),   -- key of the app palette
  type               text not null check (type in ('boolean', 'quantitative', 'negative')),
  target             numeric check (target > 0),                       -- quantitative only
  unit               text check (char_length(unit) <= 20),             -- quantitative only
  quick_step         numeric not null default 1 check (quick_step > 0),-- "+N" button (quantitative)
  frequency_type     text not null default 'daily'
                     check (frequency_type in ('daily', 'weekdays', 'times_per_week', 'every_n_days')),
  frequency_days     smallint[],  -- weekdays: days it is due; times_per_week: planned days (ISO 1..7)
  frequency_times    smallint,    -- times_per_week: X
  frequency_interval smallint,    -- every_n_days: N (anchored at start_date)
  start_date         date not null default current_date,
  reminder_times     time[] not null default '{}',                     -- used from phase 4
  viz_type           text not null
                     check (viz_type in ('heatmap', 'calendar', 'ring', 'bars', 'days_since', 'marble_jar', 'plant')),
  viz_config         jsonb not null default '{}'::jsonb,
  sort_order         integer not null default 0,
  archived_at        timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  -- Lets habit_logs reference (id, user_id) so a log can never point to another user's habit.
  unique (id, user_id),

  constraint habits_target_by_type check ((type = 'quantitative') = (target is not null)),
  constraint habits_unit_by_type check (type = 'quantitative' or unit is null),
  constraint habits_frequency_config check (
    case frequency_type
      when 'daily' then
        frequency_days is null and frequency_times is null and frequency_interval is null
      when 'weekdays' then
        public.is_valid_weekday_set(frequency_days) and frequency_times is null and frequency_interval is null
      when 'times_per_week' then
        type <> 'negative'
        and frequency_times between 1 and 6
        and public.is_valid_weekday_set(frequency_days)
        and cardinality(frequency_days) = frequency_times
        and frequency_interval is null
      when 'every_n_days' then
        frequency_interval between 2 and 365 and frequency_days is null and frequency_times is null
      else false
    end
  ),
  -- Only visualizations compatible with the habit type (SPEC §7).
  constraint habits_viz_compatible check (
    case type
      when 'boolean'      then viz_type in ('heatmap', 'calendar', 'ring', 'marble_jar', 'plant')
      when 'quantitative' then viz_type in ('heatmap', 'calendar', 'ring', 'bars', 'marble_jar', 'plant')
      when 'negative'     then viz_type in ('heatmap', 'calendar', 'ring', 'days_since')
      else false
    end
  )
);

create index habits_user_sort_idx on public.habits (user_id, sort_order);

create trigger habits_updated_at
  before update on public.habits
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- habit_logs: one row per habit and local date
--   boolean      → value = 1 (no row = not done)
--   quantitative → value = amount logged that day
--   negative     → value = number of relapses that day (no row = clean day)
-- -----------------------------------------------------------------------------
create table public.habit_logs (
  habit_id   uuid not null,
  user_id    uuid not null default auth.uid(),
  log_date   date not null,
  value      numeric not null check (value > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  primary key (habit_id, log_date),
  foreign key (habit_id, user_id) references public.habits (id, user_id) on delete cascade
);

create index habit_logs_user_date_idx on public.habit_logs (user_id, log_date);

create trigger habit_logs_updated_at
  before update on public.habit_logs
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- todos
-- -----------------------------------------------------------------------------
create table public.todos (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title         text not null check (char_length(btrim(title)) between 1 and 200),
  due_date      date not null,
  completed_at  timestamptz,
  reminder_time time,  -- used from phase 4; moves with the to-do when due_date changes
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index todos_user_due_idx on public.todos (user_id, due_date);
-- "Pendientes de días anteriores"
create index todos_user_pending_idx on public.todos (user_id, due_date) where completed_at is null;

create trigger todos_updated_at
  before update on public.todos
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.user_settings enable row level security;
alter table public.habits        enable row level security;
alter table public.habit_logs    enable row level security;
alter table public.todos         enable row level security;

-- user_settings (no delete policy: the row goes away with the account)
create policy "user_settings: select own" on public.user_settings
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "user_settings: insert own" on public.user_settings
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "user_settings: update own" on public.user_settings
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- habits
create policy "habits: select own" on public.habits
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "habits: insert own" on public.habits
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "habits: update own" on public.habits
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "habits: delete own" on public.habits
  for delete to authenticated using ((select auth.uid()) = user_id);

-- habit_logs
create policy "habit_logs: select own" on public.habit_logs
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "habit_logs: insert own" on public.habit_logs
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "habit_logs: update own" on public.habit_logs
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "habit_logs: delete own" on public.habit_logs
  for delete to authenticated using ((select auth.uid()) = user_id);

-- todos
create policy "todos: select own" on public.todos
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "todos: insert own" on public.todos
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "todos: update own" on public.todos
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "todos: delete own" on public.todos
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Explicit grants: signed-in users only. The anonymous role gets nothing.
revoke all on table public.user_settings, public.habits, public.habit_logs, public.todos from anon;
grant select, insert, update on table public.user_settings to authenticated;
grant select, insert, update, delete on table public.habits, public.habit_logs, public.todos to authenticated;

-- -----------------------------------------------------------------------------
-- New users get a settings row automatically
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.user_settings (user_id, language, timezone)
  values (
    new.id,
    case when new.raw_user_meta_data ->> 'language' in ('es', 'en')
         then new.raw_user_meta_data ->> 'language' end,
    coalesce(nullif(new.raw_user_meta_data ->> 'timezone', ''), 'UTC')
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Users created before this migration.
insert into public.user_settings (user_id)
select id from auth.users
on conflict (user_id) do nothing;

-- -----------------------------------------------------------------------------
-- RPC: save the manual order of habits in one transaction.
-- security invoker → RLS applies, so it can only touch the caller's habits.
-- -----------------------------------------------------------------------------
create or replace function public.reorder_habits(habit_ids uuid[])
returns void
language sql
security invoker
set search_path = ''
as $$
  update public.habits as h
     set sort_order = o.ord::integer
    from unnest(habit_ids) with ordinality as o(id, ord)
   where h.id = o.id
     and h.user_id = (select auth.uid());
$$;

revoke execute on function public.reorder_habits(uuid[]) from public, anon;
grant execute on function public.reorder_habits(uuid[]) to authenticated;
