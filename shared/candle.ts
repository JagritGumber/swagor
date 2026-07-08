export interface RawCandle {
  t: number
  o: string
  c: string
  h: string
  l: string
  v: string
}

export interface Candle {
  t: number
  o: number
  h: number
  l: number
  c: number
  v: number
}

export interface StoredCandle extends Candle {
  asset: string
  interval: string
  closed: boolean
}

export function toCandle(raw: RawCandle): Candle {
  const c = {
    t: raw.t,
    o: Number(raw.o),
    h: Number(raw.h),
    l: Number(raw.l),
    c: Number(raw.c),
    v: Number(raw.v),
  }
  if (
    !Number.isFinite(c.t)
    || !Number.isFinite(c.o)
    || !Number.isFinite(c.h)
    || !Number.isFinite(c.l)
    || !Number.isFinite(c.c)
    || !Number.isFinite(c.v)
  ) {
    throw new Error(`Invalid candle at ${raw.t}`)
  }
  return c
}

export function isBullish(c: Candle): boolean {
  return c.c > c.o
}

export function lastCandle(candles: Candle[]): Candle {
  if (candles.length === 0) throw new Error('Empty candle array')
  return candles[candles.length - 1]
}

export function candleRange(candles: Candle[]): { low: number; high: number } {
  if (candles.length === 0) throw new Error('Empty candle array')
  let low = Infinity
  let high = -Infinity
  for (const c of candles) {
    if (c.l < low) low = c.l
    if (c.h > high) high = c.h
  }
  return { low, high }
}

export function typicalPrice(c: Candle): number {
  return (c.h + c.l + c.c) / 3
}
