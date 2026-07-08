import { hlCandles, type Candle } from './hl-alova.ts'

export type { Candle }

export function fetchCandles(
  coin: string,
  interval: string,
  startMs: number,
  endMs: number,
): Promise<Candle[]> {
  return hlCandles(coin, interval, startMs, endMs)
}
