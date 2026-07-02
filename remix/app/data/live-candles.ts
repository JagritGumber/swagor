import type { Candle } from '../types/candles.ts'
import type { OverlaySegment } from '../components/chart/types.ts'

export interface LiveCallbacks {
  onInit(candles: Candle[], segments: OverlaySegment[]): void
  onUpdate(candle: Candle): void
  onClose(candle: Candle, segments: OverlaySegment[]): void
}

export function connectLiveCandles(
  asset: string,
  interval: string,
  callbacks: LiveCallbacks,
  signal: AbortSignal,
): void {
  const params = new URLSearchParams({ asset, interval })
  const es = new EventSource(`/api/candles/subscribe?${params}`)

  es.addEventListener('init', (e) => {
    const data = JSON.parse(e.data)
    callbacks.onInit(data.candles, data.segments)
  })

  es.addEventListener('candle-update', (e) => {
    callbacks.onUpdate(JSON.parse(e.data))
  })

  es.addEventListener('candle-close', (e) => {
    const data = JSON.parse(e.data)
    callbacks.onClose(data.candle, data.segments)
  })

  es.addEventListener('error', () => {})

  signal.addEventListener('abort', () => es.close(), { once: true })
}
