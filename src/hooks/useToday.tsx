import { createContext, type ReactNode, useContext, useEffect, useState } from 'react'
import { type DateStr, todayStr } from '../lib/dates'

const TodayContext = createContext<DateStr>(todayStr())

/** Provides the device's local date and updates it after midnight or when the app comes back. */
export function TodayProvider({ children }: { children: ReactNode }) {
  const [today, setToday] = useState(todayStr)

  useEffect(() => {
    const check = () => setToday(todayStr())
    const timer = setInterval(check, 30_000)
    document.addEventListener('visibilitychange', check)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', check)
    }
  }, [])

  return <TodayContext value={today}>{children}</TodayContext>
}

export function useToday(): DateStr {
  return useContext(TodayContext)
}
