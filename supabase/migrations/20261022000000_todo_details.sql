-- =============================================================================
-- To-do details: priority (traffic light), "in progress" and notes.
-- Existing to-dos become low priority (green). RLS policies already cover the
-- new columns (they are per row).
-- =============================================================================

alter table public.todos
  add column priority   text not null default 'low' check (priority in ('high', 'medium', 'low')),
  add column started_at timestamptz,
  add column notes      text check (char_length(notes) <= 2000);

comment on column public.todos.priority is 'high = red, medium = orange, low = green';
comment on column public.todos.started_at is 'Set while the to-do is marked as in progress';
