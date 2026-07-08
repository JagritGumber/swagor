import type { ReaderMarketRegimeMode } from '@packages/strategy-lab/read-core/market-regime/types'

// status: Unused — replaced by lightweight-charts
export interface ChartConfig {
  width: number
  height: number
  padding: { top: number; right: number; bottom: number; left: number }
}

// status: Unused — replaced by lightweight-charts
export interface Scale {
  xStep: number
  candleWidth: number
  x: (index: number) => number
  y: (price: number) => number
  yInverse: (pixel: number) => number
  minPrice: number
  maxPrice: number
}

export interface OverlaySegment {
  startIndex: number
  endIndex: number
  mode: ReaderMarketRegimeMode
  poc: number
  valueAreaLow: number
  valueAreaHigh: number
  high?: number
  low?: number
  bins?: { low: number; high: number; mid: number; volume: number }[]
}

export interface OverlayData {
  segments: OverlaySegment[]
  currentPrice?: number
}
