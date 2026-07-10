import { createFileRoute } from '@tanstack/react-router'
import { toCandle, type RawCandle } from '@shared/candle'
import { tryCatch } from '@/lib/api/try-catch.ts'
import { apiSuccess, apiError } from '@/lib/api/response.ts'
import { networks } from '@/lib/networks.ts'

const VALID_INTERVALS = new Set(['1m', '5m', '15m', '1h', '4h', '1d'])

async function fetchCandles(
  asset: string,
  interval: string,
  start: number,
  end: number,
): Promise<RawCandle[]> {
  const res = await fetch(networks.testnet.hlInfoUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'candleSnapshot',
      req: { coin: asset, interval, startTime: start, endTime: end },
    }),
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) {
    throw new Error(`HL ${res.status}: ${await res.text()}`)
  }
  const data = (await res.json()) as unknown
  if (!Array.isArray(data)) {
    throw new Error(`HL candleSnapshot returned non-array for ${asset}`)
  }
  return data as RawCandle[]
}

export const Route = createFileRoute('/api/candles')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const asset = (url.searchParams.get('asset') ?? 'ETH').toUpperCase()
        const interval = url.searchParams.get('interval') ?? '1h'
        const start = Number(url.searchParams.get('start')) || Date.now() - 86_400_000
        const end = Number(url.searchParams.get('end')) || Date.now()

        if (!VALID_INTERVALS.has(interval)) {
          return apiError('INVALID_INTERVAL', `Invalid interval: ${interval}`, 400)
        }

        const { data: raw, error } = await tryCatch(
          fetchCandles(asset, interval, start, end),
        )
        if (error) {
          return apiError('UPSTREAM_ERROR', error.message, 502)
        }

        const candleList = raw.map(toCandle)
        return apiSuccess({ candles: candleList })
      },
    },
  },
})
