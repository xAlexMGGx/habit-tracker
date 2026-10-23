-- =============================================================================
-- Schedules the reminder sender (README, phase 4). Run ONCE in the SQL Editor,
-- after deploying the send-reminders Edge Function.
--
--   ⚠️ This file is public (it's in the repo): DON'T save your real values here.
--   Paste it into the SQL Editor and replace the values THERE:
--   1. Replace YOUR-PROJECT-REF and YOUR-CRON-SECRET below
--      (the same CRON_SECRET you set with `supabase secrets set`).
--   2. Run the whole file.
--   (Or keep a filled copy as schedule-reminders.local.sql: that name is git-ignored.)
-- =============================================================================

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- Stored encrypted in Supabase Vault; the cron job reads them at run time.
-- To change one later: select vault.update_secret(id, 'new value') with the id from vault.secrets.
select vault.create_secret('https://YOUR-PROJECT-REF.supabase.co', 'project_url');
select vault.create_secret('CRON_SECRET', 'cron_secret');

-- Every minute: the function checks each user's local time and sends what's due.
-- Scheduling again with the same name replaces the job.
select cron.schedule(
  'send-reminders',
  '* * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
           || '/functions/v1/send-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{"type": "cron"}'::jsonb,
    timeout_milliseconds := 20000
  );
  $$
);

-- Useful checks:
--   select * from cron.job;
--   select status, return_message, start_time from cron.job_run_details order by start_time desc limit 10;
--   select status_code, content::text, created from net._http_response order by created desc limit 10;
-- To stop it:  select cron.unschedule('send-reminders');
