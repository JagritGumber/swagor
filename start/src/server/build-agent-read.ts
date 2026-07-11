import type { Candle } from '@shared/candle'
import { toCandle } from '@shared/candle'
import type { ReaderMarketRegimeMode } from '@packages/strategy-lab/read-core/market-regime/types'
import type { LiveReaderStance } from '@packages/strategy-lab/reader/reader-live/types'
import type { ReaderTradePlanStatus } from '@packages/strategy-lab/backtest/trade-plan/types'
import { resolveVersion } from '@judgment/src'
import { getLatestDecision, type DecisionWithEvidence } from '@/services/decision/decision-service'
import { getSelboEquity } from '@/data/selbo-equity'
import { tryCatch } from '@/lib/api/try-catch.ts'
import { retry } from 'alova/server'
import { hlRateLimiter } from '@alova/index'
import { getCandles, type HyperliquidCandle } from '@alova/methods/hyperliquid'
import { readMarketRegime } from '@packages/strategy-lab/read-core/market-regime/read-market-regime'
import { readMarketAuction } from '@packages/strategy-lab/read-core/read/read-market-auction'
import { readRegimeSegments } from '@packages/strategy-lab/read-core/market-regime/read-regime-segments'
import { createOrderflowWindow } from '@packages/strategy-lab/read-core/orderflow/create-orderflow-window'
import { readOrderflowWindow } from '@packages/strategy-lab/read-core/orderflow/read-orderflow-window'
import { combineAuctionOrderflow } from '@packages/strategy-lab/reader/reader-live/combine-auction-orderflow'
import { buildReaderTradePlan } from '@packages/strategy-lab/backtest/trade-plan/build-reader-trade-plan'

export const VALID_INTERVALS = new Set(['1m', '5m', '15m', '1h', '4h', '1d'])
export const INTERVAL_MS: Record<string, number> = {
  '1m': 60_000,
  '5m': 300_000,
  '15m': 900_000,
  '1h': 3_600_000,
  '4h': 14_400_000,
  '1d': 86_400_000,
}

export function round(v: number, decimals = 4): number {
  return Number(v.toFixed(decimals))
}

export function formatAuctionLocation(location: string): string {
  const map: Record<string, string> = {
    'below-value': 'Below value area',
    'value-low': 'Value area low',
    'near-poc': 'Near point of control',
    'value-high': 'Value area high',
    'above-value': 'Above value area',
    'outside-profile': 'Outside profile',
  }
  return map[location] ?? location
}

export function formatRegime(mode: string): string {
  const map: Record<string, string> = {
    range: 'Ranging',
    'trend-up': 'Trending up',
    'trend-down': 'Trending down',
    'high-vol': 'High volatility',
    unknown: 'Unknown',
  }
  return map[mode] ?? mode
}

export interface OverlaySegment {
  startIndex: number
  endIndex: number
  mode: ReaderMarketRegimeMode
  poc: number
  valueAreaLow: number
  valueAreaHigh: number
  high?: number
  low?: number
  bins?: { low: number; high: number; mid: number; volume: number }[]
}

export async function loadAndAnalyze(
  url: URL,
  options?: { lookback?: number; interval?: string; existingCandles?: Candle[] },
): Promise<{
  candles: Candle[]
  segments: OverlaySegment[]
  regime: ReturnType<typeof readMarketRegime>
  auction: ReturnType<typeof readMarketAuction>
  error: string | null
}> {
  const asset = (url.searchParams.get('asset') ?? 'ETH').toUpperCase()
  const interval = options?.interval ?? url.searchParams.get('interval') ?? '1h'

  if (!VALID_INTERVALS.has(interval)) {
    return { candles: [], segments: [], regime: undefined as never, auction: undefined as never, error: `Invalid interval. Use: ${Array.from(VALID_INTERVALS).join(', ')}` }
  }

  const now = Date.now()
  let candles: Candle[]
  let lookback: number
  if (options?.existingCandles) {
    candles = options.existingCandles
    lookback = candles.length
  } else {
    lookback = options?.lookback ?? Math.min(Math.max(Number(url.searchParams.get('lookback') ?? '200'), 20), 800)
    const startTime = now - INTERVAL_MS[interval] * lookback
    const method = getCandles('testnet', asset, interval, startTime, now)
    const limiter = hlRateLimiter(method, { key: 'hl' })
    const hooked = retry(limiter, {
      retry: 3,
      backoff: { delay: 1000, multiplier: 2, startQuiver: 0.3, endQuiver: 0.7 },
    })
    const { data: rawCandles, error: err } = await tryCatch(hooked.send() as Promise<HyperliquidCandle[]>)
    if (err !== null) {
      return { candles: [], segments: [], regime: undefined as never, auction: undefined as never, error: err.message }
    }
    if (rawCandles.length === 0) return { candles: [], segments: [], regime: undefined as never, auction: undefined as never, error: 'No candle data' }
    candles = rawCandles.map(toCandle)
  }

  const segments = readRegimeSegments({ candles, lookback }) as OverlaySegment[]
  const regime = readMarketRegime({ candles, now })
  const auction = readMarketAuction({
    asset,
    interval,
    candles,
    price: candles[candles.length - 1].c,
  })

  return { candles, segments, regime, auction, error: null }
}

function decisionToView(d: DecisionWithEvidence | null) {
  if (!d) return null
  return {
    id: d.id,
    action: d.action,
    asset: d.asset,
    conviction: d.conviction,
    entry: d.entry,
    stop: d.stop,
    target: d.target,
    invalidation: d.invalidation,
    thesis: d.thesis,
    decidedAt: d.decidedAt?.toISOString() ?? new Date().toISOString(),
    evidence: d.evidence.map((e) => ({
      category: e.category,
      title: e.title,
      value: e.value,
      stance: e.stance,
    })),
  }
}

export interface AgentReadResult {
  candles: Candle[]
  segments: OverlaySegment[]
  regime: { mode: ReaderMarketRegimeMode; label: string; rangePct: number; driftPct: number; directionalEfficiency: number } | null
  auction: { location: string; locationLabel: string; bias: string; narrative: string; profile: { poc: number; valueAreaLow: number; valueAreaHigh: number; bins: { low: number; high: number; volume: number }[] } | null; level: { price: number; kind: string; touches: number } | null } | null
  read: { stance: LiveReaderStance; narrative: string; invalidation: string | null; target: string | null; orderflow: { pressure: string; delta: number; tradeCount: number; events: string[] } } | null
  plan: { status: ReaderTradePlanStatus; asset: string; side?: string; entryLow?: number; entryHigh?: number; stop?: number; target?: number; invalidation?: string; confidence: number; reasons: string[] } | null
  decision: {
    id: string
    action: string
    asset: string
    conviction: string
    entry: number | null
    stop: number | null
    target: number | null
    invalidation: string | null
    thesis: string | null
    decidedAt: string
    evidence: { category: string; title: string; value: string; stance: string }[]
  } | null
  equity: {
    totalEquity: number
    dailyChange: number
    dailyChangePct: number
    equityCurve: { timestamp: number; equity: number }[]
  }
  asset: string
  error: string | null
}

export async function buildAgentRead(url: URL): Promise<AgentReadResult> {
  const asset = (url.searchParams.get('asset') ?? 'ETH').toUpperCase()

  const result = await loadAndAnalyze(url, { lookback: 300, interval: '1h' })
  if (result.error) {
    return { candles: [], segments: [], regime: null, auction: null, read: null, plan: null, decision: null, equity: { totalEquity: 0, dailyChange: 0, dailyChangePct: 0, equityCurve: [] }, asset, error: result.error }
  }

  const { candles, segments, regime: rawRegime, auction: rawAuction } = result

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
  orderflow.lastPrice = candles[candles.length - 1].c

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

  // Fetch persisted admin decision
  const appUrl = process.env.APP_URL ?? 'http://localhost:44100'
  const decisionResponse = await fetch(
    `${appUrl}/api/decisions?asset=${asset}&limit=1`,
  ).catch(() => null)

  let decision: AgentReadResult['decision'] = null
  if (decisionResponse?.ok) {
    const data = await decisionResponse.json()
    if (data.ok && data.data?.latest) {
      decision = decisionToView(data.data.latest)
    }
  }

  // Fallback: compute fresh decision from engine if none persisted
  if (!decision) {
    try {
      const version = await resolveVersion('v1')
      const engine = version.createJudgmentEngine(
        { asset, regimeWindowMs: 24 * 60 * 60 * 1000 },
        version.DEFAULT_JUDGE_CONFIGS,
      )
      engine.boot(candles)
      const engineResult = engine.onCandle(candles[candles.length - 1])

      const best = engineResult.bestJudgment
      if (best && best.action.type === 'enter') {
        decision = {
          id: engineResult.judgment.id,
          action: `enter-${best.action.side}`,
          asset,
          conviction: best.confidence >= 0.7 ? 'high' : best.confidence >= 0.5 ? 'medium' : 'low',
          entry: best.action.entry,
          stop: best.action.stop,
          target: best.action.target,
          invalidation: best.invalidation,
          thesis: best.reason,
          decidedAt: new Date().toISOString(),
          evidence: engineResult.allJudgments.map((j) => ({
            category: 'regime' as const,
            title: j.label,
            value: j.reason,
            stance: 'supporting' as const,
          })),
        }
      }
    } catch {
      // Engine not available, leave decision null
    }
  }

  // Fetch equity from outcomes
  const equity = await getSelboEquity().catch(() => ({
    totalEquity: 0, dailyChange: 0, dailyChangePct: 0, equityCurve: [],
  }))

  return { candles, segments, regime, auction, read: readerRead, plan: tradePlan, decision, equity, asset, error: null }
}
