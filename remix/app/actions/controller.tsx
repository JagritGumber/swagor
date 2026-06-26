import { createController } from 'remix/router'

import { assetServer } from '../assets.ts'
import { routes } from '../routes.ts'
import { PortfolioPage } from '../pages/portfolio.tsx'
import { fetchCandles } from '../data/hyperliquid.ts'
import { readMarketRegime } from '../../../packages/strategy-lab/read-core/market-regime/read-market-regime.ts'
import { readMarketAuction } from '../../../packages/strategy-lab/read-core/read/read-market-auction.ts'
import type { Candle } from '../../../packages/strategy-lab/types.ts'

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
  summary: string
}

type ReaderReadResult = ReaderReadSuccess | { error: string }

async function buildReaderRead(url: URL): Promise<ReaderReadResult> {
  const asset = (url.searchParams.get('asset') ?? 'ETH').toUpperCase()
  const interval = url.searchParams.get('interval') ?? '1h'

  if (!VALID_INTERVALS.has(interval)) {
    return { error: `Invalid interval. Use: ${Array.from(VALID_INTERVALS).join(', ')}` }
  }

  const now = Date.now()
  const lookbackDays = Math.min(
    Math.max(Number(url.searchParams.get('lookbackDays') ?? '3'), 1),
    14,
  )
  const lookbackMs = Math.min(lookbackDays * 86_400_000, INTERVAL_MS[interval] * 200)

  const rawCandles = await fetchCandles(asset, interval, now - lookbackMs, now).catch(() => [])
  if (rawCandles.length === 0) {
    return { error: 'No candle data available for this asset' }
  }

  const candles: Candle[] = rawCandles.map(toCandle)
  const lastCandle = candles[candles.length - 1]

  const regime = readMarketRegime({ candles, now })
  const auction = readMarketAuction({
    asset,
    interval,
    candles,
    price: lastCandle.c,
  })

  return {
    asset,
    interval,
    lastPrice: lastCandle.c,
    lastCandleAt: new Date(lastCandle.t).toISOString(),
    readAt: new Date(now).toISOString(),
    candleCount: candles.length,
    regime: {
      mode: regime.mode,
      label: formatRegime(regime.mode),
      highVol: regime.highVol,
      rangePct: round(regime.rangePct * 100, 2),
      driftPct: round(regime.driftPct * 100, 2),
      directionalEfficiency: round(regime.directionalEfficiency, 2),
      reason: regime.reason,
    },
    auction: {
      location: auction.location,
      locationLabel: formatAuctionLocation(auction.location),
      bias: auction.bias,
      narrative: auction.narrative,
      invalidation: auction.invalidation,
      target: auction.target,
      profile: auction.profile
        ? {
            poc: round(auction.profile.poc),
            valueAreaLow: round(auction.profile.valueAreaLow),
            valueAreaHigh: round(auction.profile.valueAreaHigh),
            binCount: auction.profile.bins.length,
          }
        : null,
      level: auction.level
        ? {
            price: round(auction.level.price),
            kind: auction.level.kind,
            touches: auction.level.touches,
          }
        : null,
    },
    summary: `${asset} is ${formatRegime(regime.mode)}. Price is ${formatAuctionLocation(auction.location)} at $${round(lastCandle.c)}. Bias: ${auction.bias}.`,
  }
}

export default createController(routes, {
  actions: {
    async assets(context) {
      return (
        (await assetServer.fetch(context.request)) ?? new Response('Not Found', { status: 404 })
      )
    },
    async home() {
      return new Response(null, {
        status: 302,
        headers: { Location: routes.portfolio.href() },
      })
    },
    async portfolio(context) {
      const url = new URL(context.request.url)
      const read = await buildReaderRead(url)
      return context.render(<PortfolioPage read={read} />)
    },
    async readerRead(context) {
      const url = new URL(context.request.url)
      const read = await buildReaderRead(url)
      return Response.json(read)
    },
  },
})
