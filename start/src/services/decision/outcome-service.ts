import { eq } from 'drizzle-orm'
import { getDb } from '@/db/client.ts'
import {
  outcomes,
  executions,
  decisions,
  type InsertOutcome,
  type SelectOutcome,
} from '@/db/schema.ts'

export type CreateOutcomeInput = {
  executionId: string
  status: SelectOutcome['status']
  exitPrice: number
  closedAt?: Date
}

export async function createOutcome(input: CreateOutcomeInput): Promise<SelectOutcome> {
  const db = await getDb()

  const pnl = await computePnl(input.executionId, input.exitPrice)

  const row: InsertOutcome = {
    executionId: input.executionId,
    status: input.status,
    exitPrice: input.exitPrice,
    pnl,
    closedAt: input.closedAt ?? new Date(),
  }

  const [inserted] = await db
    .insert(outcomes)
    .values(row)
    .returning()

  return inserted
}

export async function getOutcomeByExecutionId(executionId: string): Promise<SelectOutcome | null> {
  const db = await getDb()

  const [row] = await db
    .select()
    .from(outcomes)
    .where(eq(outcomes.executionId, executionId))
    .limit(1)

  return row ?? null
}

async function computePnl(executionId: string, exitPrice: number): Promise<number | null> {
  const db = await getDb()

  const [row] = await db
    .select({
      executedPrice: executions.executedPrice,
      action: decisions.action,
      entry: decisions.entry,
      stop: decisions.stop,
    })
    .from(executions)
    .innerJoin(decisions, eq(executions.decisionId, decisions.id))
    .where(eq(executions.id, executionId))
    .limit(1)

  if (!row) return null

  const entryPrice = row.executedPrice
  const side = row.action === 'long' ? 'long' : row.action === 'short' ? 'short' : null
  if (!side) return null

  const stop = row.stop
  if (stop === null || stop === undefined || stop === entryPrice) return null

  const risk = side === 'long'
    ? entryPrice - stop
    : stop - entryPrice

  if (risk <= 0) return null

  const move = side === 'long'
    ? exitPrice - entryPrice
    : entryPrice - exitPrice

  return Math.round((move / risk) * 100) / 100
}
