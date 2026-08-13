import { createFileRoute } from '@tanstack/react-router'
import { commitSession, getSession } from '@/lib/session.ts'

async function clearAuthAndRedirect(request: Request): Promise<Response> {
  const session = await getSession(request)
  session.unset('auth')
  session.regenerateId(true)
  const setCookie = await commitSession(session)
  return new Response(null, {
    status: 302,
    headers: {
      Location: '/login',
      'Set-Cookie': setCookie,
    },
  })
}

export const Route = createFileRoute('/logout')({
  server: {
    handlers: {
      GET: async ({ request }) => clearAuthAndRedirect(request),
      POST: async ({ request }) => clearAuthAndRedirect(request),
    },
  },
})
