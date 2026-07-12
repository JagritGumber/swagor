import { eq, and, desc } from 'drizzle-orm'
import { getDb } from '@/db/client.ts'
import {
  executions,
  decisions,
  type InsertExecution,
  type SelectExecution,
} from '@/db/schema.ts'

export type CreateExecutionInput = {
  decisionId: string
  executedPrice: number
  status?: SelectExecution['status']
}

export async function createExecution(input: CreateExecutionInput): Promise<SelectExecution> {
  const db = await getDb()

  const row: InsertExecution = {
    decisionId: input.decisionId,
    executedPrice: input.executedPrice,
    executedAt: new Date(),
    status: input.status ?? 'pending',
  }

  const [inserted] = await db
    .insert(executions)
    .values(row)
    .returning()

  return inserted
}

export async function updateExecutionStatus(
  executionId: string,
  status: SelectExecution['status'],
  txHash?: string,
): Promise<SelectExecution | null> {
  const db = await getDb()

  const [updated] = await db
    .update(executions)
    .set({
      status,
      ...(txHash !== undefined ? { txHash } : {}),
    })
    .where(eq(executions.id, executionId))
    .returning()

  return updated ?? null
}

export async function getActiveExecutions(asset?: string): Promise<Array<SelectExecution & { decision: { asset: string; action: string; entry: number | null; stop: number | null; target: number | null } }>> {
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
    .where(
      and(
        eq(executions.status, 'pending'),
        asset !== undefined ? eq(decisions.asset, asset) : undefined,
      ),
    )
    .orderBy(desc(executions.executedAt))

  return rows.map((row) => ({
    ...row.execution,
    decision: row.decision,
  }))
}

export async function getExecutionByDecisionId(decisionId: string): Promise<SelectExecution | null> {
  const db = await getDb()

  const [row] = await db
    .select()
    .from(executions)
    .where(eq(executions.decisionId, decisionId))
    .limit(1)

  return row ?? null
}

export type ExecuteDecisionInput = {
  decisionId: string
  entryPrice: number
  agentMode: 'live' | 'paper' | 'simulation'
}

export async function executeDecision(input: ExecuteDecisionInput): Promise<SelectExecution> {
  if (input.agentMode === 'paper' || input.agentMode === 'simulation') {
    return createExecution({
      decisionId: input.decisionId,
      executedPrice: input.entryPrice,
      status: 'filled',
    })
  }

  // Live mode: would call Circle wallet API here
  // For now, create as pending - the Circle integration will update this
  return createExecution({
    decisionId: input.decisionId,
    executedPrice: input.entryPrice,
    status: 'pending',
  })
}
