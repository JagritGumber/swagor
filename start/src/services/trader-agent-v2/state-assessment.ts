import type { Features } from './feature-engineering'

export type StateAssessment = {
  timestamp: number
  symbol: string
  score: number
  direction: 'long' | 'short' | 'none'
}

export type TrainingSample = {
  features: Features
  futureReturnBps: number
}

export type AssessmentModel = {
  weights: number[]
  bias: number
  featureNames: string[]
  mean: number[]
  std: number[]
}

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x))
}

function extractFeatureVector(f: Features): number[] {
  return [
    f.measurement.buyRatio,
    f.measurement.delta / 1000,
    f.measurement.totalVolume / 10000,
    f.measurement.tradeCount / 100,
    f.measurement.largestTradeSize / 1000,
    f.measurement.largeTradeRatio,
    f.measurement.absorptionStrength,
    f.measurement.volumeAtHigh / 10000,
    f.measurement.volumeAtLow / 10000,
    f.deltaMA / 1000,
    f.deltaMomentum / 100,
    f.volumeMomentum / 1000,
    f.buyRatioMA,
    f.deltaZScore,
    f.volumeZScore,
  ]
}

export const FEATURE_NAMES = [
  'buyRatio',
  'delta',
  'totalVolume',
  'tradeCount',
  'largestTradeSize',
  'largeTradeRatio',
  'absorptionStrength',
  'volumeAtHigh',
  'volumeAtLow',
  'deltaMA',
  'deltaMomentum',
  'volumeMomentum',
  'buyRatioMA',
  'deltaZScore',
  'volumeZScore',
]

export function normalizeFeatures(
  samples: TrainingSample[],
): { mean: number[]; std: number[] } {
  const vectors = samples.map(s => extractFeatureVector(s.features))
  const n = vectors[0].length
  const mean = new Array(n).fill(0)
  const std = new Array(n).fill(0)

  for (const v of vectors) {
    for (let i = 0; i < n; i++) mean[i] += v[i]
  }
  for (let i = 0; i < n; i++) mean[i] /= vectors.length

  for (const v of vectors) {
    for (let i = 0; i < n; i++) std[i] += (v[i] - mean[i]) ** 2
  }
  for (let i = 0; i < n; i++) std[i] = Math.sqrt(std[i] / vectors.length) || 1

  return { mean, std }
}

export function normalizeVector(
  vector: number[],
  mean: number[],
  std: number[],
): number[] {
  return vector.map((v, i) => (v - mean[i]) / std[i])
}

export function trainAssessmentEngine(
  samples: TrainingSample[],
  config: { learningRate: number; epochs: number; thresholdBps: number } = {
    learningRate: 0.01,
    epochs: 100,
    thresholdBps: 50,
  },
): AssessmentModel {
  const { mean, std } = normalizeFeatures(samples)
  const vectors = samples.map(s => normalizeVector(extractFeatureVector(s.features), mean, std))
  const labels = samples.map(s => (s.futureReturnBps > config.thresholdBps ? 1 : 0))

  const n = vectors[0].length
  const weights = new Array(n).fill(0)
  let bias = 0

  for (let epoch = 0; epoch < config.epochs; epoch++) {
    let totalLoss = 0

    for (let i = 0; i < vectors.length; i++) {
      const v = vectors[i]
      const z = v.reduce((sum, val, j) => sum + val * weights[j], bias)
      const pred = sigmoid(z)
      const error = pred - labels[i]

      for (let j = 0; j < n; j++) {
        weights[j] -= config.learningRate * error * v[j]
      }
      bias -= config.learningRate * error

      totalLoss += -labels[i] * Math.log(pred + 1e-10) - (1 - labels[i]) * Math.log(1 - pred + 1e-10)
    }

    if (epoch % 20 === 0) {
      console.log(`Epoch ${epoch}: loss=${(totalLoss / vectors.length).toFixed(4)}`)
    }
  }

  return { weights, bias, featureNames: FEATURE_NAMES, mean, std }
}

export function assessState(
  model: AssessmentModel,
  features: Features,
): StateAssessment {
  const raw = extractFeatureVector(features)
  const normalized = normalizeVector(raw, model.mean, model.std)

  const z = normalized.reduce((sum, val, i) => sum + val * model.weights[i], model.bias)
  const score = sigmoid(z)

  const direction = score > 0.5 ? 'long' : score < 0.5 ? 'short' : 'none'

  return {
    timestamp: features.timestamp,
    symbol: features.symbol,
    score,
    direction,
  }
}
