import type { StateAssessment } from './state-assessment'

export type RiskConfig = {
  riskPerTradePct: number
  maxPortfolioHeatPct: number
  maxOpenPositions: number
  accountBalance: number
  scoreThreshold: number
}

export type RiskDecision = {
  action: 'enter' | 'skip' | 'hold'
  side: 'long' | 'short' | null
  size: number
  riskAmount: number
  entryPrice: number | null
  stopPrice: number | null
  targetPrice: number | null
}

const DEFAULT_RISK_CONFIG: RiskConfig = {
  riskPerTradePct: 1.0,
  maxPortfolioHeatPct: 6.0,
  maxOpenPositions: 3,
  accountBalance: 100_000,
  scoreThreshold: 0.6,
}

export function evaluateRisk(
  assessment: StateAssessment,
  currentPrice: number,
  openRisk: number,
  openPositionCount: number,
  config: RiskConfig = DEFAULT_RISK_CONFIG,
): RiskDecision {
  if (assessment.score < config.scoreThreshold) {
    return {
      action: 'skip',
      side: null,
      size: 0,
      riskAmount: 0,
      entryPrice: null,
      stopPrice: null,
      targetPrice: null,
    }
  }

  if (openPositionCount >= config.maxOpenPositions) {
    return {
      action: 'skip',
      side: null,
      size: 0,
      riskAmount: 0,
      entryPrice: null,
      stopPrice: null,
      targetPrice: null,
    }
  }

  const currentHeatPct = (openRisk / config.accountBalance) * 100
  if (currentHeatPct >= config.maxPortfolioHeatPct) {
    return {
      action: 'skip',
      side: null,
      size: 0,
      riskAmount: 0,
      entryPrice: null,
      stopPrice: null,
      targetPrice: null,
    }
  }

  const side = assessment.direction
  if (side === 'none') {
    return {
      action: 'skip',
      side: null,
      size: 0,
      riskAmount: 0,
      entryPrice: null,
      stopPrice: null,
      targetPrice: null,
    }
  }

  const riskAmount = config.accountBalance * (config.riskPerTradePct / 100)
  const stopDistance = currentPrice * 0.005 // 0.5% stop
  const stopPrice = side === 'long' ? currentPrice - stopDistance : currentPrice + stopDistance
  const targetPrice = side === 'long' ? currentPrice + stopDistance * 2 : currentPrice - stopDistance * 2
  const size = Math.floor(riskAmount / stopDistance)

  if (size <= 0) {
    return {
      action: 'skip',
      side: null,
      size: 0,
      riskAmount: 0,
      entryPrice: null,
      stopPrice: null,
      targetPrice: null,
    }
  }

  return {
    action: 'enter',
    side,
    size,
    riskAmount,
    entryPrice: currentPrice,
    stopPrice,
    targetPrice,
  }
}
