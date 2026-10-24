// Receives Health data from the Atajos shortcut (SPEC §13) and fills in Health habits.
//
//   POST /functions/v1/health   with `Authorization: Bearer ht_…` (a personal key from Ajustes)
//   Body (JSON or form): { "steps": "…", "sleep": "…", "workouts": "…" }, one line per sample
//   (see _shared/health.ts). Replies with a short text the shortcut shows as a notification.
//
// Deploy with --no-verify-jwt: the shortcut uses a personal key, not a Supabase session.
// The key is checked by its SHA-256 hash; the service role key never leaves the server.

import { createClient } from 'npm:@supabase/supabase-js@2.117.2'
import { healthReply, parseHealthBody, planHealthWrites } from '../_shared/health.ts'
import { INVALID_KEY_TEXT, type Lang } from '../_shared/messages.ts'
import { localNow } from '../_shared/reminders.ts'
import { bearerToken, sha256Hex } from '../_shared/tokens.ts'

const MAX_BODY_BYTES = 512 * 1024

const env = (name: string) => {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`Missing secret ${name}`)
  return value
}

const admin = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { persistSession: false, autoRefreshToken: false },
})

const reply = (text: string, status = 200) =>
  new Response(text, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } })

/** Atajos sends JSON or, if the user picks "Formulario", form fields. */
async function readBody(req: Request): Promise<unknown> {
  const text = await req.text()
  if (text.length > MAX_BODY_BYTES) throw new RangeError('body too large')
  if ((req.headers.get('Content-Type') ?? '').includes('application/x-www-form-urlencoded')) {
    return Object.fromEntries(new URLSearchParams(text))
  }
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return reply('Method not allowed', 405)

  const token = bearerToken(req.headers.get('Authorization'))
  if (!token) return reply(INVALID_KEY_TEXT, 401)

  try {
    const { data: key, error } = await admin
      .from('api_tokens')
      .select('id, user_id')
      .eq('token_hash', await sha256Hex(token))
      .maybeSingle()
    if (error) throw error
    if (!key) return reply(INVALID_KEY_TEXT, 401)

    const body = await readBody(req)
    const [settings, habits] = await Promise.all([
      admin.from('user_settings').select('language, timezone').eq('user_id', key.user_id).maybeSingle(),
      admin
        .from('habits')
        .select(
          'id, health_metric, archived_at, type, target, frequency_type, frequency_days, frequency_times, frequency_interval, start_date',
        )
        .eq('user_id', key.user_id)
        .not('health_metric', 'is', null)
        .is('archived_at', null),
    ])
    if (settings.error ?? habits.error) throw settings.error ?? habits.error

    const lang: Lang = settings.data?.language === 'en' ? 'en' : 'es'
    const timeZone = settings.data?.timezone ?? 'UTC'
    const today = localNow(timeZone).date
    const parsed = parseHealthBody(body, timeZone, today)
    const writes = planHealthWrites(habits.data ?? [], parsed.days)

    if (writes.length) {
      const { error: rpcError } = await admin.rpc('apply_health_values', { p_user_id: key.user_id, p_rows: writes })
      if (rpcError) throw rpcError
    }

    const { message, lastSync } = healthReply(parsed, habits.data?.length ?? 0, today, lang)
    await admin
      .from('api_tokens')
      .update({ last_used_at: new Date().toISOString(), ...(lastSync ? { last_sync: lastSync } : {}) })
      .eq('id', key.id)

    console.log(JSON.stringify({ user: key.user_id, received: parsed.received, days: parsed.days.size, writes: writes.length }))
    return reply(message)
  } catch (error) {
    console.error(error)
    if (error instanceof RangeError) return reply('Habit tracker: demasiados datos / too much data.', 413)
    return reply('Habit tracker: error del servidor. Vuelve a intentarlo. / Server error, please try again.', 500)
  }
})
