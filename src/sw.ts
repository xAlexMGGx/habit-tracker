/// <reference lib="webworker" />
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'
import { clientsClaim } from 'workbox-core'

declare let self: ServiceWorkerGlobalScope

// App shell precache. Data always comes from Supabase over the network
// (offline data support is planned for the last phase).
cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

// The page asks the waiting worker to activate when the user accepts the update banner.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting()
})

clientsClaim()

// --- Web Push (phase 4) ------------------------------------------------------
// Payload sent by supabase/functions/send-reminders: { title, body, tag, url }.
type PushPayload = { title?: string; body?: string; tag?: string; url?: string }

self.addEventListener('push', (event) => {
  let data: PushPayload = {}
  try {
    data = event.data?.json() ?? {}
  } catch {
    data = { body: event.data?.text() }
  }
  // iOS requires every push to show a notification.
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'Habit tracker', {
      body: data.body,
      tag: data.tag,
      icon: 'pwa-192x192.png',
      badge: 'pwa-64x64.png',
      data: { url: data.url ?? '#/agenda' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = new URL((event.notification.data as PushPayload | undefined)?.url ?? '#/agenda', self.registration.scope).href
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const open = windows[0]
      if (open) {
        await open.focus()
        await open.navigate(url).catch(() => undefined)
        return
      }
      await self.clients.openWindow(url)
    })(),
  )
})
