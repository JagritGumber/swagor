import { Queue } from 'bullmq'
import { Redis } from 'ioredis'

export type CandleCloseMessage = {
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

let queue: Queue<CandleCloseMessage> | null = null

export function createJudgmentQueue(redisUrl: string): Queue<CandleCloseMessage> {
  if (queue) return queue

  const connection = new Redis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  })

  queue = new Queue<CandleCloseMessage>('judgment-tick', {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
      removeOnComplete: { age: 3600 },
      removeOnFail: { age: 86400 },
    },
  })

  return queue
}

export async function publishCandleClose(
  asset: string,
  interval: string,
  candle: CandleCloseMessage['candle'],
): Promise<void> {
  if (!queue) return
  const jobId = `${asset}:${interval}:${candle.t}`
  await queue.add('candle-close', { asset, interval, candle }, { jobId })
}

export async function closeJudgmentQueue(): Promise<void> {
  if (queue) {
    await queue.close()
    queue = null
  }
}
