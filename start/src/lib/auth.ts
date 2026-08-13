import { getUserById, type UserIdentity } from '@/data/user.ts'
import { getSession } from '@/lib/session.ts'

function isAuthValue(value: unknown): value is { userId: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'userId' in value &&
    typeof (value as { userId: unknown }).userId === 'string' &&
    (value as { userId: string }).userId.length > 0
  )
}

/**
 * Return the authenticated user for this request, or null if unauthenticated.
 */
export async function getOptionalUser(request: Request): Promise<UserIdentity | null> {
  const session = await getSession(request)
  const auth = session.get('auth')
  if (!isAuthValue(auth)) return null

  const user = await getUserById(auth.userId)
  return user
}

/**
 * Return the authenticated user, or throw a 302 redirect to `/login`.
 */
export async function requireUser(request: Request): Promise<UserIdentity> {
  const user = await getOptionalUser(request)
  if (!user) {
    throw new Response(null, {
      status: 302,
      headers: { Location: '/login' },
    })
  }
  return user
}
