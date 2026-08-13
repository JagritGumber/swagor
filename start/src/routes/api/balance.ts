import { createFileRoute } from '@tanstack/react-router'
import { getAgentWithWallet } from '@/data/agent.ts'
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

        const result = await getAgentWithWallet(user.id)
        if (!result?.wallet?.circleWalletAddress) {
          return apiSuccess({ balanceUsd: 0 })
        }

        try {
          const balanceUsd = await getWalletBalance(result.wallet.circleWalletAddress)
          return apiSuccess({ balanceUsd })
        } catch {
          return apiSuccess({ balanceUsd: 0 })
        }
      },
    },
  },
})
