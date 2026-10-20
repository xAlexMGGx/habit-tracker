import type { Session, User } from '@supabase/supabase-js'
import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from 'react'
import { queryClient } from '../data/queryClient'
import { supabase } from '../lib/supabase'

type AuthState = {
  session: Session | null
  loading: boolean
  /** Keeps the sign-in screen up while the password-reset flow finishes, even though a session exists. */
  holdAuthScreen: boolean
  setHoldAuthScreen: (hold: boolean) => void
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [holdAuthScreen, setHoldAuthScreen] = useState(false)

  useEffect(() => {
    let mounted = true
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setSession(data.session)
      setLoading(false)
    })
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next)
      setLoading(false)
      if (event === 'SIGNED_OUT') queryClient.clear()
    })
    return () => {
      mounted = false
      data.subscription.unsubscribe()
    }
  }, [])

  const value = useMemo(
    () => ({ session, loading, holdAuthScreen, setHoldAuthScreen }),
    [session, loading, holdAuthScreen],
  )
  return <AuthContext value={value}>{children}</AuthContext>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth outside AuthProvider')
  return ctx
}

/** The signed-in user. Only use below the auth gate. */
export function useUser(): User {
  const { session } = useAuth()
  if (!session) throw new Error('useUser without a session')
  return session.user
}
