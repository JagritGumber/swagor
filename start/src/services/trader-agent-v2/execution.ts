export type ExitConfig = {
  trailingStopActivationR: number
  trailingStopDistanceR: number
  timeExitCandles: number
}

export type Position = {
  id: string
  side: 'long' | 'short'
  entryPrice: number
  entryTime: number
  stopPrice: number
  targetPrice: number
  size: number
  riskAmount: number
  highestFavorableR: number
  candlesInTrade: number
  trailingStopActive: boolean
  trailingStopPrice: number | null
}

export type ExitDecision = {
  shouldExit: boolean
  reason?: string
  exitPrice?: number
  exitType?: 'stop-hit' | 'target-hit' | 'trailing-stop' | 'time-exit' | 'adverse-state'
}

const DEFAULT_EXIT_CONFIG: ExitConfig = {
  trailingStopActivationR: 1.5,
  trailingStopDistanceR: 0.5,
  timeExitCandles: 12,
}

export function createPosition(
  id: string,
  side: 'long' | 'short',
  entryPrice: number,
  entryTime: number,
  stopPrice: number,
  targetPrice: number,
  size: number,
  riskAmount: number,
): Position {
  return {
    id,
    side,
    entryPrice,
    entryTime,
    stopPrice,
    targetPrice,
    size,
    riskAmount,
    highestFavorableR: 0,
    candlesInTrade: 0,
    trailingStopActive: false,
    trailingStopPrice: null,
  }
}

export function evaluateExit(
  position: Position,
  currentPrice: number,
  high: number,
  low: number,
  config: ExitConfig = DEFAULT_EXIT_CONFIG,
): ExitDecision {
  const risk = Math.abs(position.entryPrice - position.stopPrice)
  if (risk <= 0) return { shouldExit: false }

  const favorableR = position.side === 'long'
    ? (currentPrice - position.entryPrice) / risk
    : (position.entryPrice - currentPrice) / risk

  const newHighestFavorable = Math.max(position.highestFavorableR, favorableR)
  const newCandlesInTrade = position.candlesInTrade + 1

  // Check stop hit
  if (position.side === 'long' && low <= position.stopPrice) {
    return { shouldExit: true, reason: 'Stop hit', exitPrice: position.stopPrice, exitType: 'stop-hit' }
  }
  if (position.side === 'short' && high >= position.stopPrice) {
    return { shouldExit: true, reason: 'Stop hit', exitPrice: position.stopPrice, exitType: 'stop-hit' }
  }

  // Check target hit
  if (position.side === 'long' && high >= position.targetPrice) {
    return { shouldExit: true, reason: 'Target hit', exitPrice: position.targetPrice, exitType: 'target-hit' }
  }
  if (position.side === 'short' && low <= position.targetPrice) {
    return { shouldExit: true, reason: 'Target hit', exitPrice: position.targetPrice, exitType: 'target-hit' }
  }

  // Check trailing stop
  if (position.trailingStopActive && position.trailingStopPrice !== null) {
    if (position.side === 'long' && low <= position.trailingStopPrice) {
      return { shouldExit: true, reason: 'Trailing stop hit', exitPrice: position.trailingStopPrice, exitType: 'trailing-stop' }
    }
    if (position.side === 'short' && high >= position.trailingStopPrice) {
      return { shouldExit: true, reason: 'Trailing stop hit', exitPrice: position.trailingStopPrice, exitType: 'trailing-stop' }
    }
  }

  // Activate trailing stop
  if (!position.trailingStopActive && newHighestFavorable >= config.trailingStopActivationR) {
    position.trailingStopActive = true
    const trailingDistance = risk * config.trailingStopDistanceR
    position.trailingStopPrice = position.side === 'long'
      ? currentPrice - trailingDistance
      : currentPrice + trailingDistance
  }

  // Update trailing stop
  if (position.trailingStopActive && newHighestFavorable > position.highestFavorableR) {
    const trailingDistance = risk * config.trailingStopDistanceR
    position.trailingStopPrice = position.side === 'long'
      ? currentPrice - trailingDistance
      : currentPrice + trailingDistance
  }

  // Time exit
  if (newCandlesInTrade >= config.timeExitCandles) {
    return { shouldExit: true, reason: `Time exit after ${newCandlesInTrade} candles`, exitPrice: currentPrice, exitType: 'time-exit' }
  }

  position.highestFavorableR = newHighestFavorable
  position.candlesInTrade = newCandlesInTrade

  return { shouldExit: false }
}
