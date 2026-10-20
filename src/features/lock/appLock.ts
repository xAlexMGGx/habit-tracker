import { useSyncExternalStore } from 'react'

/*
 * Face ID app lock, built on WebAuthn with the device's platform authenticator.
 *
 * It is a local gate: the credential only proves that the owner of this iPhone is
 * holding it. The Supabase session is unaffected, and RLS keeps protecting the data
 * on the server. The credential id lives in localStorage, per user and per device.
 */

const key = (userId: string) => `ht:applock:${userId}`
const CHANGE_EVENT = 'ht:applock-change'

function b64url(bytes: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function fromB64url(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'))
  const out = new Uint8Array(new ArrayBuffer(bin.length))
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function random(n: number): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(new ArrayBuffer(n)))
}

export async function isFaceIdAvailable(): Promise<boolean> {
  try {
    return (
      typeof PublicKeyCredential !== 'undefined' &&
      (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable())
    )
  } catch {
    return false
  }
}

function getCredentialId(userId: string): string | null {
  try {
    return localStorage.getItem(key(userId))
  } catch {
    return null
  }
}

export async function enableFaceIdLock(userId: string, email: string): Promise<void> {
  const credential = (await navigator.credentials.create({
    publicKey: {
      challenge: random(32),
      rp: { name: 'Habit tracker' },
      user: { id: random(16), name: email, displayName: `Habit tracker · ${email}` },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },
        { type: 'public-key', alg: -257 },
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
        residentKey: 'discouraged',
      },
      attestation: 'none',
      timeout: 60_000,
    },
  })) as PublicKeyCredential | null
  if (!credential) throw new Error('No credential')
  localStorage.setItem(key(userId), b64url(credential.rawId))
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

export function disableFaceIdLock(userId: string) {
  try {
    localStorage.removeItem(key(userId))
  } catch {
    // ignore
  }
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

/** Shows the Face ID prompt. Resolves true when the user is verified. */
export async function verifyFaceId(userId: string): Promise<boolean> {
  const id = getCredentialId(userId)
  if (!id) return true
  try {
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge: random(32),
        allowCredentials: [{ type: 'public-key', id: fromB64url(id), transports: ['internal'] }],
        userVerification: 'required',
        timeout: 60_000,
      },
    })
    return assertion != null
  } catch {
    return false
  }
}

export function useFaceIdLockEnabled(userId: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      window.addEventListener(CHANGE_EVENT, onChange)
      window.addEventListener('storage', onChange)
      return () => {
        window.removeEventListener(CHANGE_EVENT, onChange)
        window.removeEventListener('storage', onChange)
      }
    },
    () => getCredentialId(userId) != null,
  )
}
