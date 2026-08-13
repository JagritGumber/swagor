import { eq, and, desc } from 'drizzle-orm'
import { getDb } from '@/db/client.ts'
import {
  executions,
  decisions,
  outcomes,
  type SelectExecution,
} from '@/db/schema.ts'
import { createExitState, evaluateExit, type ExitConfig, type ExitState } from './exit-manager'
import { createOutcome } from './outcome-service'
import { updateExecutionStatus } from './execution-service'

export type OpenPosition = {
  execution: SelectExecution
  decision: {
    asset: string
    action: string
    entry: number | null
    stop: number | null
    target: number | null
  }
  exitState: ExitState
}

const activePositions = new Map<string, OpenPosition>()

export async function loadOpenPositions(): Promise<OpenPosition[]> {
  const db = await getDb()

  const rows = await db
    .select({
      execution: executions,
      decision: {
        asset: decisions.asset,
        action: decisions.action,
        entry: decisions.entry,
        stop: decisions.stop,
        target: decisions.target,
      },
    })
    .from(executions)
    .innerJoin(decisions, eq(executions.decisionId, decisions.id))
    .where(eq(executions.status, 'pending'))
    .orderBy(desc(executions.executedAt))

  const positions: OpenPosition[] = []
  for (const row of rows) {
    let exitState = activePositions.get(row.execution.id)?.exitState
    if (!exitState) {
      exitState = createExitState(
        row.execution.id,
        row.decision.entry ?? row.execution.executedPrice,
        row.decision.stop ?? 0,
        row.decision.action as 'long' | 'short',
        null,
      )
      activePositions.set(row.execution.id, {
        execution: row.execution,
        decision: row.decision,
        exitState,
      })
    }
    positions.push({
      execution: row.execution,
      decision: row.decision,
      exitState,
    })
  }

  // Remove positions that are no longer active
  for (const [id] of activePositions) {
    if (!positions.find(p => p.execution.id === id)) {
      activePositions.delete(id)
    }
  }

  return positions
}

export async function processExitDecisions(
  positions: OpenPosition[],
  priceData: Map<string, { price: number; high: number; low: number; read: any }>,
  config?: ExitConfig,
): Promise<Array<{
  executionId: string
  shouldExit: boolean
  reason?: string
  exitPrice?: number
  exitType?: string
}>> {
  const results: Array<{
    executionId: string
    shouldExit: boolean
    reason?: string
    exitPrice?: number
    exitType?: string
  }> = []

  for (const position of positions) {
    const prices = priceData.get(position.decision.asset)
    if (!prices) continue

    const exitDecision = evaluateExit(
      position.exitState,
      prices.price,
      prices.high,
      prices.low,
      prices.read,
      config,
    )

    // Update in-memory state
    Object.assign(position.exitState, exitDecision.updatedState)
    activePositions.set(position.execution.id, position)

    if (exitDecision.shouldExit && exitDecision.exitPrice !== undefined && exitDecision.exitType !== undefined) {
      await createOutcome({
        executionId: position.execution.id,
        status: exitDecision.exitType === 'target-hit' ? 'win' : 'loss',
        exitPrice: exitDecision.exitPrice,
      })

      await updateExecutionStatus(position.execution.id, 'filled')
      activePositions.delete(position.execution.id)

      results.push({
        executionId: position.execution.id,
        shouldExit: true,
        reason: exitDecision.reason,
        exitPrice: exitDecision.exitPrice,
        exitType: exitDecision.exitType,
      })
    } else {
      results.push({
        executionId: position.execution.id,
        shouldExit: false,
      })
    }
  }

  return results
}

export function getActivePositionCount(): number {
  return activePositions.size
}

export function getOpenPositionRisk(): number {
  let totalRisk = 0
  for (const [, position] of activePositions) {
    const entry = position.decision.entry ?? position.execution.executedPrice
    const stop = position.decision.stop
    if (stop === null) continue

    const side = position.decision.action as 'long' | 'short'
    const riskPerUnit = side === 'long' ? entry - stop : stop - entry
    if (riskPerUnit > 0) {
      totalRisk += riskPerUnit
    }
  }
  return totalRisk
}
