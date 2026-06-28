import type { Candle } from '../types/candles.ts'
import type { OverlaySegment } from '../components/chart/types.ts'

export interface FetchResult {
  candles: Candle[]
  segments: OverlaySegment[]
}

export async function fetchCandles(
  asset: string,
  interval: string,
  start: number,
  end: number,
): Promise<FetchResult> {
  const params = new URLSearchParams({ asset, interval, start: String(start), end: String(end) })
  const res = await fetch(`/api/candles?${params}`)
  if (!res.ok) return { candles: [], segments: [] }
  const json = await res.json()
  return {
    candles: (json as { candles: Candle[] }).candles ?? [],
    segments: (json as { segments: OverlaySegment[] }).segments ?? [],
  }
}
