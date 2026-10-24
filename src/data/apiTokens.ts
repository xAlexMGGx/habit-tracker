import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { generateToken, sha256Hex, tokenPrefix } from '../../supabase/functions/_shared/tokens.ts'
import type { ApiToken } from '../lib/database.types'
import { supabase } from '../lib/supabase'

const KEY = ['api_tokens'] as const

/** Personal keys (never the key itself: only its prefix and metadata). */
export function useApiTokens() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('api_tokens')
        .select('id, user_id, name, token_hash, token_prefix, created_at, last_used_at, last_sync')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as ApiToken[]
    },
  })
}

/** Creates a key on this device and stores only its hash. Returns the key, which can only be shown now. */
export function useCreateApiToken() {
  const qc = useQueryClient()
  return useMutation({
    meta: { silent: true },
    mutationFn: async (name: string) => {
      const token = generateToken()
      const { error } = await supabase
        .from('api_tokens')
        .insert({ name, token_hash: await sha256Hex(token), token_prefix: tokenPrefix(token) })
      if (error) throw error
      return token
    },
    onSettled: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useRevokeApiToken() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('api_tokens').delete().eq('id', id)
      if (error) throw error
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: KEY })
      const prev = qc.getQueryData<ApiToken[]>(KEY)
      qc.setQueryData<ApiToken[]>(KEY, (list) => list?.filter((t) => t.id !== id))
      return { prev }
    },
    onError: (_e, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(KEY, ctx.prev)
    },
  })
}
