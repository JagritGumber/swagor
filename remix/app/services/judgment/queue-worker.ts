import { Worker, Job } from 'bullmq'
import {
  runJudgmentForInstance,
  runAdminJudgment,
} from './judgment.service.ts'

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
