import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isSupabaseConfigured = Boolean(url && key)

function isSecretKey(k: string): boolean {
  if (k.startsWith('sb_secret_')) return true
  const payload = k.split('.')[1]
  if (!payload) return false
  try {
    const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))) as { role?: string }
    return json.role === 'service_role'
  } catch {
    return false
  }
}

// The browser only ever gets the public anon/publishable key. vite.config.ts refuses
// to build with a secret key; this is a second guard for local .env mistakes.
if (key && isSecretKey(key)) {
  throw new Error('Refusing to start: VITE_SUPABASE_ANON_KEY is a secret/service_role key.')
}

export const supabase = createClient<Database>(url ?? 'http://localhost', key ?? 'missing-key', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // We never sign in through URL redirects: an installed iOS PWA does not share
    // storage with Safari, so password recovery uses a 6-digit code instead.
    detectSessionInUrl: false,
  },
})

/** PostgREST returns at most 1000 rows per request; this pages through everything. */
export async function fetchAllRows<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const size = 1000
  const rows: T[] = []
  for (let from = 0; ; from += size) {
    const { data, error } = await page(from, from + size - 1)
    if (error) throw error
    rows.push(...(data ?? []))
    if (!data || data.length < size) return rows
  }
}
