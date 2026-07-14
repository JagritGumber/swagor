import type { Features } from './feature-engineering'
import type { TrainingSample } from './state-assessment'

export type TrainingConfig = {
  futureWindowCount: number
  thresholdBps: number
}

const DEFAULT_TRAINING_CONFIG: TrainingConfig = {
  futureWindowCount: 4,
  thresholdBps: 50,
}

export function createTrainingSamples(
  features: Features[],
  config: TrainingConfig = DEFAULT_TRAINING_CONFIG,
): TrainingSample[] {
  const samples: TrainingSample[] = []

  for (let i = 0; i < features.length - config.futureWindowCount; i++) {
    const current = features[i]
    const future = features[i + config.futureWindowCount]

    const futureReturnBps = (future.measurement.close - current.measurement.close) / current.measurement.close * 10000

    samples.push({
      features: current,
      futureReturnBps,
    })
  }

  return samples
}

export function splitTrainingData(
  samples: TrainingSample[],
  trainRatio: number = 0.7,
): { train: TrainingSample[]; test: TrainingSample[] } {
  const splitIdx = Math.floor(samples.length * trainRatio)
  return {
    train: samples.slice(0, splitIdx),
    test: samples.slice(splitIdx),
  }
}
