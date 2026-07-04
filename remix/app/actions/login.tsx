import { Auth } from 'remix/middleware/auth'
import { completeAuth } from 'remix/auth'
import type { AppContext } from '../router.ts'
import { LoginPage } from '../pages/login.tsx'
import { resolveUser } from '../data/user.ts'
import { consumeNonce } from '../data/nonce.ts'
import { verifyEthereumSignature } from '../lib/verify-signature.ts'

export async function login(context: AppContext) {
  if (context.request.method !== 'POST') {
    const auth = context.get(Auth)
    const user = auth.ok ? { address: auth.identity.wallets[0].address } : undefined
    return context.render(<LoginPage user={user} />)
  }

  let body: { address?: string; signature?: string; nonce?: string }
  try {
    body = await context.request.json()
  } catch {
    return Response.json({ ok: false, error: 'Invalid request body' }, { status: 400 })
  }

  const { address, signature, nonce } = body
  if (!address || !signature || !nonce) {
    return Response.json({ ok: false, error: 'Missing address, signature, or nonce' }, { status: 400 })
  }

  if (!consumeNonce(address, nonce)) {
    return Response.json({ ok: false, error: 'Invalid or expired nonce' }, { status: 401 })
  }

  if (!verifyEthereumSignature(address, nonce, signature)) {
    return Response.json({ ok: false, error: 'Signature verification failed' }, { status: 401 })
  }

  const user = resolveUser(address)

  const session = completeAuth(context)
  session.set('auth', { userId: user.id })

  return Response.json({ ok: true, redirect: '/portfolio' })
}
