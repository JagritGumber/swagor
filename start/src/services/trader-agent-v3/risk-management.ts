import type { PatternMatch } from './pattern-matcher'

export type RiskConfig = {
  riskPerTradePct: number
  maxPortfolioHeatPct: number
  maxOpenPositions: number
  accountBalance: number
  minExpectedReturnBps: number
}

export type RiskDecision = {
  action: 'enter' | 'skip'
  side: 'long' | 'short' | null
  size: number
  riskAmount: number
  entryPrice: number | null
  stopPrice: number | null
  targetPrice: number | null
}

export function evaluateRisk(
  match: PatternMatch,
  currentPrice: number,
  openRisk: number,
  openPositionCount: number,
  config: RiskConfig,
): RiskDecision {
  if (match.direction === 'none') {
    return { action: 'skip', side: null, size: 0, riskAmount: 0, entryPrice: null, stopPrice: null, targetPrice: null }
  }

  if (match.expectedReturnBps < config.minExpectedReturnBps) {
    return { action: 'skip', side: null, size: 0, riskAmount: 0, entryPrice: null, stopPrice: null, targetPrice: null }
  }

  if (openPositionCount >= config.maxOpenPositions) {
    return { action: 'skip', side: null, size: 0, riskAmount: 0, entryPrice: null, stopPrice: null, targetPrice: null }
  }

  const currentHeatPct = (openRisk / config.accountBalance) * 100
  if (currentHeatPct >= config.maxPortfolioHeatPct) {
    return { action: 'skip', side: null, size: 0, riskAmount: 0, entryPrice: null, stopPrice: null, targetPrice: null }
  }

  const side = match.direction
  const riskAmount = config.accountBalance * (config.riskPerTradePct / 100)
  const stopDistance = currentPrice * 0.005 // 0.5% stop
  const stopPrice = side === 'long' ? currentPrice - stopDistance : currentPrice + stopDistance
  const targetPrice = side === 'long' ? currentPrice + stopDistance * 2 : currentPrice - stopDistance * 2
  const size = Math.floor(riskAmount / stopDistance)

  if (size <= 0) {
    return { action: 'skip', side: null, size: 0, riskAmount: 0, entryPrice: null, stopPrice: null, targetPrice: null }
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
