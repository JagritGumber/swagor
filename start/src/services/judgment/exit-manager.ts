import type { LiveReaderRead } from '@packages/strategy-lab/reader/reader-live/types'

export type ExitConfig = {
  trailingStopActivationR: number
  trailingStopDistanceR: number
  timeExitCandles: number
  regimeShiftExits: boolean
}

export type ExitState = {
  executionId: string
  entryPrice: number
  stopPrice: number
  side: 'long' | 'short'
  highestFavorableR: number
  lowestAdverseR: number
  candlesInTrade: number
  trailingStopActive: boolean
  trailingStopPrice: number | null
  lastRegime: string | null
  enteredAt: Date
}

export type ExitDecision = {
  shouldExit: boolean
  reason?: string
  exitPrice?: number
  exitType?: 'stop-hit' | 'target-hit' | 'trailing-stop' | 'time-exit' | 'regime-shift'
  updatedState: Partial<ExitState>
}

const DEFAULT_EXIT_CONFIG: ExitConfig = {
  trailingStopActivationR: 1.5,
  trailingStopDistanceR: 0.5,
  timeExitCandles: 12,
  regimeShiftExits: true,
}

export function createExitState(
  executionId: string,
  entryPrice: number,
  stopPrice: number,
  side: 'long' | 'short',
  initialRegime: string | null,
): ExitState {
  return {
    executionId,
    entryPrice,
    stopPrice,
    side,
    highestFavorableR: 0,
    lowestAdverseR: 0,
    candlesInTrade: 0,
    trailingStopActive: false,
    trailingStopPrice: null,
    lastRegime: initialRegime,
    enteredAt: new Date(),
  }
}

export function evaluateExit(
  state: ExitState,
  currentPrice: number,
  high: number,
  low: number,
  read: LiveReaderRead | null,
  config: ExitConfig = DEFAULT_EXIT_CONFIG,
): ExitDecision {
  const risk = state.side === 'long'
    ? state.entryPrice - state.stopPrice
    : state.stopPrice - state.entryPrice

  if (risk <= 0) {
    return { shouldExit: false, updatedState: {} }
  }

  const favorableR = state.side === 'long'
    ? (currentPrice - state.entryPrice) / risk
    : (state.entryPrice - currentPrice) / risk

  const adverseR = state.side === 'long'
    ? (state.entryPrice - currentPrice) / risk
    : (currentPrice - state.entryPrice) / risk

  const newHighestFavorable = Math.max(state.highestFavorableR, favorableR)
  const newLowestAdverse = Math.min(state.lowestAdverseR, adverseR)
  const newCandlesInTrade = state.candlesInTrade + 1

  const updatedState: Partial<ExitState> = {
    highestFavorableR: newHighestFavorable,
    lowestAdverseR: newLowestAdverse,
    candlesInTrade: newCandlesInTrade,
  }

  // Check stop hit
  if (state.side === 'long' && low <= state.stopPrice) {
    return {
      shouldExit: true,
      reason: 'Stop hit',
      exitPrice: state.stopPrice,
      exitType: 'stop-hit',
      updatedState,
    }
  }
  if (state.side === 'short' && high >= state.stopPrice) {
    return {
      shouldExit: true,
      reason: 'Stop hit',
      exitPrice: state.stopPrice,
      exitType: 'stop-hit',
      updatedState,
    }
  }

  // Check trailing stop
  if (state.trailingStopActive && state.trailingStopPrice !== null) {
    if (state.side === 'long' && low <= state.trailingStopPrice) {
      return {
        shouldExit: true,
        reason: 'Trailing stop hit',
        exitPrice: state.trailingStopPrice,
        exitType: 'trailing-stop',
        updatedState,
      }
    }
    if (state.side === 'short' && high >= state.trailingStopPrice) {
      return {
        shouldExit: true,
        reason: 'Trailing stop hit',
        exitPrice: state.trailingStopPrice,
        exitType: 'trailing-stop',
        updatedState,
      }
    }
  }

  // Activate trailing stop if favorable enough
  if (!state.trailingStopActive && newHighestFavorable >= config.trailingStopActivationR) {
    updatedState.trailingStopActive = true
    const trailingDistance = risk * config.trailingStopDistanceR
    updatedState.trailingStopPrice = state.side === 'long'
      ? state.entryPrice + (newHighestFavorable - config.trailingStopDistanceR) * risk
      : state.entryPrice - (newHighestFavorable - config.trailingStopDistanceR) * risk
  }

  // Update trailing stop as price moves favorably
  if (state.trailingStopActive && newHighestFavorable > state.highestFavorableR) {
    const trailingDistance = risk * config.trailingStopDistanceR
    updatedState.trailingStopPrice = state.side === 'long'
      ? currentPrice - trailingDistance
      : currentPrice + trailingDistance
  }

  // Time-based exit
  if (newCandlesInTrade >= config.timeExitCandles) {
    return {
      shouldExit: true,
      reason: `Time exit after ${newCandlesInTrade} candles`,
      exitPrice: currentPrice,
      exitType: 'time-exit',
      updatedState,
    }
  }

  // Regime shift exit
  if (config.regimeShiftExits && read?.regime && state.lastRegime) {
    const currentRegime = read.regime.mode
    if (currentRegime !== state.lastRegime) {
      return {
        shouldExit: true,
        reason: `Regime shift: ${state.lastRegime} -> ${currentRegime}`,
        exitPrice: currentPrice,
        exitType: 'regime-shift',
        updatedState,
      }
    }
    updatedState.lastRegime = currentRegime
  }

  return { shouldExit: false, updatedState }
}
