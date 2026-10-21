import { useSyncExternalStore } from 'react'

/** "Automático" follows the iPhone; light/dark force the app's look. Stored per device. */
export type ThemePref = 'system' | 'light' | 'dark'

// Also read by the inline script in index.html, which applies it before the first paint.
const KEY = 'ht:theme'
const COLORS = { light: '#f2f2f7', dark: '#000000' }

const listeners = new Set<() => void>()
const systemDark = window.matchMedia('(prefers-color-scheme: dark)')

export function readThemePref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'light' || v === 'dark' ? v : 'system'
  } catch {
    return 'system'
  }
}

export function applyTheme(pref: ThemePref = readThemePref()) {
  const root = document.documentElement
  if (pref === 'system') delete root.dataset.theme
  else root.dataset.theme = pref
  const dark = pref === 'dark' || (pref === 'system' && systemDark.matches)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? COLORS.dark : COLORS.light)
}

export function setThemePref(pref: ThemePref) {
  try {
    if (pref === 'system') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, pref)
  } catch {
    // Private mode: applies for this session only.
  }
  applyTheme(pref)
  for (const l of listeners) l()
}

// Keep the browser chrome color in sync when the iPhone switches light/dark.
systemDark.addEventListener('change', () => applyTheme())

export function useThemePref(): ThemePref {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    readThemePref,
  )
}
