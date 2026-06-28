import { createController } from 'remix/router'

import { assetServer } from '../assets.ts'
import { routes } from '../routes.ts'
import { PortfolioPage } from '../pages/portfolio.tsx'
import { fetchCandles } from '../data/hyperliquid.ts'
import type { SelboReasoning } from '../types/reader.ts'
import type { Candle } from '../types/candles.ts'
import { buildSelboReasoning } from '../data/selbo-reasoning.ts'
import { readMarketRegime } from '../../../packages/strategy-lab/read-core/market-regime/read-market-regime.ts'
import { readMarketAuction } from '../../../packages/strategy-lab/read-core/read/read-market-auction.ts'

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

type ReaderReadResult = ReaderReadSuccess | { error: string }

interface BuildReaderResult {
  read: ReaderReadSuccess | { error: string }
  candles: Candle[]
}

async function buildReaderRead(url: URL): Promise<BuildReaderResult> {
  const asset = (url.searchParams.get('asset') ?? 'ETH').toUpperCase()
  const interval = url.searchParams.get('interval') ?? '1h'

  if (!VALID_INTERVALS.has(interval)) {
    return { read: { error: `Invalid interval. Use: ${Array.from(VALID_INTERVALS).join(', ')}` }, candles: [] }
  }

  const now = Date.now()
  const lookbackDays = Math.min(
    Math.max(Number(url.searchParams.get('lookbackDays') ?? '3'), 1),
    14,
  )
  const lookbackMs = Math.min(lookbackDays * 86_400_000, INTERVAL_MS[interval] * 200)

  const rawCandles = await fetchCandles(asset, interval, now - lookbackMs, now).catch(() => [])
  if (rawCandles.length === 0) {
    return { read: { error: 'No candle data available for this asset' }, candles: [] }
  }

  const candles: Candle[] = rawCandles.map(toCandle)
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

  const read: ReaderReadSuccess = {
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

  return { read, candles }
}

async function buildCandles(url: URL): Promise<Response> {
  const asset = (url.searchParams.get('asset') ?? 'ETH').toUpperCase()
  const interval = url.searchParams.get('interval') ?? '1h'

  if (!VALID_INTERVALS.has(interval)) {
    return Response.json({ error: `Invalid interval. Use: ${Array.from(VALID_INTERVALS).join(', ')}` }, { status: 400 })
  }

  const now = Date.now()
  const lookbackDays = Math.min(
    Math.max(Number(url.searchParams.get('lookbackDays') ?? '3'), 1),
    14,
  )
  const lookbackMs = Math.min(lookbackDays * 86_400_000, INTERVAL_MS[interval] * 200)

  const rawCandles = await fetchCandles(asset, interval, now - lookbackMs, now).catch(() => [])
  if (rawCandles.length === 0) {
    return Response.json({ error: 'No candle data available for this asset' }, { status: 404 })
  }

  const candles = rawCandles.map(toCandle)

  return Response.json({ asset, interval, candles })
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
      const { read } = await buildReaderRead(url)
      return context.render(<PortfolioPage read={read} />)
    },
    async candles(context) {
      return buildCandles(new URL(context.request.url))
    },
    async readerRead(context) {
      const url = new URL(context.request.url)
      const { read } = await buildReaderRead(url)
      return Response.json(read)
    },
  },
})
