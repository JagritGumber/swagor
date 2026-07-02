import type { Candle } from './types.ts'

export interface FormingCandle extends Candle {
  interval: string
  closed: boolean
}

export interface CandleAggregator {
  applyTrade(asset: string, interval: string, intervalMs: number, price: number, size: number, timestamp: number): 'tick' | 'close'
  getForming(asset: string, interval: string): FormingCandle | null
  getClosed(): FormingCandle[]
}

const key = (asset: string, interval: string) => `${asset}:${interval}`

export function createCandleAggregator(): CandleAggregator {
  const candles = new Map<string, FormingCandle>()
  const closed: FormingCandle[] = []

  function bucketKey(intervalMs: number, timestamp: number): number {
    return Math.floor(timestamp / intervalMs) * intervalMs
  }

  function applyTrade(
    asset: string,
    interval: string,
    intervalMs: number,
    price: number,
    size: number,
    timestamp: number,
  ): 'tick' | 'close' {
    const k = key(asset, interval)
    const bk = bucketKey(intervalMs, timestamp)

    const current = candles.get(k)
    if (current && current.t !== bk) {
      closed.push({ ...current, closed: true })
      candles.delete(k)
      const next: FormingCandle = {
        t: bk, o: price, h: price, l: price, c: price, v: size,
        interval, closed: false,
      }
      candles.set(k, next)
      return 'close'
    }

    let candle = candles.get(k)
    if (!candle) {
      candle = {
        t: bk, o: price, h: price, l: price, c: price, v: size,
        interval, closed: false,
      }
      candles.set(k, candle)
      return 'tick'
    }

    if (price > candle.h) candle.h = price
    if (price < candle.l) candle.l = price
    candle.c = price
    candle.v += size
    return 'tick'
  }

  function getForming(asset: string, interval: string): FormingCandle | null {
    return candles.get(key(asset, interval)) ?? null
  }

  function getClosed(): FormingCandle[] {
    const out = closed.slice()
    closed.length = 0
    return out
  }

  return { applyTrade, getForming, getClosed }
}
