// Sends the Web Push reminders (SPEC §11).
//
//  - POST {"type":"cron"} with `Authorization: Bearer <CRON_SECRET>`: called every minute by
//    pg_cron (supabase/sql/schedule-reminders.sql). Sends what's due in each user's timezone.
//  - POST {"type":"test"} with the user's own access token: a test notification to their devices
//    (Ajustes → "Enviar notificación de prueba").
//
// Deploy with --no-verify-jwt: this function checks both kinds of caller itself.
// The service role key is only used here, on the server (Supabase injects it); never in the app.

import { createClient } from 'npm:@supabase/supabase-js@2.117.2'
// @deno-types="npm:@types/web-push@3.6.4"
import webpush from 'npm:web-push@3.6.7'
import { weekStart } from '../_shared/dates.ts'
import { type Lang, messages } from '../_shared/messages.ts'
import { type PushMessage, localNow, planReminders } from '../_shared/reminders.ts'

const env = (name: string) => {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`Missing secret ${name} (see README, phase 4)`)
  return value
}

const admin = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { persistSession: false, autoRefreshToken: false },
})
webpush.setVapidDetails(env('VAPID_SUBJECT'), env('VAPID_PUBLIC_KEY'), env('VAPID_PRIVATE_KEY'))

type Subscription = { id: string; user_id: string; endpoint: string; p256dh: string; auth: string }

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

/** Sends to every device; forgets subscriptions the push service says are gone. */
async function sendTo(subscriptions: Subscription[], message: PushMessage): Promise<number> {
  let sent = 0
  await Promise.all(
    subscriptions.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(message),
          { TTL: 60 * 60, urgency: 'high' },
        )
        sent++
        await admin.from('push_subscriptions').update({ last_success_at: new Date().toISOString() }).eq('id', s.id)
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode
        if (status === 404 || status === 410) {
          await admin.from('push_subscriptions').delete().eq('id', s.id)
        } else {
          console.error('push failed', status, (error as { body?: string }).body ?? String(error))
        }
      }
    }),
  )
  return sent
}

async function subscriptionsOf(userIds?: string[]): Promise<Map<string, Subscription[]>> {
  let query = admin.from('push_subscriptions').select('id, user_id, endpoint, p256dh, auth')
  if (userIds) query = query.in('user_id', userIds)
  const { data, error } = await query
  if (error) throw error
  const byUser = new Map<string, Subscription[]>()
  for (const s of data ?? []) byUser.set(s.user_id, [...(byUser.get(s.user_id) ?? []), s])
  return byUser
}

async function runReminders() {
  const now = new Date()
  const byUser = await subscriptionsOf()
  if (!byUser.size) return { users: 0, sent: 0 }

  const { data: settings, error } = await admin
    .from('user_settings')
    .select('user_id, language, timezone, notifications_enabled')
    .in('user_id', [...byUser.keys()])
  if (error) throw error

  let sent = 0
  for (const user of settings ?? []) {
    if (!user.notifications_enabled) continue
    const local = localNow(user.timezone, now)
    const [habits, logs, todos] = await Promise.all([
      admin
        .from('habits')
        .select(
          'id, name, icon, unit, type, target, frequency_type, frequency_days, frequency_times, frequency_interval, start_date, reminders, archived_at',
        )
        .eq('user_id', user.user_id)
        .is('archived_at', null),
      admin
        .from('habit_logs')
        .select('habit_id, log_date, value')
        .eq('user_id', user.user_id)
        .gte('log_date', weekStart(local.date))
        .lte('log_date', local.date),
      admin
        .from('todos')
        .select('id, title, priority, due_date, completed_at, reminder_time')
        .eq('user_id', user.user_id)
        .eq('due_date', local.date)
        .is('completed_at', null)
        .not('reminder_time', 'is', null),
    ])
    if (habits.error || logs.error || todos.error) {
      console.error('query failed', habits.error ?? logs.error ?? todos.error)
      continue
    }

    const planned = planReminders({
      habits: habits.data ?? [],
      logs: (logs.data ?? []).map((l) => ({ ...l, value: Number(l.value) })),
      todos: todos.data ?? [],
      now: local,
      lang: (user.language === 'en' ? 'en' : 'es') as Lang,
    })

    for (const reminder of planned) {
      // Claim it first; if another run already sent it, nothing is inserted and we skip it.
      const { data: claimed, error: claimError } = await admin
        .from('sent_reminders')
        .upsert(
          { kind: reminder.kind, item_id: reminder.itemId, local_date: local.date, reminder_time: reminder.time, user_id: user.user_id },
          { onConflict: 'kind,item_id,local_date,reminder_time', ignoreDuplicates: true },
        )
        .select()
      if (claimError) {
        console.error('claim failed', claimError)
        continue
      }
      if (!claimed?.length) continue
      sent += await sendTo(byUser.get(user.user_id) ?? [], reminder.message)
    }
  }

  // Keep the dedupe table small.
  await admin.from('sent_reminders').delete().lt('sent_at', new Date(now.getTime() - 3 * 86_400_000).toISOString())
  return { users: settings?.length ?? 0, sent }
}

async function sendTest(accessToken: string) {
  const { data, error } = await admin.auth.getUser(accessToken)
  if (error || !data.user) return json({ error: 'unauthorized' }, 401)
  const userId = data.user.id
  const { data: settings } = await admin.from('user_settings').select('language').eq('user_id', userId).maybeSingle()
  const m = messages(settings?.language === 'en' ? 'en' : 'es')
  const subscriptions = (await subscriptionsOf([userId])).get(userId) ?? []
  const sent = await sendTo(subscriptions, { title: m.testTitle, body: m.testBody, tag: 'test', url: '#/settings' })
  return json({ devices: subscriptions.length, sent })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? ''
  const body = (await req.json().catch(() => ({}))) as { type?: string }

  try {
    if (body.type === 'test') return await sendTest(token)
    if (token !== env('CRON_SECRET')) return json({ error: 'unauthorized' }, 401)
    return json(await runReminders())
  } catch (error) {
    console.error(error)
    return json({ error: String(error) }, 500)
  }
})
