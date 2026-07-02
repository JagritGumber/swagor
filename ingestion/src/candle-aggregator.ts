import type { Candle } from './types.ts'

export interface FormingCandle extends Candle {
  interval: string
  closed: boolean
}

export interface CandleAggregator {
  applyTrade(interval: string, intervalMs: number, price: number, size: number, timestamp: number): 'tick' | 'close'
  getForming(interval: string): FormingCandle | null
  getClosed(): FormingCandle[]
}

export function createCandleAggregator(): CandleAggregator {
  const candles = new Map<string, FormingCandle>()
  const closed: FormingCandle[] = []

  function bucketKey(intervalMs: number, timestamp: number): number {
    return Math.floor(timestamp / intervalMs) * intervalMs
  }

  function applyTrade(
    interval: string,
    intervalMs: number,
    price: number,
    size: number,
    timestamp: number,
  ): 'tick' | 'close' {
    const key = bucketKey(intervalMs, timestamp)

    const current = candles.get(interval)
    if (current && current.t !== key) {
      closed.push({ ...current, closed: true })
      candles.delete(interval)
      const next: FormingCandle = {
        t: key, o: price, h: price, l: price, c: price, v: size,
        interval, closed: false,
      }
      candles.set(interval, next)
      return 'close'
    }

    let candle = candles.get(interval)
    if (!candle) {
      candle = {
        t: key, o: price, h: price, l: price, c: price, v: size,
        interval, closed: false,
      }
      candles.set(interval, candle)
      return 'tick'
    }

    if (price > candle.h) candle.h = price
    if (price < candle.l) candle.l = price
    candle.c = price
    candle.v += size
    return 'tick'
  }

  function getForming(interval: string): FormingCandle | null {
    return candles.get(interval) ?? null
  }

  function getClosed(): FormingCandle[] {
    const out = closed.slice()
    closed.length = 0
    return out
  }

  return { applyTrade, getForming, getClosed }
}
