import type { Candle } from '@judgment/src/shared/types'
import { tryCatch } from '@/lib/api/try-catch.ts'
import { retry } from 'alova/server'
import { hlRateLimiter } from '@alova/index'
import { getCandles, type HyperliquidCandle } from '@alova/methods/hyperliquid'

function toCandle(raw: HyperliquidCandle): Candle {
  return {
    t: raw.t,
    o: raw.o,
    h: raw.h,
    l: raw.l,
    c: raw.c,
    v: raw.v,
  }
}

export async function loadCandlesForAsset(
  asset: string,
  lookback: number,
  interval: string,
): Promise<Candle[]> {
  const now = Date.now()
  const intervalMs: Record<string, number> = {
    '1m': 60_000,
    '5m': 300_000,
    '15m': 900_000,
    '1h': 3_600_000,
    '4h': 14_400_000,
    '1d': 86_400_000,
  }

  const ms = intervalMs[interval] ?? 3_600_000
  const startTime = now - ms * lookback

  const method = getCandles('testnet', asset, interval, startTime, now)
  const limiter = hlRateLimiter(method, { key: 'hl' })
  const hooked = retry(limiter, {
    retry: 3,
    backoff: { delay: 1000, multiplier: 2, startQuiver: 0.3, endQuiver: 0.7 },
  })

  const { data: rawCandles, error } = await tryCatch(hooked.send() as Promise<HyperliquidCandle[]>)

  if (error !== null) {
    console.error(`[candle-loader] failed to load candles for ${asset}:`, error.message)
    return []
  }

  return rawCandles.map(toCandle)
}
