import type { Candle } from '../../types/candles.ts'
import type { ChartConfig, Scale } from './types.ts'

export function buildScale(candles: Candle[], config: ChartConfig): Scale {
  const { width, height, padding } = config
  const count = candles.length
  const maxPrice = Math.max(...candles.map(c => c.h))
  const minPrice = Math.min(...candles.map(c => c.l))
  const priceRange = maxPrice - minPrice || 1
  const paddedMin = minPrice - priceRange * 0.05
  const paddedMax = maxPrice + priceRange * 0.05
  const paddedRange = paddedMax - paddedMin || 1

  const totalWidth = width - padding.left - padding.right
  const totalHeight = height - padding.top - padding.bottom
  const xStep = count > 0 ? totalWidth / count : totalWidth

  return {
    xStep,
    candleWidth: Math.max(1, xStep * 0.7),
    x: (i: number) => padding.left + xStep * i + xStep / 2,
    y: (price: number) => padding.top + totalHeight * (paddedMax - price) / paddedRange,
    yInverse: (pixel: number) => paddedMax - (pixel - padding.top) * paddedRange / totalHeight,
    minPrice: paddedMin,
    maxPrice: paddedMax,
  }
}
