import type { IncomingMessage, ServerResponse } from 'node:http'
import type { SSEClient, SSEManager } from '../sse-manager.ts'
import type { TradeBuffer } from '../trade-buffer.ts'
import type { CandleAggregator } from '../candle-aggregator.ts'

export const INTERVAL_MS: Record<string, number> = {
  '1m': 60_000,
  '5m': 300_000,
  '15m': 900_000,
  '1h': 3_600_000,
  '4h': 14_400_000,
  '1d': 86_400_000,
}

function createSSEClient(res: ServerResponse): SSEClient {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  })
  return {
    send(event: string, data: unknown) {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
    },
    close() {
      res.end()
    },
  }
}

export function handleSubscribe(
  req: IncomingMessage,
  res: ServerResponse,
  sseManager: SSEManager,
  tradeBuffer: TradeBuffer,
  aggregator: CandleAggregator,
): void {
  if (!req.url) {
    res.writeHead(400)
    res.end()
    return
  }
  const url = new URL(req.url, 'http://localhost')
  const asset = (url.searchParams.get('asset') ?? 'ETH').toUpperCase()
  const interval = url.searchParams.get('interval') ?? '1h'
  const intervalMs = INTERVAL_MS[interval]
  if (!intervalMs) {
    res.writeHead(400, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: `Invalid interval: ${interval}` }))
    return
  }

  const client = createSSEClient(res)
  sseManager.subscribe(client, asset)

  const forming = aggregator.getForming(asset, interval)
  const trades = tradeBuffer.getAll()
  client.send('init', { asset, interval, formingCandle: forming, trades })

  res.on('close', () => {
    sseManager.unsubscribe(client)
  })
}
