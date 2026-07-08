import { networks } from '../lib/networks.ts'

export type Candle = {
  t: number
  o: string
  c: string
  h: string
  l: string
  v: string
  n: number
}

export async function fetchCandles(
  coin: string,
  interval: string,
  startMs: number,
  endMs: number,
): Promise<Candle[]> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10_000)

  try {
    const res = await fetch(networks.testnet.hlInfoUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'candleSnapshot',
        req: { coin, interval, startTime: startMs, endTime: endMs },
      }),
      signal: controller.signal,
    })

    if (!res.ok) {
      throw new Error(`HL ${res.status}: ${await res.text()}`)
    }

    return res.json() as Promise<Candle[]>
  } finally {
    clearTimeout(timeout)
  }
}
