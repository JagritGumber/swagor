import { redirect } from 'remix/response/redirect'
import { Auth } from 'remix/middleware/auth'
import type { AppContext } from '../router.ts'
import { getCircleWalletForUser } from '../data/circle-wallet.ts'
import { getWalletBalance } from '../data/balance.ts'
import { apiSuccess, apiError } from '../lib/api/response.ts'

export async function balance(context: AppContext) {
  const auth = context.get(Auth)
  if (!auth.ok) return apiError('UNAUTHORIZED', 'Not authenticated', 401)

  const circleWallet = await getCircleWalletForUser(auth.identity.id)
  if (!circleWallet) {
    return apiSuccess({ balanceUsd: 0 })
  }

  try {
    const balanceUsd = await getWalletBalance(circleWallet.circle_wallet_address)
    return apiSuccess({ balanceUsd })
  } catch {
    return apiSuccess({ balanceUsd: 0 })
  }
}
