// Personal API keys (phase 6). Shared by the app (creates them) and the Edge Functions
// (verify them). Only the SHA-256 hash is stored in the database.

export const TOKEN_PREFIX = 'ht_'

function base64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** A new random key: "ht_" + 32 random bytes in base64url (43 chars). */
export function generateToken(): string {
  return TOKEN_PREFIX + base64Url(crypto.getRandomValues(new Uint8Array(32)))
}

/** What the list in Ajustes shows to tell keys apart ("ht_Ab3d…"). */
export function tokenPrefix(token: string): string {
  return token.slice(0, 8)
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Key from an `Authorization: Bearer ht_…` header, or null. */
export function bearerToken(header: string | null): string | null {
  const token = header?.replace(/^Bearer\s+/i, '').trim()
  return token && token.startsWith(TOKEN_PREFIX) && token.length >= 20 && token.length <= 100 ? token : null
}
