import { createCookie } from 'remix/cookie'
import { createFsSessionStorage } from 'remix/session-storage/fs'
import { session } from 'remix/middleware/session'
import { auth, createSessionAuthScheme } from 'remix/middleware/auth'

import type { UserIdentity } from '../data/user.ts'
import { getUserById } from '../data/user.ts'

const SESSION_SECRET = process.env.SELBO_SESSION_SECRET
if (!SESSION_SECRET) {
  throw new Error(
    'SELBO_SESSION_SECRET environment variable is required. ' +
      'Set it to a random string (e.g. openssl rand -hex 32)',
  )
}

const sessionCookie = createCookie('selbo_session', {
  secrets: [SESSION_SECRET],
  httpOnly: true,
  sameSite: 'Lax',
  secure: process.env.NODE_ENV === 'production',
  path: '/',
})

const sessionStorage = createFsSessionStorage('.data/sessions')

export const sessionMiddleware = session(sessionCookie, sessionStorage)

const sessionAuthScheme = createSessionAuthScheme<UserIdentity, { userId: string }>({
  read(session) {
    return session.get('auth') as { userId: string } | null
  },
  async verify(value) {
    return await getUserById(value.userId)
  },
  invalidate(session) {
    session.unset('auth')
  },
})

export const authMiddleware = auth({
  schemes: [sessionAuthScheme],
})
