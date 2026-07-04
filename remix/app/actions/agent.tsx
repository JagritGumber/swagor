import { redirect } from 'remix/response/redirect'
import { Auth } from 'remix/middleware/auth'
import type { AppContext } from '../router.ts'
import { AgentPage } from '../pages/agent.tsx'
import { createOrderflowWindow } from '@packages/strategy-lab/read-core/orderflow/create-orderflow-window'
import { readOrderflowWindow } from '@packages/strategy-lab/read-core/orderflow/read-orderflow-window'
import { combineAuctionOrderflow } from '@packages/strategy-lab/reader/reader-live/combine-auction-orderflow'
import { buildReaderTradePlan } from '@packages/strategy-lab/backtest/trade-plan/build-reader-trade-plan'
import { loadAndAnalyze, formatRegime, formatAuctionLocation, round } from './shared.ts'

export async function agent(context: AppContext) {
  const auth = context.get(Auth)
  if (!auth.ok) return redirect('/login')
  const user = { address: auth.identity.wallets[0].address }

  const url = new URL(context.request.url)
  const asset = (url.searchParams.get('asset') ?? 'ETH').toUpperCase()

  const result = await loadAndAnalyze(url, { lookback: 300, interval: '1h' })
  if (result.error) {
    return context.render(<AgentPage candles={[]} segments={[]} auction={null} regime={null} asset={asset} user={user} />)
  }

  const { candles, segments, regime: rawRegime, auction: rawAuction } = result
  const lastCandle = candles[candles.length - 1]

  const regime = {
    mode: rawRegime.mode,
    label: formatRegime(rawRegime.mode),
    rangePct: round(rawRegime.rangePct * 100, 2),
    driftPct: round(rawRegime.driftPct * 100, 2),
    directionalEfficiency: round(rawRegime.directionalEfficiency, 2),
  }

  const auction = {
    location: rawAuction.location,
    locationLabel: formatAuctionLocation(rawAuction.location),
    bias: rawAuction.bias,
    narrative: rawAuction.narrative,
    profile: rawAuction.profile
      ? {
          poc: round(rawAuction.profile.poc),
          valueAreaLow: round(rawAuction.profile.valueAreaLow),
          valueAreaHigh: round(rawAuction.profile.valueAreaHigh),
          bins: rawAuction.profile.bins.map(b => ({
            low: round(b.low), high: round(b.high), volume: b.volume,
          })),
        }
      : null,
    level: rawAuction.level
      ? { price: round(rawAuction.level.price), kind: rawAuction.level.kind, touches: rawAuction.level.touches }
      : null,
  }

  const orderflowWindow = createOrderflowWindow(60_000)
  const orderflow = readOrderflowWindow({ asset, window: orderflowWindow })
  orderflow.lastPrice = lastCandle.c

  const read = combineAuctionOrderflow({
    auction: rawAuction, orderflow, regime: rawRegime,
    lastClosedCandle: candles.length >= 2 ? candles[candles.length - 2] : null,
  })

  const plan = buildReaderTradePlan(read)

  const readerRead = {
    stance: read.stance, narrative: read.narrative,
    invalidation: read.invalidation, target: read.target,
    orderflow: {
      pressure: read.orderflow.pressure,
      delta: round(read.orderflow.delta),
      tradeCount: read.orderflow.tradeCount,
      events: read.orderflow.events,
    },
  }

  const tradePlan = plan.status === 'no-trade'
    ? { status: plan.status, asset: plan.asset, confidence: plan.confidence, reasons: plan.reasons }
    : {
        status: plan.status, asset: plan.asset, side: plan.side,
        entryLow: round(plan.entryLow), entryHigh: round(plan.entryHigh),
        stop: round(plan.stop), target: round(plan.target),
        invalidation: plan.invalidation, confidence: plan.confidence, reasons: plan.reasons,
      }

  return context.render(
    <AgentPage candles={candles} segments={segments} auction={auction} regime={regime}
      read={readerRead} plan={tradePlan} asset={asset} user={user} />,
  )
}
