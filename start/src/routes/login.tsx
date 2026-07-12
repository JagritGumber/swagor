import { createFileRoute } from '@tanstack/react-router'
import { Wallet } from '@phosphor-icons/react'
import { PageLoader, WalletConnect } from '@/components/wallet'
import { resolveUser } from '@/data/user.ts'
import { allocateCircleWallet } from '@/data/agent.ts'
import { consumeNonce } from '@/data/nonce.ts'
import { verifyEthereumSignature } from '@/lib/verify-signature.ts'
import { apiSuccess, apiError } from '@/lib/api/response.ts'
import { commitSession, getSession } from '@/lib/session.ts'

export const Route = createFileRoute('/login')({
  head: () => ({
    meta: [
      { title: 'Selbo - Sign In' },
      { name: 'color-scheme', content: 'dark' },
    ],
    links: [
      { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
      { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' },
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
      },
    ],
  }),
  component: LoginPage,
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: { address?: string; signature?: string; nonce?: string }
        try {
          body = await request.json()
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
        await allocateCircleWallet(user.id)

        const session = await getSession(request)
        session.regenerateId(true)
        session.set('auth', { userId: user.id })
        const setCookie = await commitSession(session)

        const response = apiSuccess({ redirect: '/dashboard' })
        const headers = new Headers(response.headers)
        headers.set('Set-Cookie', setCookie)
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers,
        })
      },
    },
  },
})

function LoginPage() {
  return (
    <>
      <div className="flex flex-1 flex-col items-center justify-center gap-gap-6 bg-surface-body p-gap-6 font-ui">
        <h1 className="m-0 inline-flex items-center gap-2.5 text-2xl font-bold text-white">
          <Wallet size={24} /> Sign In
        </h1>
        <p className="m-0 max-w-[360px] text-center text-[13px] leading-relaxed text-text-muted">
          Connect your wallet to access your Selbo dashboard. Your wallet is your identity.
        </p>
        <WalletConnect />
      </div>
      <PageLoader />
    </>
  )
}
