import type { Candle } from '@shared/candle'
import { toCandle } from '@shared/candle'
import type { ReaderMarketRegimeMode } from '@packages/strategy-lab/read-core/market-regime/types'
import type { LiveReaderStance } from '@packages/strategy-lab/reader/reader-live/types'
import type { ReaderTradePlanStatus } from '@packages/strategy-lab/backtest/trade-plan/types'
import type { EngineJudgmentResult } from '@judgment/src/v1/engine'
import { resolveVersion } from '@judgment/src'
import { createPortfolioEngine } from '@portfolio/src'
import type { PortfolioSnapshot } from '@portfolio/src/types'
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

/** Chart overlay segment shape (ported without remix chart package). */
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

type AgentJudgmentPipelineResult = {
  judgment: EngineJudgmentResult
  portfolio: PortfolioSnapshot
}

/** Full engine+portfolio pipeline used by agent read fallback (from remix actions). */
async function runAgentJudgmentPipeline(
  asset: string,
  _interval: string,
  candles: Candle[],
  versionId: string = 'v1',
): Promise<AgentJudgmentPipelineResult> {
  const version = await resolveVersion(versionId)

  const engine = version.createJudgmentEngine(
    { asset, regimeWindowMs: 24 * 60 * 60 * 1000 },
    version.DEFAULT_JUDGE_CONFIGS,
  )

  engine.boot(candles)
  const result = engine.onCandle(candles[candles.length - 1])

  const portfolio = createPortfolioEngine({ initialEquity: 10_000 })

  if (result.bestJudgment && result.bestJudgment.action.type === 'enter') {
    portfolio.processJudgment(
      result.bestJudgment.action,
      asset,
      Date.now(),
      result.judgment.id,
    )
  }

  portfolio.tick(asset, candles[candles.length - 1].c)

  return {
    judgment: result,
    portfolio: portfolio.snapshot(),
  }
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

export interface AgentReadResult {
  candles: Candle[]
  segments: OverlaySegment[]
  regime: { mode: ReaderMarketRegimeMode; label: string; rangePct: number; driftPct: number; directionalEfficiency: number } | null
  auction: { location: string; locationLabel: string; bias: string; narrative: string; profile: { poc: number; valueAreaLow: number; valueAreaHigh: number; bins: { low: number; high: number; volume: number }[] } | null; level: { price: number; kind: string; touches: number } | null } | null
  read: { stance: LiveReaderStance; narrative: string; invalidation: string | null; target: string | null; orderflow: { pressure: string; delta: number; tradeCount: number; events: string[] } } | null
  plan: { status: ReaderTradePlanStatus; asset: string; side?: string; entryLow?: number; entryHigh?: number; stop?: number; target?: number; invalidation?: string; confidence: number; reasons: string[] } | null
  judgment: { id: string; action: string; side?: string; confidence: number; reason: string; previousJudgmentId: string | null; allJudgments: { configId: string; label: string; confidence: number; reason: string }[]; metricsSnapshot: Record<string, unknown> | null; createdAt: string } | null
  portfolio: { equity: number; totalPnl: number; dailyPnl: number; tradeCount: number; winCount: number; lossCount: number; openPositionCount: number } | null
  asset: string
  error: string | null
}

export async function buildAgentRead(url: URL): Promise<AgentReadResult> {
  const asset = (url.searchParams.get('asset') ?? 'ETH').toUpperCase()

  const result = await loadAndAnalyze(url, { lookback: 300, interval: '1h' })
  if (result.error) {
    return { candles: [], segments: [], regime: null, auction: null, read: null, plan: null, judgment: null, portfolio: null, asset, error: result.error }
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

  // Fetch persisted admin judgment instead of computing fresh
  const appUrl = process.env.APP_URL ?? 'http://localhost:44100'
  const judgmentResponse = await fetch(
    `${appUrl}/api/judgment/history?asset=${asset}&limit=1`,
  ).catch(() => null)

  let judgment: AgentReadResult['judgment'] = null
  if (judgmentResponse?.ok) {
    const judgmentData = await judgmentResponse.json()
    if (judgmentData.ok && judgmentData.data?.latest) {
      const j = judgmentData.data.latest
      judgment = {
        id: j.id,
        action: j.side ? `enter-${j.side}` : 'no-trade',
        side: j.side ?? undefined,
        confidence: j.confidence ?? 0,
        reason: j.reason ?? 'no judgment',
        previousJudgmentId: j.previousJudgmentId ?? null,
        allJudgments: (j.allJudgments as Array<{
          configId: string
          label: string
          confidence: number
          reason: string
        }>) ?? [],
        metricsSnapshot: j.metricsSnapshot ?? null,
        createdAt: j.createdAt ?? new Date().toISOString(),
      }
    }
  }

  // Fallback: compute fresh if no persisted judgment
  let portfolioSnap: AgentReadResult['portfolio'] = null
  if (!judgment) {
    const judgmentResult = await runAgentJudgmentPipeline(asset, '1h', candles)
    judgment = {
      id: judgmentResult.judgment.judgment.id,
      action: judgmentResult.judgment.bestJudgment?.action.type ?? 'no-trade',
      side: judgmentResult.judgment.bestJudgment?.action.type === 'enter'
        ? judgmentResult.judgment.bestJudgment.action.side
        : undefined,
      confidence: judgmentResult.judgment.bestJudgment?.confidence ?? 0,
      reason: judgmentResult.judgment.bestJudgment?.reason ?? 'no judgment',
      previousJudgmentId: null,
      allJudgments: judgmentResult.judgment.allJudgments.map((j) => ({
        configId: j.configId,
        label: j.label,
        confidence: j.confidence,
        reason: j.reason,
      })),
      metricsSnapshot: null,
      createdAt: new Date().toISOString(),
    }
    portfolioSnap = judgmentResult.portfolio
  }

  return { candles, segments, regime, auction, read: readerRead, plan: tradePlan, judgment, portfolio: portfolioSnap, asset, error: null }
}
