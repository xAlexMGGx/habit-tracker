-- =============================================================================
-- Feedback after phase 6
--   - habits.reminders: each reminder time with the weekdays it rings on
--     (e.g. 19:00 Monday–Friday and 10:00 at the weekend). Replaces reminder_times.
--   - todos.sort_order: manual order of a day's to-dos (within each priority).
--
-- Run it, then deploy send-reminders again and push the app, one after the other:
-- the previous versions still use reminder_times.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- habits.reminders: [{"time": "19:00", "days": [1, 2, 3, 4, 5]}, …]  (ISO weekdays, 1 = Monday)
-- -----------------------------------------------------------------------------
create or replace function public.is_valid_reminders(r jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when jsonb_typeof(r) <> 'array' then false
    when jsonb_array_length(r) > 10 then false
    else not exists (
      select 1
        from jsonb_array_elements(r) as e
       where case
         when jsonb_typeof(e) <> 'object' then true
         when coalesce(e ->> 'time', '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then true
         when coalesce(jsonb_typeof(e -> 'days'), '') <> 'array' then true
         when jsonb_array_length(e -> 'days') = 0 then true
         else exists (select 1 from jsonb_array_elements(e -> 'days') as d where d::text !~ '^[1-7]$')
       end
    )
  end
$$;

alter table public.habits
  add column reminders jsonb not null default '[]'
  constraint habits_reminders_valid check (public.is_valid_reminders(reminders));

-- Existing reminders ring every day, as before.
update public.habits
   set reminders = coalesce(
     (select jsonb_agg(jsonb_build_object('time', to_char(t, 'HH24:MI'), 'days', '[1,2,3,4,5,6,7]'::jsonb) order by t)
        from unnest(reminder_times) as t),
     '[]'::jsonb
   );

alter table public.habits drop column reminder_times;

-- -----------------------------------------------------------------------------
-- todos.sort_order: a new to-do goes last (milliseconds since 1970); reordering a day
-- numbers its to-dos 1, 2, 3… Moving a to-do to another day or priority sends it last again.
-- -----------------------------------------------------------------------------
alter table public.todos add column sort_order bigint;
update public.todos set sort_order = (extract(epoch from created_at) * 1000)::bigint;
alter table public.todos
  alter column sort_order set default (extract(epoch from clock_timestamp()) * 1000)::bigint,
  alter column sort_order set not null;

-- Saves the order of a day's to-dos in one go. security invoker → RLS applies.
create or replace function public.reorder_todos(todo_ids uuid[])
returns void
language sql
security invoker
set search_path = ''
as $$
  update public.todos as t
     set sort_order = o.ord
    from unnest(todo_ids) with ordinality as o(id, ord)
   where t.id = o.id
     and t.user_id = (select auth.uid());
$$;

revoke execute on function public.reorder_todos(uuid[]) from public, anon;
grant execute on function public.reorder_todos(uuid[]) to authenticated;
