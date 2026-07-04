import { redirect } from 'remix/response/redirect'
import { Auth } from 'remix/middleware/auth'
import type { AppContext } from '../router.ts'
import { PortfolioPage } from '../pages/portfolio.tsx'
import { buildReaderRead } from './shared.ts'

export async function portfolio(context: AppContext) {
  const auth = context.get(Auth)
  if (!auth.ok) return redirect('/login')
  const user = { address: auth.identity.wallets[0].address }

  const url = new URL(context.request.url)
  const { read, candles, segments } = await buildReaderRead(url)

  return context.render(
    <PortfolioPage read={read} candles={candles} segments={segments} user={user} />,
  )
}
