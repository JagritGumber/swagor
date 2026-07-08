import type { Candle } from '../types/candles.ts'
import type { OverlaySegment } from '../components/chart/types.ts'
import type { SelboReasoning, ReaderReadResult } from '../types/reader.ts'
import { buildSelboReasoning } from '../data/selbo-reasoning.ts'
import { tryCatch } from '../lib/api/try-catch.ts'
import { retry, hlRateLimit } from '../../../alova'
import { getCandles, type HyperliquidCandle } from '../../../alova/methods/hyperliquid.ts'
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

export function toCandle(raw: { t: number; o: string; c: string; h: string; l: string; v: string }): Candle {
  return { t: raw.t, o: Number(raw.o), h: Number(raw.h), l: Number(raw.l), c: Number(raw.c), v: Number(raw.v) }
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

export interface ReaderRegime {
  mode: string
  label: string
  highVol: boolean
  rangePct: number
  driftPct: number
  directionalEfficiency: number
  reason: string
}

export interface ReaderAuctionProfile {
  poc: number
  valueAreaLow: number
  valueAreaHigh: number
  binCount: number
}

export interface ReaderAuctionLevel {
  price: number
  kind: string
  touches: number
}

export interface ReaderAuction {
  location: string
  locationLabel: string
  bias: string
  narrative: string
  invalidation: string | null
  target: string | null
  profile: ReaderAuctionProfile | null
  level: ReaderAuctionLevel | null
}

export interface ReaderReadSuccess {
  asset: string
  interval: string
  lastPrice: number
  lastCandleAt: string
  readAt: string
  candleCount: number
  regime: ReaderRegime
  auction: ReaderAuction
  reasoning: SelboReasoning
  summary: string
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
    const limited = hlRateLimit(method, { key: 'hl' })
    const hooked = retry(limited, {
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

  const segments = readRegimeSegments({ candles, lookback })
  const regime = readMarketRegime({ candles, now })
  const auction = readMarketAuction({
    asset,
    interval,
    candles,
    price: candles[candles.length - 1].c,
  })

  return { candles, segments, regime, auction, error: null }
}

export interface BuildReaderResult {
  read: ReaderReadResult
  candles: Candle[]
  segments: OverlaySegment[]
}

export async function buildReaderRead(url: URL, lookback?: number, existingCandles?: Candle[]): Promise<BuildReaderResult> {
  const result = await loadAndAnalyze(url, { lookback, existingCandles })
  if (result.error) return { read: { ok: false, error: result.error }, candles: [], segments: [] }

  const { candles, segments, regime: rawRegime, auction: rawAuction } = result
  const lastCandle = candles[candles.length - 1]

  const formattedRegime: ReaderRegime = {
    mode: rawRegime.mode,
    label: formatRegime(rawRegime.mode),
    highVol: rawRegime.highVol,
    rangePct: round(rawRegime.rangePct * 100, 2),
    driftPct: round(rawRegime.driftPct * 100, 2),
    directionalEfficiency: round(rawRegime.directionalEfficiency, 2),
    reason: rawRegime.reason,
  }

  const formattedAuction: ReaderAuction = {
    location: rawAuction.location,
    locationLabel: formatAuctionLocation(rawAuction.location),
    bias: rawAuction.bias,
    narrative: rawAuction.narrative,
    invalidation: rawAuction.invalidation,
    target: rawAuction.target,
    profile: rawAuction.profile
      ? { poc: round(rawAuction.profile.poc), valueAreaLow: round(rawAuction.profile.valueAreaLow), valueAreaHigh: round(rawAuction.profile.valueAreaHigh), binCount: rawAuction.profile.bins.length }
      : null,
    level: rawAuction.level
      ? { price: round(rawAuction.level.price), kind: rawAuction.level.kind, touches: rawAuction.level.touches }
      : null,
  }

  const data: ReaderReadSuccess = {
    asset: rawAuction.asset, interval: rawAuction.interval,
    lastPrice: lastCandle.c,
    lastCandleAt: new Date(lastCandle.t).toISOString(),
    readAt: new Date(Date.now()).toISOString(),
    candleCount: candles.length,
    regime: formattedRegime, auction: formattedAuction,
    reasoning: buildSelboReasoning(rawAuction.asset, formattedRegime, formattedAuction),
    summary: `${rawAuction.asset} is ${formatRegime(rawRegime.mode)}. Price is ${formatAuctionLocation(rawAuction.location)} at $${round(lastCandle.c)}. Bias: ${rawAuction.bias}.`,
  }

  return { read: { ok: true, data }, candles, segments }
}

export interface AgentReadResult {
  candles: Candle[]
  segments: OverlaySegment[]
  regime: { mode: string; label: string; rangePct: number; driftPct: number; directionalEfficiency: number } | null
  auction: { location: string; locationLabel: string; bias: string; narrative: string; profile: { poc: number; valueAreaLow: number; valueAreaHigh: number; bins: { low: number; high: number; volume: number }[] } | null; level: { price: number; kind: string; touches: number } | null } | null
  read: { stance: string; narrative: string; invalidation: string | null; target: string | null; orderflow: { pressure: string; delta: number; tradeCount: number; events: string[] } } | null
  plan: { status: string; asset: string; side?: string; entryLow?: number; entryHigh?: number; stop?: number; target?: number; invalidation?: string; confidence: number; reasons: string[] } | null
  asset: string
  error: string | null
}

export async function buildAgentRead(url: URL): Promise<AgentReadResult> {
  const asset = (url.searchParams.get('asset') ?? 'ETH').toUpperCase()

  const result = await loadAndAnalyze(url, { lookback: 300, interval: '1h' })
  if (result.error) {
    return { candles: [], segments: [], regime: null, auction: null, read: null, plan: null, asset, error: result.error }
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

  return { candles, segments, regime, auction, read: readerRead, plan: tradePlan, asset, error: null }
}
