import { createController } from 'remix/router'

import { assetServer } from '../assets.ts'
import { routes } from '../routes.ts'
import { LandingPage } from '../pages/landing/page.tsx'
import { PortfolioPage } from '../pages/portfolio.tsx'
import { AgentPage } from '../pages/agent.tsx'
import { fetchCandles } from '../data/hyperliquid.ts'
import type { SelboReasoning, ReaderReadResult } from '../types/reader.ts'
import type { Candle } from '../types/candles.ts'
import type { OverlaySegment } from '../components/chart/types.ts'
import { buildSelboReasoning } from '../data/selbo-reasoning.ts'
import { tryCatch } from '../lib/api/try-catch.ts'
import { readMarketRegime } from '@packages/strategy-lab/read-core/market-regime/read-market-regime'
import { readMarketAuction } from '@packages/strategy-lab/read-core/read/read-market-auction'
import { readRegimeSegments } from '@packages/strategy-lab/read-core/market-regime/read-regime-segments'
import { createOrderflowWindow } from '@packages/strategy-lab/read-core/orderflow/create-orderflow-window'
import { readOrderflowWindow } from '@packages/strategy-lab/read-core/orderflow/read-orderflow-window'
import { combineAuctionOrderflow } from '@packages/strategy-lab/reader/reader-live/combine-auction-orderflow'
import { buildReaderTradePlan } from '@packages/strategy-lab/backtest/trade-plan/build-reader-trade-plan'

const VALID_INTERVALS = new Set(['1m', '5m', '15m', '1h', '4h', '1d'])
const INTERVAL_MS: Record<string, number> = {
  '1m': 60_000,
  '5m': 300_000,
  '15m': 900_000,
  '1h': 3_600_000,
  '4h': 14_400_000,
  '1d': 86_400_000,
}

function toCandle(
  raw: { t: number; o: string; c: string; h: string; l: string; v: string },
): Candle {
  return {
    t: raw.t,
    o: Number(raw.o),
    h: Number(raw.h),
    l: Number(raw.l),
    c: Number(raw.c),
    v: Number(raw.v),
  }
}

function round(v: number, decimals = 4): number {
  return Number(v.toFixed(decimals))
}

function formatAuctionLocation(location: string): string {
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

function formatRegime(mode: string): string {
  const map: Record<string, string> = {
    range: 'Ranging',
    'trend-up': 'Trending up',
    'trend-down': 'Trending down',
    'high-vol': 'High volatility',
    unknown: 'Unknown',
  }
  return map[mode] ?? mode
}

interface ReaderRegime {
  mode: string
  label: string
  highVol: boolean
  rangePct: number
  driftPct: number
  directionalEfficiency: number
  reason: string
}

interface ReaderAuctionProfile {
  poc: number
  valueAreaLow: number
  valueAreaHigh: number
  binCount: number
}

interface ReaderAuctionLevel {
  price: number
  kind: string
  touches: number
}

interface ReaderAuction {
  location: string
  locationLabel: string
  bias: string
  narrative: string
  invalidation: string | null
  target: string | null
  profile: ReaderAuctionProfile | null
  level: ReaderAuctionLevel | null
}

interface ReaderReadSuccess {
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

interface BuildReaderResult {
  read: ReaderReadResult
  candles: Candle[]
}

async function buildReaderRead(url: URL, lookback?: number, existingCandles?: Candle[]): Promise<BuildReaderResult> {
  const asset = (url.searchParams.get('asset') ?? 'ETH').toUpperCase()
  const interval = url.searchParams.get('interval') ?? '1h'

  if (!VALID_INTERVALS.has(interval)) {
    return { read: { ok: false, error: `Invalid interval. Use: ${Array.from(VALID_INTERVALS).join(', ')}` }, candles: [] }
  }

  const now = Date.now()
  let candles: Candle[]
  if (existingCandles !== undefined) {
    candles = existingCandles
  } else {
    const lb = lookback ?? Math.min(Math.max(Number(url.searchParams.get('lookback') ?? '200'), 20), 800)
    const { data: rawCandles, error: err } = await tryCatch(fetchCandles(asset, interval, now - INTERVAL_MS[interval] * lb, now))
    if (err !== null) {
      return { read: { ok: false, error: err.message }, candles: [] }
    }
    if (rawCandles.length === 0) {
      return { read: { ok: false, error: 'No candle data available for this asset' }, candles: [] }
    }
    candles = rawCandles.map(toCandle)
  }
  const lastCandle = candles[candles.length - 1]

  const rawRegime = readMarketRegime({ candles, now })
  const rawAuction = readMarketAuction({
    asset,
    interval,
    candles,
    price: lastCandle.c,
  })

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
      ? {
          poc: round(rawAuction.profile.poc),
          valueAreaLow: round(rawAuction.profile.valueAreaLow),
          valueAreaHigh: round(rawAuction.profile.valueAreaHigh),
          binCount: rawAuction.profile.bins.length,
        }
      : null,
    level: rawAuction.level
      ? {
          price: round(rawAuction.level.price),
          kind: rawAuction.level.kind,
          touches: rawAuction.level.touches,
        }
      : null,
  }

  const data: ReaderReadSuccess = {
    asset,
    interval,
    lastPrice: lastCandle.c,
    lastCandleAt: new Date(lastCandle.t).toISOString(),
    readAt: new Date(now).toISOString(),
    candleCount: candles.length,
    regime: formattedRegime,
    auction: formattedAuction,
    reasoning: buildSelboReasoning(asset, formattedRegime, formattedAuction),
    summary: `${asset} is ${formatRegime(rawRegime.mode)}. Price is ${formatAuctionLocation(rawAuction.location)} at $${round(lastCandle.c)}. Bias: ${rawAuction.bias}.`,
  }

  return { read: { ok: true, data }, candles }
}

export default createController(routes, {
  actions: {
    async assets(context) {
      return (
        (await assetServer.fetch(context.request)) ?? new Response('Not Found', { status: 404 })
      )
    },
    async home(context) {
      return context.render(<LandingPage />)
    },
    async candles(context) {
      const url = new URL(context.request.url)
      const asset = (url.searchParams.get('asset') ?? 'ETH').toUpperCase()
      const interval = url.searchParams.get('interval') ?? '1h'
      const start = Number(url.searchParams.get('start')) || Date.now() - 86_400_000
      const end = Number(url.searchParams.get('end')) || Date.now()

      if (!VALID_INTERVALS.has(interval)) {
        return Response.json({ candles: [], error: `Invalid interval: ${interval}` }, { status: 400 })
      }

      const { data: raw, error } = await tryCatch(fetchCandles(asset, interval, start, end))
      if (error) {
        return Response.json({ candles: [], error: error.message }, { status: 502 })
      }

      const candles = raw.map(toCandle)
      return Response.json({ candles })
    },
    async portfolio(context) {
      const url = new URL(context.request.url)
      const lookback = Math.min(Math.max(Number(url.searchParams.get('lookback') ?? '200'), 20), 800)
      const asset = (url.searchParams.get('asset') ?? 'ETH').toUpperCase()
      const interval = url.searchParams.get('interval') ?? '1h'

      if (!VALID_INTERVALS.has(interval)) {
        return context.render(
          <PortfolioPage read={{ ok: false, error: `Invalid interval: ${interval}` }} candles={[]} segments={[]} />,
        )
      }

      const now = Date.now()
      const { data: rawCandles, error: err } = await tryCatch(
        fetchCandles(asset, interval, now - INTERVAL_MS[interval] * lookback, now),
      )
      if (err !== null) {
        return context.render(
          <PortfolioPage read={{ ok: false, error: err.message }} candles={[]} segments={[]} />,
        )
      }
      if (rawCandles.length === 0) {
        return context.render(
          <PortfolioPage read={{ ok: false, error: 'No candle data' }} candles={[]} segments={[]} />,
        )
      }

      const candles = rawCandles.map(toCandle)
      const readerResult = await buildReaderRead(url, lookback, candles)
      const segments = readRegimeSegments({ candles, lookback })

      return context.render(
        <PortfolioPage read={readerResult.read} candles={candles} segments={segments} />,
      )
    },
    async agent(context) {
      const url = new URL(context.request.url)
      const asset = (url.searchParams.get('asset') ?? 'ETH').toUpperCase()
      const interval = '1h'
      const lookback = 300

      const now = Date.now()
      const { data: rawCandles, error: err } = await tryCatch(
        fetchCandles(asset, interval, now - INTERVAL_MS[interval] * lookback, now),
      )
      if (err !== null) {
        return context.render(<AgentPage candles={[]} segments={[]} auction={null} regime={null} asset={asset} />)
      }
      if (rawCandles.length === 0) {
        return context.render(<AgentPage candles={[]} segments={[]} auction={null} regime={null} asset={asset} />)
      }

      const candles = rawCandles.map(toCandle)
      const segments = readRegimeSegments({ candles, lookback })
      const lastCandle = candles[candles.length - 1]

      const rawRegime = readMarketRegime({ candles, now })
      const rawAuction = readMarketAuction({
        asset,
        interval,
        candles,
        price: lastCandle.c,
      })

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
                low: round(b.low),
                high: round(b.high),
                volume: b.volume,
              })),
            }
          : null,
        level: rawAuction.level
          ? {
              price: round(rawAuction.level.price),
              kind: rawAuction.level.kind,
              touches: rawAuction.level.touches,
            }
          : null,
      }

      const window = createOrderflowWindow(60_000)
      const orderflow = readOrderflowWindow({ asset, window })
      orderflow.lastPrice = lastCandle.c

      const read = combineAuctionOrderflow({
        auction: rawAuction,
        orderflow,
        regime: rawRegime,
        lastClosedCandle: candles.length >= 2 ? candles[candles.length - 2] : null,
      })

      const plan = buildReaderTradePlan(read)

      const readerRead = {
        stance: read.stance,
        narrative: read.narrative,
        invalidation: read.invalidation,
        target: read.target,
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
            status: plan.status,
            asset: plan.asset,
            side: plan.side,
            entryLow: round(plan.entryLow),
            entryHigh: round(plan.entryHigh),
            stop: round(plan.stop),
            target: round(plan.target),
            invalidation: plan.invalidation,
            confidence: plan.confidence,
            reasons: plan.reasons,
          }

      return context.render(
        <AgentPage
          candles={candles}
          segments={segments}
          auction={auction}
          regime={regime}
          read={readerRead}
          plan={tradePlan}
          asset={asset}
        />,
      )
    },
  },
})
