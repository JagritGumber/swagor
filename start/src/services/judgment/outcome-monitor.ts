import { getActiveExecutions, updateExecutionStatus } from './execution-service'
import { createOutcome, getOutcomeByExecutionId } from './outcome-service'
import { loadCandlesForAsset } from '@/services/judgment/candle-loader.ts'
import { createExitState, evaluateExit, type ExitConfig } from './exit-manager'

const EXIT_CONFIG: ExitConfig = {
  trailingStopActivationR: 1.5,
  trailingStopDistanceR: 0.5,
  timeExitCandles: 12,
  regimeShiftExits: true,
}

type ExitStateMap = Map<string, ReturnType<typeof createExitState>>

export async function evaluateOpenExecutions(): Promise<{
  evaluated: number
  closed: number
  outcomes: Array<{ executionId: string; status: string; pnl: number | null; exitType?: string }>
}> {
  const active = await getActiveExecutions()
  const outcomes: Array<{ executionId: string; status: string; pnl: number | null; exitType?: string }> = []
  let closed = 0

  const assetCandles = new Map<string, Array<{ t: number; c: number; h: number; l: number }>>()

  for (const execution of active) {
    const existingOutcome = await getOutcomeByExecutionId(execution.id)
    if (existingOutcome) continue

    const asset = execution.decision.asset
    if (!assetCandles.has(asset)) {
      const candles = await loadCandlesForAsset(asset, 10, '1h')
      assetCandles.set(asset, candles)
    }
    const candles = assetCandles.get(asset) ?? []
    if (candles.length === 0) continue

    const lastCandle = candles[candles.length - 1]
    const currentPrice = lastCandle.c
    const high = lastCandle.h
    const low = lastCandle.l

    const action = execution.decision.action
    const stop = execution.decision.stop
    const target = execution.decision.target

    if (action === 'no_trade' || stop === null || target === null) continue

    // Create exit state for this execution
    const exitState = createExitState(
      execution.id,
      execution.decision.entry ?? execution.executedPrice,
      stop,
      action as 'long' | 'short',
      null,
    )

    const exitDecision = evaluateExit(
      exitState,
      currentPrice,
      high,
      low,
      null,
      EXIT_CONFIG,
    )

    if (!exitDecision.shouldExit || exitDecision.exitPrice === undefined || exitDecision.exitType === undefined) continue

    const outcomeStatus = exitDecision.exitType === 'target-hit' ? 'win' as const : 'loss' as const

    await createOutcome({
      executionId: execution.id,
      status: outcomeStatus,
      exitPrice: exitDecision.exitPrice,
    })

    await updateExecutionStatus(execution.id, 'filled')

    closed++
    const outcome = await getOutcomeByExecutionId(execution.id)
    outcomes.push({
      executionId: execution.id,
      status: outcomeStatus,
      pnl: outcome?.pnl ?? null,
      exitType: exitDecision.exitType,
    })
  }

  return { evaluated: active.length, closed, outcomes }
}
