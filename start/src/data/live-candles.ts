import type { Candle } from '@shared/candle'

export interface LiveCallbacks {
  onUpdate(candle: Candle): void
  onClose(candle: Candle): void
}

const INGESTION_URL = 'http://localhost:44101/subscribe'

export function connectLiveCandles(
  asset: string,
  interval: string,
  callbacks: LiveCallbacks,
  signal: AbortSignal,
): void {
  const params = new URLSearchParams({ asset, interval })
  const es = new EventSource(`${INGESTION_URL}?${params}`)

  es.addEventListener('candle-update', (e) => {
    const data = JSON.parse(e.data)
    if (data.interval !== interval) return
    callbacks.onUpdate(data)
  })

  es.addEventListener('candle-close', (e) => {
    const data = JSON.parse(e.data)
    if (data.interval !== interval) return
    callbacks.onClose(data)
  })

  es.addEventListener('error', () => {})

  signal.addEventListener('abort', () => es.close(), { once: true })
}
