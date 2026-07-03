// status: Unused — replaced by lightweight-charts lw-chart.ts
import type { Candle } from '../types/candles.ts'

export async function fetchCandles(
  asset: string,
  interval: string,
  start: number,
  end: number,
): Promise<Candle[]> {
  const params = new URLSearchParams({ asset, interval, start: String(start), end: String(end) })
  const res = await fetch(`/api/candles?${params}`)
  if (!res.ok) return []
  const json = await res.json()
  return (json as { candles: Candle[] }).candles ?? []
}
