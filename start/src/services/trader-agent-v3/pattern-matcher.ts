export type PatternMatch = {
  score: number
  direction: 'long' | 'short' | 'none'
  expectedReturnBps: number
  similarCount: number
}

export type StoredPattern = {
  vector: number[]
  outcome: number // future return in bps
  timestamp: number
}

export type PatternMatcherConfig = {
  kNeighbors: number
  maxMemorySize: number
  similarityThreshold: number
}

const DEFAULT_CONFIG: PatternMatcherConfig = {
  kNeighbors: 5,
  maxMemorySize: 100_000,
  similarityThreshold: 0.5,
}

function euclideanDistance(a: number[], b: number[]): number {
  let sum = 0
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i]
    sum += diff * diff
  }
  return Math.sqrt(sum)
}

function normalizeVector(vector: number[], mean: number[], std: number[]): number[] {
  return vector.map((v, i) => std[i] > 0 ? (v - mean[i]) / std[i] : 0)
}

export class LifelongPatternMatcher {
  private memory: StoredPattern[] = []
  private config: PatternMatcherConfig
  private mean: number[] = []
  private std: number[] = []
  private vectorLength: number = 0

  constructor(config: PatternMatcherConfig = DEFAULT_CONFIG) {
    this.config = config
  }

  addPattern(vector: number[], outcome: number, timestamp: number): void {
    this.memory.push({ vector, outcome, timestamp })

    // Trim if over max size (keep most recent)
    if (this.memory.length > this.config.maxMemorySize) {
      this.memory = this.memory.slice(-this.config.maxMemorySize)
    }

    // Update normalization stats
    this.updateStats()
  }

  private updateStats(): void {
    if (this.memory.length === 0) return

    this.vectorLength = this.memory[0].vector.length
    this.mean = new Array(this.vectorLength).fill(0)
    this.std = new Array(this.vectorLength).fill(0)

    for (const p of this.memory) {
      for (let i = 0; i < this.vectorLength; i++) {
        this.mean[i] += p.vector[i]
      }
    }
    for (let i = 0; i < this.vectorLength; i++) {
      this.mean[i] /= this.memory.length
    }

    for (const p of this.memory) {
      for (let i = 0; i < this.vectorLength; i++) {
        this.std[i] += (p.vector[i] - this.mean[i]) ** 2
      }
    }
    for (let i = 0; i < this.vectorLength; i++) {
      this.std[i] = Math.sqrt(this.std[i] / this.memory.length) || 1
    }
  }

  match(vector: number[]): PatternMatch {
    if (this.memory.length < this.config.kNeighbors) {
      return { score: 0.5, direction: 'none', expectedReturnBps: 0, similarCount: 0 }
    }

    const normalizedQuery = normalizeVector(vector, this.mean, this.std)

    // Find K nearest neighbors
    const distances: Array<{ distance: number; outcome: number }> = []
    for (const pattern of this.memory) {
      const normalizedPattern = normalizeVector(pattern.vector, this.mean, this.std)
      const distance = euclideanDistance(normalizedQuery, normalizedPattern)
      distances.push({ distance, outcome: pattern.outcome })
    }

    distances.sort((a, b) => a.distance - b.distance)
    const neighbors = distances.slice(0, this.config.kNeighbors)

    // Weight by inverse distance
    let weightedSum = 0
    let weightSum = 0
    for (const neighbor of neighbors) {
      const weight = 1 / (neighbor.distance + 0.001)
      weightedSum += neighbor.outcome * weight
      weightSum += weight
    }

    const expectedReturnBps = weightSum > 0 ? weightedSum / weightSum : 0
    const score = Math.min(1, Math.max(0, 0.5 + expectedReturnBps / 100))
    const direction = expectedReturnBps > 5 ? 'long' : expectedReturnBps < -5 ? 'short' : 'none'

    return {
      score,
      direction,
      expectedReturnBps,
      similarCount: neighbors.length,
    }
  }

  getMemorySize(): number {
    return this.memory.length
  }

  getMemory(): StoredPattern[] {
    return this.memory
  }
}
