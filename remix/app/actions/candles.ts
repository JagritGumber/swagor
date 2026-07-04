import type { AppContext } from '../router.ts'
import { fetchCandles } from '../data/hyperliquid.ts'
import { tryCatch } from '../lib/api/try-catch.ts'
import { VALID_INTERVALS, toCandle } from './shared.ts'

export async function candles(context: AppContext) {
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
}
