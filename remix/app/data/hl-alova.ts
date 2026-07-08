import { createAlova } from 'alova'
import { xhrRequestAdapter } from '@alova/adapter-xhr'
import { retry, createRateLimiter } from 'alova/server'
import { networks } from '../lib/networks.ts'

const HL_TIMEOUT = 10_000

const memoryStore = new Map<string, unknown>()
const l2Cache = {
  get: (key: string): any => memoryStore.get(key) ?? undefined,
  set: (key: string, value: unknown) => { memoryStore.set(key, value) },
  remove: (key: string) => { memoryStore.delete(key) },
  clear: () => { memoryStore.clear() },
}

export const hlAlova = createAlova({
  baseURL: networks.testnet.hlInfoUrl,
  requestAdapter: xhrRequestAdapter(),
  timeout: HL_TIMEOUT,
  l2Cache,
  responded: (response) => {
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`HL ${response.status}: ${response.data}`)
    }
    return response.data
  },
})

const hlRateLimit = createRateLimiter({
  duration: 60_000,
  points: 20,
  keyPrefix: 'hl-api',
})

export async function hlPost<T>(body: Record<string, any>): Promise<T> {
  const method = hlAlova.Post<T>('', body, {
    headers: { 'Content-Type': 'application/json' },
  })
  const limited = hlRateLimit(method, { key: 'hl' })
  const hooked = retry(limited, {
    retry: 3,
    backoff: {
      delay: 1000,
      multiplier: 2,
      startQuiver: 0.3,
      endQuiver: 0.7,
    },
  })
  return hooked.send() as Promise<T>
}

export type Candle = {
  t: number
  T: number
  s: string
  i: string
  o: string
  c: string
  h: string
  l: string
  v: string
  n: number
}

export function hlCandles(
  coin: string,
  interval: string,
  startMs: number,
  endMs: number,
): Promise<Candle[]> {
  return hlPost<Candle[]>({
    type: 'candleSnapshot',
    req: { coin, interval, startTime: startMs, endTime: endMs },
  })
}