import { useSyncExternalStore } from 'react'

export type Toast = {
  id: number
  message: string
  tone?: 'default' | 'error'
  action?: { label: string; run: () => void }
}

let toasts: Toast[] = []
let nextId = 1
const listeners = new Set<() => void>()

function emit() {
  for (const l of listeners) l()
}

export function dismissToast(id: number) {
  toasts = toasts.filter((t) => t.id !== id)
  emit()
}

/** Shows a short message at the bottom of the screen. Usable outside React (e.g. from mutation callbacks). */
export function showToast(toast: Omit<Toast, 'id'>, durationMs = toast.action ? 5000 : 3000) {
  const id = nextId++
  toasts = [...toasts.slice(-2), { ...toast, id }]
  emit()
  setTimeout(() => dismissToast(id), durationMs)
}

export function useToasts(): Toast[] {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => toasts,
  )
}
