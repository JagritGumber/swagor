import type { Candle } from '../../../../judgment/src/shared/types.ts'
import { toCandle } from '@shared/candle'
import { getCandles, type HyperliquidCandle } from '@alova/methods/hyperliquid'
import { hlRateLimiter } from '@alova/index'
import { retry } from 'alova/server'
import { tryCatch } from '../../lib/api/try-catch.ts'

const INTERVAL_MS: Record<string, number> = {
  '1m': 60_000,
  '5m': 300_000,
  '15m': 900_000,
  '1h': 3_600_000,
  '4h': 14_400_000,
  '1d': 86_400_000,
}

export async function loadCandlesForAsset(
  asset: string,
  lookback: number,
  interval: string,
): Promise<Candle[]> {
  const now = Date.now()
  const startTime = now - INTERVAL_MS[interval] * lookback
  const method = getCandles('testnet', asset, interval, startTime, now)
  const limiter = hlRateLimiter(method, { key: 'hl' })
  const hooked = retry(limiter, {
    retry: 3,
    backoff: { delay: 1000, multiplier: 2, startQuiver: 0.3, endQuiver: 0.7 },
  })
  const { data: rawCandles, error } = await tryCatch(
    hooked.send() as Promise<HyperliquidCandle[]>,
  )
  if (error !== null) {
    throw new Error(`Failed to load candles for ${asset}: ${error.message}`)
  }
  return rawCandles.map(toCandle)
}
