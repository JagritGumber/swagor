export type PositionSizingConfig = {
  riskPerTradePct: number
  maxPortfolioHeatPct: number
  maxOpenPositions: number
  accountBalance: number
}

export type PositionSizingInput = {
  config: PositionSizingConfig
  entryPrice: number
  stopPrice: number
  side: 'long' | 'short'
  currentOpenRisk: number
  openPositionCount: number
}

export type PositionSizingResult = {
  size: number
  riskAmount: number
  riskPct: number
  allowed: boolean
  reason?: string
}

const DEFAULT_CONFIG: PositionSizingConfig = {
  riskPerTradePct: 1.0,
  maxPortfolioHeatPct: 6.0,
  maxOpenPositions: 3,
  accountBalance: 10_000,
}

export function sizePosition(input: PositionSizingInput): PositionSizingResult {
  const { config, entryPrice, stopPrice, side, currentOpenRisk, openPositionCount } = input

  if (openPositionCount >= config.maxOpenPositions) {
    return { size: 0, riskAmount: 0, riskPct: 0, allowed: false, reason: `Max open positions (${config.maxOpenPositions}) reached` }
  }

  const riskPerUnit = side === 'long'
    ? entryPrice - stopPrice
    : stopPrice - entryPrice

  if (riskPerUnit <= 0) {
    return { size: 0, riskAmount: 0, riskPct: 0, allowed: false, reason: 'Stop is on wrong side of entry' }
  }

  const maxRiskDollars = config.accountBalance * (config.riskPerTradePct / 100)
  const currentHeatPct = (currentOpenRisk / config.accountBalance) * 100
  const remainingHeatPct = config.maxPortfolioHeatPct - currentHeatPct

  if (remainingHeatPct <= 0) {
    return { size: 0, riskAmount: 0, riskPct: 0, allowed: false, reason: `Portfolio heat at max (${config.maxPortfolioHeatPct}%)` }
  }

  const allowedRiskDollars = Math.min(maxRiskDollars, config.accountBalance * (remainingHeatPct / 100))
  const size = Math.floor(allowedRiskDollars / riskPerUnit)
  const riskAmount = size * riskPerUnit
  const riskPct = (riskAmount / config.accountBalance) * 100

  if (size <= 0) {
    return { size: 0, riskAmount: 0, riskPct: 0, allowed: false, reason: 'Position too small for minimum risk' }
  }

  return { size, riskAmount, riskPct, allowed: true }
}

export function computeOpenRisk(
  activeExecutions: Array<{
    decision: { action: string; entry: number | null; stop: number | null }
    executedPrice: number
  }>,
): number {
  let totalRisk = 0

  for (const ex of activeExecutions) {
    if (ex.decision.action === 'no_trade') continue
    const entry = ex.decision.entry ?? ex.executedPrice
    const stop = ex.decision.stop
    if (stop === null) continue

    const side = ex.decision.action as 'long' | 'short'
    const riskPerUnit = side === 'long' ? entry - stop : stop - entry
    if (riskPerUnit > 0) {
      totalRisk += riskPerUnit
    }
  }

  return totalRisk
}
