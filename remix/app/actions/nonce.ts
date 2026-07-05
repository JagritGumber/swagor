import type { AppContext } from '../router.ts'
import { generateNonce } from '../data/nonce.ts'
import { apiSuccess, apiError } from '../lib/api/response.ts'

export async function nonce(context: AppContext) {
  const url = new URL(context.request.url)
  const address = url.searchParams.get('address')
  if (!address) {
    return apiError('MISSING_ADDRESS', 'address parameter required', 400)
  }
  const nonce = generateNonce(address)
  return apiSuccess({ nonce })
}
