import type { AppContext } from '../router.ts'
import { runJudgmentPipeline } from './judgment-pipeline'
import { loadCandlesForAsset } from '@/services/judgment/candle-loader'
import { getSSEManager } from '@/services/sse/sse-manager'
import type { SSEClient } from '@/services/sse/sse-manager'

const LOOKBACK = 200
const INTERVAL = '1h'

async function runJudgmentForAsset(asset: string) {
  const candles = await loadCandlesForAsset(asset, LOOKBACK, INTERVAL)
  if (candles.length === 0) return null

  const pipelineResult = await runJudgmentPipeline(asset, INTERVAL, candles)
  const engineResult = pipelineResult.judgment
  const judgment = engineResult.judgment

  const action = judgment.action
  let stance: 'long' | 'short' | 'wait' = 'wait'
  if (action.type === 'enter') {
    stance = action.side
  } else if (action.type === 'hold') {
    stance = 'long' // or could be 'short' depending on position, but we don't have that info
  }

  return {
    asset,
    regime: judgment.metrics.regime ?? null,
    auction: null, // not available in current engine
    stance,
    confidence: engineResult.bestJudgment?.confidence ?? 0,
    narrative: judgment.reason ?? '',
    updatedAt: Date.now(),
  }
}

export async function judgmentStream(context: AppContext) {
  const url = new URL(context.request.url)
  const asset = (url.searchParams.get('asset') ?? 'ETH').toUpperCase()

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      const send = (event: string, data: unknown) => {
        const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
        controller.enqueue(encoder.encode(message))
      }

      // Send initial judgment
      try {
        const initial = await runJudgmentForAsset(asset)
        if (initial) send('init', initial)
      } catch (err) {
        console.error(`[judgment-stream] initial judgment failed for ${asset}:`, err)
      }

      // Subscribe to SSE manager for updates
      const sseManager = getSSEManager()
      const client: SSEClient = {
        send,
        close: () => {},
      }
      sseManager.subscribe(client, asset)

      // Keep connection alive with heartbeat
      const heartbeat = setInterval(() => {
        send('heartbeat', { timestamp: Date.now() })
      }, 15_000)

      // Clean up on disconnect
      context.request.signal.addEventListener('abort', () => {
        clearInterval(heartbeat)
        sseManager.unsubscribe(client)
        controller.close()
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}