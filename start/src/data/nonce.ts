import { randomUUID } from 'node:crypto'

const NONCE_TTL_MS = 5 * 60 * 1000

const store = new Map<string, { nonce: string; expiresAt: number }>()

export function generateNonce(address: string): string {
  const nonce = randomUUID()
  store.set(address.toLowerCase(), { nonce, expiresAt: Date.now() + NONCE_TTL_MS })
  return nonce
}

export function consumeNonce(address: string, nonce: string): boolean {
  const entry = store.get(address.toLowerCase())
  if (!entry) return false
  if (entry.nonce !== nonce) return false
  store.delete(address.toLowerCase())
  if (Date.now() > entry.expiresAt) return false
  return true
}
