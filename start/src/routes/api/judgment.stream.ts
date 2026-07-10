import { createFileRoute } from '@tanstack/react-router'
import { runJudgmentPipeline } from '@/services/judgment/judgment-pipeline.ts'
import { loadCandlesForAsset } from '@/services/judgment/candle-loader.ts'
import { getSSEManager } from '@/services/sse/sse-manager.ts'
import type { SSEClient } from '@/services/sse/sse-manager.ts'

const LOOKBACK = 200
const INTERVAL = '1h'

async function runJudgmentForAsset(asset: string) {
  const candles = await loadCandlesForAsset(asset, LOOKBACK, INTERVAL)
  if (candles.length === 0) return null

  const pipelineResult = await runJudgmentPipeline(asset, INTERVAL, candles)
  const judgment = pipelineResult.judgment
  if (!judgment) return null

  return {
    asset,
    regime: judgment.regime ?? null,
    auction: judgment.auction ?? null,
    stance: judgment.stance ?? 'wait',
    confidence: judgment.confidence ?? 0,
    narrative: judgment.narrative ?? '',
    updatedAt: judgment.updatedAt ?? Date.now(),
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
