import { MutationCache, QueryClient } from '@tanstack/react-query'
import i18n from '../i18n'
import { showToast } from '../lib/toast'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 2,
      refetchOnWindowFocus: true,
    },
    mutations: {
      retry: 1,
    },
  },
  mutationCache: new MutationCache({
    // Every write is optimistic; if it fails the cache is rolled back and the user is told.
    onError: (_error, _vars, _ctx, mutation) => {
      if (mutation.options.meta?.silent) return
      showToast({ message: i18n.t('errors.saveFailed'), tone: 'error' })
    },
  }),
})

declare module '@tanstack/react-query' {
  interface Register {
    mutationMeta: { silent?: boolean }
  }
}
