import { redirect } from 'remix/response/redirect'
import { Auth } from 'remix/middleware/auth'
import type { AppContext } from '../router.ts'
import { AgentPage } from '../pages/agent.tsx'
import { buildAgentRead } from './shared.ts'

export async function agent(context: AppContext) {
  const auth = context.get(Auth)
  if (!auth.ok) return redirect('/login')
  const user = { address: auth.identity.wallets[0].address }

  const url = new URL(context.request.url)
  const { candles, segments, regime, auction, read, plan, asset, error } = await buildAgentRead(url)

  if (error) {
    return context.render(<AgentPage candles={[]} segments={[]} auction={null} regime={null} asset={asset} user={user} />)
  }

  return context.render(
    <AgentPage candles={candles} segments={segments} auction={auction} regime={regime}
      read={read} plan={plan} asset={asset} user={user} />,
  )
}
