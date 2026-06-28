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

export interface OverlayData {
  valueAreaLow?: number
  valueAreaHigh?: number
  poc?: number
  regimeMode?: string
  currentPrice?: number
}
