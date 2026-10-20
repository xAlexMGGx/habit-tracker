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

// Phase 4 adds the `push` and `notificationclick` handlers here.
