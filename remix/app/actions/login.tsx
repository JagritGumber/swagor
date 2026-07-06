import { Auth } from 'remix/middleware/auth'
import { completeAuth } from 'remix/auth'
import type { AppContext } from '../router.ts'
import { LoginPage } from '../pages/login.tsx'
import { resolveUser } from '../data/user.ts'
import { allocateCircleWallet } from '../data/circle-wallet.ts'
import { consumeNonce } from '../data/nonce.ts'
import { verifyEthereumSignature } from '../lib/verify-signature.ts'
import { apiSuccess, apiError } from '../lib/api/response.ts'

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
    return apiError('INVALID_BODY', 'Invalid request body', 400)
  }

  const { address, signature, nonce } = body
  if (!address || !signature || !nonce) {
    return apiError('MISSING_FIELDS', 'Missing address, signature, or nonce', 400)
  }

  if (!consumeNonce(address, nonce)) {
    return apiError('INVALID_NONCE', 'Invalid or expired nonce', 401)
  }

  if (!verifyEthereumSignature(address, nonce, signature)) {
    return apiError('SIGNATURE_FAILED', 'Signature verification failed', 401)
  }

  const user = await resolveUser(address)
  const circleWallet = await allocateCircleWallet(user.id)

  const session = completeAuth(context)
  session.set('auth', { userId: user.id })

  return apiSuccess({ redirect: '/dashboard' })
}
