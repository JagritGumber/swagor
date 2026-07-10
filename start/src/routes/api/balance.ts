import { createFileRoute } from '@tanstack/react-router'
import { getCircleWalletForUser } from '@/data/circle-wallet.ts'
import { getWalletBalance } from '@/data/balance.ts'
import { apiSuccess, apiError } from '@/lib/api/response.ts'

export const Route = createFileRoute('/api/balance')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        // Lazy auth import: session.ts throws if SELBO_SESSION_SECRET is missing.
        // Keep that failure on the balance request path, not app module load.
        const { getOptionalUser } = await import('@/lib/auth.ts')
        const user = await getOptionalUser(request)
        if (!user) return apiError('UNAUTHORIZED', 'Not authenticated', 401)

        const circleWallet = await getCircleWalletForUser(user.id)
        if (!circleWallet) {
          return apiSuccess({ balanceUsd: 0 })
        }

        try {
          const balanceUsd = await getWalletBalance(circleWallet.circle_wallet_address)
          return apiSuccess({ balanceUsd })
        } catch {
          return apiSuccess({ balanceUsd: 0 })
        }
      },
    },
  },
})
