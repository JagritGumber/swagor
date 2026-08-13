import type { Candle } from '@shared/candle'
import { toCandle } from '@shared/candle'
import type { ReaderMarketRegimeMode } from '@packages/strategy-lab/read-core/market-regime/types'
import type { LiveReaderStance } from '@packages/strategy-lab/reader/reader-live/types'
import type { ReaderTradePlanStatus } from '@packages/strategy-lab/backtest/trade-plan/types'
import type { DecisionWithEvidence } from '@/services/decision/decision-service'
import { mapReadToEvidence } from '@/services/decision/map-read-to-evidence'
import { getSelboEquity } from '@/data/selbo-equity'
import { tryCatch } from '@/lib/api/try-catch.ts'
import { retry } from 'alova/server'
import { hlRateLimiter } from '@alova/index'
import { getCandles, type HyperliquidCandle } from '@alova/methods/hyperliquid'
import { readMarketRegime } from '@packages/strategy-lab/read-core/market-regime/read-market-regime'
import { readMarketAuction } from '@packages/strategy-lab/read-core/read/read-market-auction'
import { readRegimeSegments } from '@packages/strategy-lab/read-core/market-regime/read-regime-segments'
import { readOrderflowWindow } from '@packages/strategy-lab/read-core/orderflow/read-orderflow-window'
import { combineAuctionOrderflow } from '@packages/strategy-lab/reader/reader-live/combine-auction-orderflow'
import { buildReaderTradePlan } from '@packages/strategy-lab/backtest/trade-plan/build-reader-trade-plan'
import { readOrderflowBuckets } from '@packages/market-data'
import type { OrderflowEvent } from '@packages/strategy-lab/read-core/orderflow/types'
import { buildReaderHistoryReads } from '@packages/strategy-lab/reader/reader-history/build-reader-history-reads'
import { getReaderState } from './reader-state'
import { startLiveOrderflow, getLiveOrderflowWindow, expireLiveOrderflow } from './live-orderflow'

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

const MARKET_STORE_ROOT = 'D:\\Projects\\agoratest\\.data\\market-store'

async function loadOrderflowEvents(input: {
  asset: string
  startMs: number
  endMs: number
}): Promise<OrderflowEvent[]> {
  const buckets = await readOrderflowBuckets({
    rootDir: MARKET_STORE_ROOT,
    venue: 'bybit',
    market: 'trading',
    symbol: `${input.asset}USDT`,
    startMs: input.startMs,
    endMs: input.endMs,
  })
  const events: OrderflowEvent[] = []
  for (const bucket of buckets) {
    const largestSide = bucket.largestTradeSide
    const largestSize = Math.max(0, bucket.largestTradeSize)
    if (largestSize > 0) {
      events.push({
        type: 'trade',
        receivedAt: bucket.bucketMs,
        trade: {
          asset: input.asset,
          side: largestSide,
          price: Number.isFinite(bucket.largestTradePrice) && bucket.largestTradePrice > 0
            ? bucket.largestTradePrice : bucket.close,
          size: largestSize,
          time: bucket.bucketMs,
          id: `${bucket.bucketMs}:largest:${largestSide}`,
        },
      })
    }
    const buyResidual = Math.max(0, bucket.buyVolume - (largestSide === 'buy' ? largestSize : 0))
    const sellResidual = Math.max(0, bucket.sellVolume - (largestSide === 'sell' ? largestSize : 0))
    if (buyResidual > 0) {
      events.push({
        type: 'trade',
        receivedAt: bucket.bucketMs + 1,
        trade: {
          asset: input.asset,
          side: 'buy',
          price: bucket.close,
          size: buyResidual,
          time: bucket.bucketMs + 1,
          id: `${bucket.bucketMs}:buy-residual`,
        },
      })
    }
    if (sellResidual > 0) {
      events.push({
        type: 'trade',
        receivedAt: bucket.bucketMs + 2,
        trade: {
          asset: input.asset,
          side: 'sell',
          price: bucket.close,
          size: sellResidual,
          time: bucket.bucketMs + 2,
          id: `${bucket.bucketMs}:sell-residual`,
        },
      })
    }
  }
  return events
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
  options?: { lookback?: number; interval?: string; existingCandles?: Candle[]; mode?: 'backtest' | 'live' },
): Promise<{
  candles: Candle[]
  segments: OverlaySegment[]
  regime: ReturnType<typeof readMarketRegime>
  auction: ReturnType<typeof readMarketAuction>
  orderflowEvents: OrderflowEvent[]
  error: string | null
}> {
  const asset = (url.searchParams.get('asset') ?? 'ETH').toUpperCase()
  const interval = options?.interval ?? url.searchParams.get('interval') ?? '1h'
  const mode = options?.mode ?? url.searchParams.get('mode') ?? 'backtest'

  if (!VALID_INTERVALS.has(interval)) {
    return { candles: [], segments: [], regime: undefined as never, auction: undefined as never, orderflowEvents: [], error: `Invalid interval. Use: ${Array.from(VALID_INTERVALS).join(', ')}` }
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
      return { candles: [], segments: [], regime: undefined as never, auction: undefined as never, orderflowEvents: [], error: err.message }
    }
    if (rawCandles.length === 0) return { candles: [], segments: [], regime: undefined as never, auction: undefined as never, orderflowEvents: [], error: 'No candle data' }
    candles = rawCandles.map(toCandle)
  }

  let orderflowEvents: OrderflowEvent[] = []
  if (mode === 'live') {
    startLiveOrderflow(asset, 'testnet')
    expireLiveOrderflow(now)
    const window = getLiveOrderflowWindow()
    const liveOrderflow = readOrderflowWindow({ asset, window })
    if (liveOrderflow.lastPrice === null) {
      orderflowEvents = []
    }
  } else {
    orderflowEvents = await loadOrderflowEvents({
      asset,
      startMs: now - INTERVAL_MS[interval] * lookback,
      endMs: now,
    }).catch(() => [] as OrderflowEvent[])
  }

  const segments = readRegimeSegments({ candles, lookback }) as OverlaySegment[]
  const regime = readMarketRegime({ candles, now })
  const auction = readMarketAuction({
    asset,
    interval,
    candles,
    price: candles[candles.length - 1].c,
  })

  return { candles, segments, regime, auction, orderflowEvents, error: null }
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

  const { candles, segments, regime: rawRegime, auction: rawAuction, orderflowEvents } = result

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

  const { auctionModeState, vpStateMemory } = getReaderState(asset)

  const steps = buildReaderHistoryReads({
    asset,
    interval: '1h',
    candleIntervalMs: INTERVAL_MS['1h'],
    candles,
    orderflowEvents,
    readIntervalMs: INTERVAL_MS['1h'],
    orderflowWindowMs: 60_000,
    startAt: candles.length >= 2 ? candles[candles.length - 2].t : Date.now() - INTERVAL_MS['1h'],
    endAt: candles[candles.length - 1]?.t ?? Date.now(),
    auctionModeState,
    vpStateMemory,
  })

  const latestStep = steps[steps.length - 1]
  const read = latestStep?.read ?? combineAuctionOrderflow({
    auction: rawAuction,
    orderflow: {
      asset, windowSeconds: 60, lastPrice: candles.at(-1)?.c ?? null,
      buyVolume: 0, sellVolume: 0, delta: 0, tradeCount: 0, averageTradeSize: 0,
      largestTrade: null, dominantSide: 'none', pressure: 'balanced', events: [],
      narrative: 'No orderflow data available.',
    },
    regime: rawRegime,
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

  // Fallback: derive decision from reader trade plan if none persisted
  if (!decision && plan.status !== 'no-trade') {
    decision = {
      id: `reader-${asset}-${Date.now()}`,
      action: plan.side === 'long' ? 'enter-long' : 'enter-short',
      asset,
      conviction: plan.confidence >= 0.7 ? 'high' : plan.confidence >= 0.5 ? 'medium' : 'low',
      entry: (plan.entryLow + plan.entryHigh) / 2,
      stop: plan.stop,
      target: plan.target,
      invalidation: plan.invalidation,
      thesis: plan.reasons.join('. '),
      decidedAt: new Date().toISOString(),
      evidence: mapReadToEvidence(read),
    }
  }

  // Fetch equity from outcomes
  const equity = await getSelboEquity().catch(() => ({
    totalEquity: 0, dailyChange: 0, dailyChangePct: 0, equityCurve: [],
  }))

  return { candles, segments, regime, auction, read: readerRead, plan: tradePlan, decision, equity, asset, error: null }
}
