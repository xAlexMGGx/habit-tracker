import { useCallback, useEffect, useState } from 'react'
import { isIOS, isStandalone } from './platform'
import { supabase } from './supabase'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

/**
 *  - not-configured: the build has no VITE_VAPID_PUBLIC_KEY (README, phase 4)
 *  - needs-install:  iPhone in Safari; Web Push only works from the Home Screen app (iOS 16.4+)
 *  - unsupported:    this browser can't do Web Push
 *  - denied:         the user blocked notifications in the system settings
 *  - off / on:       whether this device is subscribed
 */
export type PushStatus = 'loading' | 'not-configured' | 'needs-install' | 'unsupported' | 'denied' | 'off' | 'on'

function supported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const base64 = (value + '='.repeat((4 - (value.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const bytes = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
  return bytes
}

async function registration(): Promise<ServiceWorkerRegistration | null> {
  if (!supported()) return null
  return (await navigator.serviceWorker.getRegistration()) ?? null
}

async function currentSubscription(): Promise<PushSubscription | null> {
  return (await (await registration())?.pushManager.getSubscription()) ?? null
}

async function readStatus(): Promise<PushStatus> {
  if (!VAPID_PUBLIC_KEY) return 'not-configured'
  if (!supported()) return isIOS() && !isStandalone() ? 'needs-install' : 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  return Notification.permission === 'granted' && (await currentSubscription()) ? 'on' : 'off'
}

/** Asks for permission (must run inside a tap), subscribes this device and saves it. */
async function enable(userId: string): Promise<PushStatus> {
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'off'
  // `ready` never settles without a service worker (e.g. the dev server): don't hang forever.
  const reg = await Promise.race([
    navigator.serviceWorker.ready,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('No service worker')), 10_000)),
  ])
  const subscription =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToBytes(VAPID_PUBLIC_KEY!) }))
  const { endpoint, keys } = subscription.toJSON()
  if (!endpoint || !keys?.p256dh || !keys.auth) throw new Error('Incomplete push subscription')
  const saved = await supabase
    .from('push_subscriptions')
    .upsert(
      { user_id: userId, endpoint, p256dh: keys.p256dh, auth: keys.auth, user_agent: navigator.userAgent },
      { onConflict: 'user_id,endpoint' },
    )
  if (saved.error) throw saved.error
  const flag = await supabase.from('user_settings').update({ notifications_enabled: true }).eq('user_id', userId)
  if (flag.error) throw flag.error
  return 'on'
}

/** Unsubscribes this device. The account flag goes off when no device is left. */
export async function disablePushOnThisDevice(userId: string): Promise<void> {
  const subscription = await currentSubscription()
  if (subscription) {
    await supabase.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint)
    await subscription.unsubscribe()
  }
  const { count } = await supabase.from('push_subscriptions').select('id', { count: 'exact', head: true })
  if (!count) await supabase.from('user_settings').update({ notifications_enabled: false }).eq('user_id', userId)
}

/** Asks the Edge Function for a test notification to every device of the user. */
export async function sendTestPush(): Promise<{ devices: number; sent: number }> {
  const { data, error } = await supabase.functions.invoke<{ devices: number; sent: number }>('send-reminders', {
    body: { type: 'test' },
  })
  if (error || !data) throw error ?? new Error('No response')
  return data
}

/** Signing out also stops this device's notifications, so the next account doesn't get them. */
export async function signOutAndForgetDevice(userId: string): Promise<void> {
  await disablePushOnThisDevice(userId).catch(() => undefined)
  await supabase.auth.signOut()
}

export function usePush(userId: string) {
  const [status, setStatus] = useState<PushStatus>('loading')

  const refresh = useCallback(() => {
    void readStatus().then(setStatus)
  }, [])

  useEffect(refresh, [refresh])

  const turnOn = useCallback(async () => setStatus(await enable(userId)), [userId])
  const turnOff = useCallback(async () => {
    await disablePushOnThisDevice(userId)
    setStatus(await readStatus())
  }, [userId])

  return { status, turnOn, turnOff, refresh }
}
