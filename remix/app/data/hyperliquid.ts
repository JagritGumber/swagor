import { createAlova } from 'alova'
import { xhrRequestAdapter } from '@alova/adapter-xhr'
import { ApiError } from '../lib/api/error.ts'

const hlApi = createAlova({
  baseURL: 'https://api.hyperliquid-testnet.xyz',
  requestAdapter: xhrRequestAdapter(),
  responded: {
    onSuccess: async (response) => {
      if (response.status >= 400) {
        throw new ApiError(`HL ${response.status}: ${String(response.data ?? '')}`, response.status, 'HL_ERROR')
      }
      return response.data
    },
  },
})

export type Candle = {
  t: number
  o: string
  c: string
  h: string
  l: string
  v: string
  n: number
}

export function fetchCandles(
  coin: string,
  interval: string,
  startMs: number,
  endMs: number,
): Promise<Candle[]> {
  return hlApi.Post<Candle[]>('/info', {
    type: 'candleSnapshot',
    req: { coin, interval, startTime: startMs, endTime: endMs },
  })
}
