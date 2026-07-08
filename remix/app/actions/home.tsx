import type { AppContext } from '../router.ts'
import { LandingPage } from '../pages/landing/page.tsx'
import { buildAgentRead } from './shared.ts'

export async function home(context: AppContext) {
  const url = new URL(context.request.url)
  const { candles, segments, regime, auction, read, plan, asset, error } = await buildAgentRead(url)

  if (error) {
    console.error('[home] buildAgentRead failed:', error)
    return context.render(<LandingPage candles={[]} segments={[]} auction={null} regime={null} asset={asset} />)
  }

  return context.render(
    <LandingPage candles={candles} segments={segments} auction={auction} regime={regime}
      read={read} plan={plan} asset={asset} />,
  )
}
