import { getActiveExecutions, updateExecutionStatus } from './execution-service'
import { createOutcome, getOutcomeByExecutionId } from './outcome-service'
import { loadCandlesForAsset } from '@/services/judgment/candle-loader.ts'

export async function evaluateOpenExecutions(): Promise<{
  evaluated: number
  closed: number
  outcomes: Array<{ executionId: string; status: string; pnl: number | null }>
}> {
  const active = await getActiveExecutions()
  const outcomes: Array<{ executionId: string; status: string; pnl: number | null }> = []
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

    const side = action as 'long' | 'short'
    let hitStatus: 'stop-hit' | 'target-hit' | null = null
    let exitPrice = 0

    if (side === 'long') {
      if (low <= stop) {
        hitStatus = 'stop-hit'
        exitPrice = stop
      } else if (high >= target) {
        hitStatus = 'target-hit'
        exitPrice = target
      }
    } else {
      if (high >= stop) {
        hitStatus = 'stop-hit'
        exitPrice = stop
      } else if (low <= target) {
        hitStatus = 'target-hit'
        exitPrice = target
      }
    }

    if (hitStatus === null) continue

    const outcomeStatus = hitStatus === 'target-hit' ? 'win' as const : 'loss' as const

    await createOutcome({
      executionId: execution.id,
      status: outcomeStatus,
      exitPrice,
    })

    await updateExecutionStatus(execution.id, 'filled')

    closed++
    const outcome = await getOutcomeByExecutionId(execution.id)
    outcomes.push({
      executionId: execution.id,
      status: outcomeStatus,
      pnl: outcome?.pnl ?? null,
    })
  }

  return { evaluated: active.length, closed, outcomes }
}
