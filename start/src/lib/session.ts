import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto'
import * as fs from 'node:fs'
import * as fsp from 'node:fs/promises'
import * as path from 'node:path'

export type AuthSessionValue = { userId: string }

export type SessionData = {
  auth?: AuthSessionValue
  [key: string]: unknown
}

const COOKIE_NAME = 'selbo_session'
const IS_PRODUCTION = process.env.NODE_ENV === 'production'
const SESSIONS_DIR = path.resolve(import.meta.dirname, '../../.data/sessions')

/**
 * Lazy secret so importing this module (or auth helpers) does not crash
 * public pages when SELBO_SESSION_SECRET is unset. Throws only when a
 * signed cookie is read or written.
 */
function getSessionSecret(): string {
  const secret = process.env.SELBO_SESSION_SECRET
  if (!secret) {
    throw new Error(
      'SELBO_SESSION_SECRET environment variable is required. ' +
        'Set it to a random string (e.g. openssl rand -hex 32)',
    )
  }
  return secret
}

function ensureSessionsDir(): void {
  try {
    const stats = fs.statSync(SESSIONS_DIR)
    if (!stats.isDirectory()) {
      throw new Error(`Path "${SESSIONS_DIR}" is not a directory`)
    }
  } catch (error) {
    if (!isNoEntityError(error)) throw error
    fs.mkdirSync(SESSIONS_DIR, { recursive: true })
  }
}

ensureSessionsDir()

/**
 * In-memory session with get/set/unset and filesystem-backed persistence via
 * commitSession / destroySession. Cookie holds a signed session id only.
 */
export class Session {
  #originalId: string
  #currentId: string
  #deleteId: string | undefined
  #data: Map<string, unknown>
  #destroyed = false
  #dirty: boolean

  constructor(id: string = createSessionId(), initialData?: SessionData) {
    this.#originalId = id
    this.#currentId = id
    this.#data = new Map(Object.entries(initialData ?? {}))
    this.#dirty = false
  }

  get id(): string {
    return this.#currentId
  }

  get deleteId(): string | undefined {
    return this.#deleteId
  }

  get destroyed(): boolean {
    return this.#destroyed
  }

  get dirty(): boolean {
    return this.#dirty
  }

  get data(): SessionData {
    if (this.#destroyed) return {}
    return Object.fromEntries(this.#data) as SessionData
  }

  get(key: string): unknown {
    if (this.#destroyed) return undefined
    return this.#data.get(key)
  }

  set(key: string, value: unknown): void {
    this.#assertAlive()
    if (value == null) {
      this.#data.delete(key)
    } else {
      this.#data.set(key, value)
    }
    this.#dirty = true
  }

  unset(key: string): void {
    this.#assertAlive()
    this.#data.delete(key)
    this.#dirty = true
  }

  has(key: string): boolean {
    if (this.#destroyed) return false
    return this.#data.has(key)
  }

  destroy(): void {
    this.#destroyed = true
    this.#dirty = true
  }

  /**
   * Issue a new session id (call after login / privilege change).
   * @param deleteOldSession When true, the previous file is removed on commit.
   */
  regenerateId(deleteOldSession = false): void {
    this.#assertAlive()
    if (deleteOldSession) this.#deleteId = this.#originalId
    this.#currentId = createSessionId()
    this.#dirty = true
  }

  #assertAlive(): void {
    if (this.#destroyed) throw new Error('Session has been destroyed')
  }
}

export function createSessionId(): string {
  return randomUUID()
}

function sign(value: string): string {
  const sig = createHmac('sha256', getSessionSecret()).update(value).digest('base64url')
  return `${value}.${sig}`
}

function unsign(signed: string): string | null {
  const index = signed.lastIndexOf('.')
  if (index === -1) return null

  const value = signed.slice(0, index)
  const provided = signed.slice(index + 1)
  const expected = createHmac('sha256', getSessionSecret()).update(value).digest('base64url')

  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return null
  if (!timingSafeEqual(a, b)) return null
  return value
}

function serializeCookie(value: string, extra: { maxAge?: number; expires?: Date } = {}): string {
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
  ]
  if (IS_PRODUCTION) parts.push('Secure')
  if (extra.maxAge !== undefined) parts.push(`Max-Age=${extra.maxAge}`)
  if (extra.expires) parts.push(`Expires=${extra.expires.toUTCString()}`)
  return parts.join('; ')
}

function parseCookieHeader(header: string | null): string | null {
  if (!header) return null
  for (const part of header.split(';')) {
    const trimmed = part.trim()
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const name = trimmed.slice(0, eq).trim()
    if (name !== COOKIE_NAME) continue
    const raw = trimmed.slice(eq + 1).trim()
    try {
      return decodeURIComponent(raw)
    } catch {
      return raw
    }
  }
  return null
}

function filePathForId(id: string): string {
  const hash = createHash('sha256').update(id).digest('hex')
  const subdir = hash.slice(0, 2)
  const filename = hash.slice(2)
  return path.join(SESSIONS_DIR, subdir, filename)
}

async function deleteSessionFile(id: string): Promise<void> {
  try {
    await fsp.unlink(filePathForId(id))
  } catch (error) {
    if (!isNoEntityError(error)) throw error
  }
}

function isNoEntityError(error: unknown): error is NodeJS.ErrnoException & { code: 'ENOENT' } {
  return (
    error instanceof Error && 'code' in error && (error as NodeJS.ErrnoException).code === 'ENOENT'
  )
}

/**
 * Load session for a request from the signed `selbo_session` cookie + filesystem store.
 * No cookie => empty session without reading SELBO_SESSION_SECRET.
 */
export async function getSession(request: Request): Promise<Session> {
  const raw = parseCookieHeader(request.headers.get('Cookie'))
  if (!raw) return new Session()

  const id = unsign(raw)
  if (!id) return new Session()

  try {
    const content = await fsp.readFile(filePathForId(id), 'utf-8')
    const data = JSON.parse(content) as SessionData
    if (data === null || typeof data !== 'object' || Array.isArray(data)) {
      throw new Error(`Invalid session file for id ${id}: expected a JSON object`)
    }
    return new Session(id, data)
  } catch (error) {
    if (!isNoEntityError(error)) throw error
    // Unknown / expired id - start a fresh session
    return new Session()
  }
}

/**
 * Persist session data and return a `Set-Cookie` header value.
 */
export async function commitSession(session: Session): Promise<string> {
  if (session.deleteId) {
    await deleteSessionFile(session.deleteId)
  }

  if (session.destroyed) {
    await deleteSessionFile(session.id)
    return serializeCookie('', { maxAge: 0, expires: new Date(0) })
  }

  const file = filePathForId(session.id)
  await fsp.mkdir(path.dirname(file), { recursive: true })
  await fsp.writeFile(file, JSON.stringify(session.data), 'utf-8')
  return serializeCookie(sign(session.id))
}

/**
 * Destroy session data and return a `Set-Cookie` header that clears the cookie.
 */
export async function destroySession(session: Session): Promise<string> {
  if (session.deleteId) {
    await deleteSessionFile(session.deleteId)
  }
  await deleteSessionFile(session.id)
  session.destroy()
  return serializeCookie('', { maxAge: 0, expires: new Date(0) })
}
