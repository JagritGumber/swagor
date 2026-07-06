import type { AppContext } from '../router.ts'
import { AgentPage } from '../pages/agent.tsx'
import { buildAgentRead } from './shared.ts'

export async function home(context: AppContext) {
  const url = new URL(context.request.url)
  const { candles, segments, regime, auction, read, plan, asset, error } = await buildAgentRead(url)

  if (error) {
    return context.render(<AgentPage candles={[]} segments={[]} auction={null} regime={null} asset={asset} />)
  }

  return context.render(
    <AgentPage candles={candles} segments={segments} auction={auction} regime={regime}
      read={read} plan={plan} asset={asset} publicRoute />,
  )
}
