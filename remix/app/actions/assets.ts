import type { AppContext } from '../router.ts'
import { assetServer } from '../assets.ts'

export async function assets(context: AppContext) {
  return (
    (await assetServer.fetch(context.request)) ?? new Response('Not Found', { status: 404 })
  )
}
