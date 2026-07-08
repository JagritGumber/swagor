import type { AppContext } from '../router.ts'
import { retry } from 'alova/server'
import { hlRateLimiter } from '@alova/index'
import { getCandles, type HyperliquidCandle } from '@alova/methods/hyperliquid'
import { tryCatch } from '../lib/api/try-catch.ts'
import { VALID_INTERVALS, toCandle } from './shared.ts'
import { apiSuccess, apiError } from '../lib/api/response.ts'

export async function candles(context: AppContext) {
  const url = new URL(context.request.url)
  const asset = (url.searchParams.get('asset') ?? 'ETH').toUpperCase()
  const interval = url.searchParams.get('interval') ?? '1h'
  const start = Number(url.searchParams.get('start')) || Date.now() - 86_400_000
  const end = Number(url.searchParams.get('end')) || Date.now()

  if (!VALID_INTERVALS.has(interval)) {
    return apiError('INVALID_INTERVAL', `Invalid interval: ${interval}`, 400)
  }

  const method = getCandles('testnet', asset, interval, start, end)
  const limiter = hlRateLimiter(method, { key: 'hl' })
  const hooked = retry(limiter, {
    retry: 3,
    backoff: { delay: 1000, multiplier: 2, startQuiver: 0.3, endQuiver: 0.7 },
  })

  const { data: raw, error } = await tryCatch(hooked.send() as Promise<HyperliquidCandle[]>)
  if (error) {
    return apiError('UPSTREAM_ERROR', error.message, 502)
  }

  const candleList = raw.map(toCandle)
  return apiSuccess({ candles: candleList })
}
