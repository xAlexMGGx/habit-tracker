import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useUser } from '../auth/AuthProvider'
import { deviceLanguage } from '../i18n'
import type { Database, UserSettings } from '../lib/database.types'
import { deviceTimezone } from '../lib/platform'
import { supabase } from '../lib/supabase'

type SettingsUpdate = Database['public']['Tables']['user_settings']['Update']

const KEY = ['settings'] as const

export function useSettings() {
  const user = useUser()
  return useQuery({
    queryKey: KEY,
    queryFn: async (): Promise<UserSettings> => {
      const { data, error } = await supabase.from('user_settings').select('*').maybeSingle()
      if (error) throw error
      if (data) return data
      // The signup trigger normally creates the row; this covers accounts made before the migration ran.
      const created = await supabase
        .from('user_settings')
        .upsert({ user_id: user.id, language: deviceLanguage(), timezone: deviceTimezone() })
        .select()
        .single()
      if (created.error) throw created.error
      return created.data
    },
  })
}

export function useUpdateSettings() {
  const user = useUser()
  const qc = useQueryClient()
  return useMutation({
    mutationKey: ['settings'],
    scope: { id: 'settings' },
    mutationFn: async (patch: SettingsUpdate) => {
      const { error } = await supabase.from('user_settings').update(patch).eq('user_id', user.id)
      if (error) throw error
    },
    onMutate: async (patch) => {
      await qc.cancelQueries({ queryKey: KEY })
      const prev = qc.getQueryData<UserSettings>(KEY)
      if (prev) qc.setQueryData<UserSettings>(KEY, { ...prev, ...patch })
      return { prev }
    },
    onError: (_e, _patch, ctx) => {
      if (ctx?.prev) qc.setQueryData(KEY, ctx.prev)
    },
  })
}
