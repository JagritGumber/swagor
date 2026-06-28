import type { ReaderMarketRegimeMode } from '@packages/strategy-lab/read-core/market-regime/types'

export interface ChartConfig {
  width: number
  height: number
  padding: { top: number; right: number; bottom: number; left: number }
}

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
}

export interface OverlayData {
  segments: OverlaySegment[]
  currentPrice?: number
}
