import type { Measurement } from './measurement'

export type FeatureEngineeringConfig = {
  lookbackWindows: number
}

export type Features = {
  timestamp: number
  symbol: string
  measurement: Measurement
  // Rolling
  deltaMA: number
  deltaMomentum: number
  volumeMomentum: number
  buyRatioMA: number
  // Normalized
  deltaZScore: number
  volumeZScore: number
}

const DEFAULT_CONFIG: FeatureEngineeringConfig = {
  lookbackWindows: 3,
}

function rollingMean(values: number[], window: number): number {
  if (values.length === 0) return 0
  const slice = values.slice(-window)
  return slice.reduce((sum, v) => sum + v, 0) / slice.length
}

function rollingStd(values: number[], window: number): number {
  if (values.length < 2) return 1
  const slice = values.slice(-window)
  const mean = slice.reduce((sum, v) => sum + v, 0) / slice.length
  const variance = slice.reduce((sum, v) => sum + (v - mean) ** 2, 0) / slice.length
  return Math.sqrt(variance) || 1
}

export function engineerFeatures(
  measurements: Measurement[],
  config: FeatureEngineeringConfig = DEFAULT_CONFIG,
): Features[] {
  const features: Features[] = []
  const lookback = config.lookbackWindows

  const deltas = measurements.map(m => m.delta)
  const volumes = measurements.map(m => m.totalVolume)
  const buyRatios = measurements.map(m => m.buyRatio)

  for (let i = 0; i < measurements.length; i++) {
    const m = measurements[i]
    const deltaSlice = deltas.slice(0, i + 1)
    const volumeSlice = volumes.slice(0, i + 1)
    const buyRatioSlice = buyRatios.slice(0, i + 1)

    const deltaMA = rollingMean(deltaSlice, lookback)
    const deltaMomentum = i > 0 ? m.delta - measurements[i - 1].delta : 0
    const volumeMomentum = i > 0 ? m.totalVolume - measurements[i - 1].totalVolume : 0
    const buyRatioMA = rollingMean(buyRatioSlice, lookback)

    const deltaStd = rollingStd(deltaSlice, lookback)
    const volumeStd = rollingStd(volumeSlice, lookback)
    const deltaZScore = deltaStd > 0 ? (m.delta - deltaMA) / deltaStd : 0
    const volumeZScore = volumeStd > 0 ? (m.totalVolume - rollingMean(volumeSlice, lookback)) / volumeStd : 0

    features.push({
      timestamp: m.timestamp,
      symbol: m.symbol,
      measurement: m,
      deltaMA,
      deltaMomentum,
      volumeMomentum,
      buyRatioMA,
      deltaZScore,
      volumeZScore,
    })
  }

  return features
}
