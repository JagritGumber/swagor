import { eq, desc, and } from 'drizzle-orm'
import { getDb } from '@/db/client.ts'
import {
  executions,
  outcomes,
  type InsertExecution,
  type InsertOutcome,
  type SelectExecution,
  type SelectOutcome,
} from '@/db/schema.ts'

// ─── Types ────────────────────────────────────────────

export type ExecutionWithOutcome = SelectExecution & {
  outcome: SelectOutcome | null
}

// ─── Create execution ─────────────────────────────────

export async function createExecution(input: {
  decisionId: string
  executedPrice: number
  executedAt: Date
  txHash?: string | null
}): Promise<SelectExecution> {
  const db = await getDb()

  const row: InsertExecution = {
    decisionId: input.decisionId,
    executedPrice: input.executedPrice,
    executedAt: input.executedAt,
    txHash: input.txHash ?? null,
    status: 'filled',
  }

  const [inserted] = await db
    .insert(executions)
    .values(row)
    .returning()

  return inserted!
}

// ─── Close execution with outcome ─────────────────────

export async function closeExecution(input: {
  executionId: string
  status: 'win' | 'loss' | 'breakeven' | 'invalidated' | 'expired'
  exitPrice: number
  pnl: number
  closedAt: Date
}): Promise<SelectOutcome> {
  const db = await getDb()

  // Mark execution as completed
  await db
    .update(executions)
    .set({ status: 'filled' })
    .where(eq(executions.id, input.executionId))

  const row: InsertOutcome = {
    executionId: input.executionId,
    status: input.status,
    exitPrice: input.exitPrice,
    pnl: input.pnl,
    closedAt: input.closedAt,
  }

  const [inserted] = await db
    .insert(outcomes)
    .values(row)
    .returning()

  return inserted!
}

// ─── Read ─────────────────────────────────────────────

export async function getExecutionWithOutcome(
  executionId: string,
): Promise<ExecutionWithOutcome | null> {
  const db = await getDb()

  const [exec] = await db
    .select()
    .from(executions)
    .where(eq(executions.id, executionId))
    .limit(1)

  if (!exec) return null

  const [out] = await db
    .select()
    .from(outcomes)
    .where(eq(outcomes.executionId, executionId))
    .limit(1)

  return { ...exec, outcome: out ?? null }
}

export async function getExecutionsForDecision(
  decisionId: string,
): Promise<ExecutionWithOutcome[]> {
  const db = await getDb()

  const rows = await db
    .select()
    .from(executions)
    .where(eq(executions.decisionId, decisionId))

  const result: ExecutionWithOutcome[] = []
  for (const exec of rows) {
    const [out] = await db
      .select()
      .from(outcomes)
      .where(eq(outcomes.executionId, exec.id))
      .limit(1)
    result.push({ ...exec, outcome: out ?? null })
  }

  return result
}

export async function getOpenExecutions(): Promise<ExecutionWithOutcome[]> {
  const db = await getDb()

  const rows = await db
    .select()
    .from(executions)
    .where(eq(executions.status, 'pending'))

  const result: ExecutionWithOutcome[] = []
  for (const exec of rows) {
    const [out] = await db
      .select()
      .from(outcomes)
      .where(eq(outcomes.executionId, exec.id))
      .limit(1)
    result.push({ ...exec, outcome: out ?? null })
  }

  return result
}

export async function getExecutionHistory(
  limit = 50,
): Promise<ExecutionWithOutcome[]> {
  const db = await getDb()

  const rows = await db
    .select()
    .from(executions)
    .orderBy(desc(executions.executedAt))
    .limit(limit)

  const result: ExecutionWithOutcome[] = []
  for (const exec of rows) {
    const [out] = await db
      .select()
      .from(outcomes)
      .where(eq(outcomes.executionId, exec.id))
      .limit(1)
    result.push({ ...exec, outcome: out ?? null })
  }

  return result
}
