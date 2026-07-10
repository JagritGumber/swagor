import { Worker, Job } from 'bullmq'
import {
  runJudgmentForInstance,
  runAdminJudgment,
} from './judgment.service.ts'
import { getSSEManager } from '@/services/sse/sse-manager'

type CandleCloseMessage = {
  asset: string
  interval: string
  candle: {
    t: number
    o: number
    h: number
    l: number
    c: number
    v: number
  }
}

let worker: Worker<CandleCloseMessage> | null = null

export function startJudgmentWorker(redisUrl: string): void {
  if (worker) return

  worker = new Worker<CandleCloseMessage>(
    'judgment-tick',
    async (job: Job<CandleCloseMessage>) => {
      const { asset } = job.data
      console.log(`[judgment-worker] processing candle close for ${asset}`)

      try {
        await runAdminJudgment(asset)

        // Broadcast judgment update to SSE clients
        const sseManager = getSSEManager()
        if (sseManager.getSubscriberCount(asset) > 0) {
          const { runJudgmentPipeline } = await import('./judgment-pipeline.ts')
          const { loadCandlesForAsset } = await import('./candle-loader.ts')
          const candles = await loadCandlesForAsset(asset, 200, '1h')
          if (candles.length > 0) {
            const result = await runJudgmentPipeline(asset, '1h', candles)
            if (result?.judgment) {
              sseManager.broadcast(asset, 'judgment-update', {
                asset,
                regime: result.judgment.regime ?? null,
                auction: result.judgment.auction ?? null,
                stance: result.judgment.stance ?? 'wait',
                confidence: result.judgment.confidence ?? 0,
                narrative: result.judgment.narrative ?? '',
                updatedAt: Date.now(),
              })
            }
          }
        }
      } catch (err) {
        console.error(`[judgment-worker] admin judgment failed for ${asset}:`, err)
      }

      return { processed: true, asset }
    },
    {
      connection: {
        host: new URL(redisUrl).hostname,
        port: Number(new URL(redisUrl).port) || 6379,
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
      },
      concurrency: 1,
      limiter: {
        max: 10,
        duration: 60_000,
      },
    },
  )

  worker.on('completed', (job) => {
    console.log(`[judgment-worker] completed: ${job.data.asset}:${job.data.interval}`)
  })

  worker.on('failed', (job, err) => {
    console.error(`[judgment-worker] failed: ${job?.data.asset}:${job?.data.interval}`, err.message)
  })

  console.log('[judgment-worker] started, listening on queue "judgment-tick"')
}

export async function stopJudgmentWorker(): Promise<void> {
  if (worker) {
    await worker.close()
    worker = null
  }
}
