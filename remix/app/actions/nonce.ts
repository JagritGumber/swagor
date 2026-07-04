import type { AppContext } from '../router.ts'
import { generateNonce } from '../data/nonce.ts'

export async function nonce(context: AppContext) {
  const url = new URL(context.request.url)
  const address = url.searchParams.get('address')
  if (!address) {
    return Response.json({ error: 'address parameter required' }, { status: 400 })
  }
  const nonce = generateNonce(address)
  return Response.json({ nonce })
}
