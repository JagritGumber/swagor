import { createFileRoute } from '@tanstack/react-router'
import { loadCandlesForAsset } from '@/services/judgment/candle-loader.ts'
import { getSSEManager } from '@/services/sse/sse-manager.ts'
import { buildReaderHistoryReads } from '@packages/strategy-lab/reader/reader-history/build-reader-history-reads'
import { readOrderflowWindow } from '@packages/strategy-lab/read-core/orderflow/read-orderflow-window'
import { startLiveOrderflow, getLiveOrderflowWindow, expireLiveOrderflow } from '@/server/live-orderflow'
import { getReaderState } from '@/server/reader-state'
import type { SSEClient } from '@/services/sse/sse-manager.ts'
import type { OrderflowEvent } from '@packages/strategy-lab/read-core/orderflow/types'

const LOOKBACK = 200
const INTERVAL = '1h'
const INTERVAL_MS = 3_600_000

function orderflowEventsFromWindow(window: { trades: Array<{ asset: string; side: 'buy' | 'sell'; price: number; size: number; time: number; id: string }> }): OrderflowEvent[] {
  return window.trades.map((trade) => ({
    type: 'trade' as const,
    receivedAt: trade.time,
    trade,
  }))
}

async function runJudgmentForAsset(asset: string) {
  const candles = await loadCandlesForAsset(asset, LOOKBACK, INTERVAL)
  if (candles.length === 0) return null

  startLiveOrderflow(asset, 'testnet')
  expireLiveOrderflow(Date.now())
  const window = getLiveOrderflowWindow()
  const orderflow = readOrderflowWindow({ asset, window })
  const orderflowEvents = orderflowEventsFromWindow(window)

  const { auctionModeState, vpStateMemory } = getReaderState(asset)

  const steps = buildReaderHistoryReads({
    asset,
    interval: INTERVAL,
    candleIntervalMs: INTERVAL_MS,
    candles,
    orderflowEvents,
    readIntervalMs: INTERVAL_MS,
    orderflowWindowMs: 60_000,
    startAt: candles.length >= 2 ? candles[candles.length - 2].t : Date.now() - INTERVAL_MS,
    endAt: candles[candles.length - 1]?.t ?? Date.now(),
    auctionModeState,
    vpStateMemory,
  })

  const latestStep = steps[steps.length - 1]
  if (!latestStep) return null

  const read = latestStep.read
  return {
    asset,
    regime: read.regime ?? null,
    auction: {
      location: read.auction.location,
      locationLabel: read.auction.location,
      bias: read.auction.bias,
      narrative: read.auction.narrative,
    },
    stance: read.stance,
    confidence: 0.5,
    narrative: read.narrative,
    updatedAt: Date.now(),
  }
}

export const Route = createFileRoute('/api/judgment/stream')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const asset = (url.searchParams.get('asset') ?? 'ETH').toUpperCase()

        const stream = new ReadableStream({
          async start(controller) {
            const encoder = new TextEncoder()
            const send = (event: string, data: unknown) => {
              const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
              controller.enqueue(encoder.encode(message))
            }

            try {
              const initial = await runJudgmentForAsset(asset)
              if (initial) send('init', initial)
            } catch (err) {
              console.error(`[judgment-stream] initial judgment failed for ${asset}:`, err)
            }

            const sseManager = getSSEManager()
            const client: SSEClient = {
              send,
              close: () => {},
            }
            sseManager.subscribe(client, asset)

            const heartbeat = setInterval(() => {
              send('heartbeat', { timestamp: Date.now() })
            }, 15_000)

            request.signal.addEventListener('abort', () => {
              clearInterval(heartbeat)
              sseManager.unsubscribe(client)
              try {
                controller.close()
              } catch {
                // already closed
              }
            })
          },
        })

        return new Response(stream, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
          },
        })
      },
    },
  },
})
