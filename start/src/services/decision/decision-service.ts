import { eq, desc, and } from 'drizzle-orm'
import { getDb } from '@/db/client.ts'
import {
  decisions,
  evidence,
  agents,
  type InsertDecision,
  type InsertEvidence,
  type SelectDecision,
  type SelectEvidence,
} from '@/db/schema.ts'

// ─── Types ────────────────────────────────────────────

export type DecisionWithEvidence = SelectDecision & {
  evidence: SelectEvidence[]
}

export type CreateDecisionInput = {
  agentId: string
  asset: string
  action: 'long' | 'short' | 'no_trade'
  entry?: number | null
  stop?: number | null
  target?: number | null
  invalidation?: string | null
  conviction: 'low' | 'medium' | 'high'
  thesis?: string | null
  evidence: Array<{
    category: SelectEvidence['category']
    title: string
    value: string
    stance: 'supporting' | 'contradicting'
  }>
}

// ─── Create ───────────────────────────────────────────

export async function createDecision(input: CreateDecisionInput): Promise<DecisionWithEvidence> {
  const db = await getDb()

  const decisionRow: InsertDecision = {
    agentId: input.agentId,
    action: input.action,
    asset: input.asset,
    entry: input.entry ?? null,
    stop: input.stop ?? null,
    target: input.target ?? null,
    invalidation: input.invalidation ?? null,
    conviction: input.conviction,
    thesis: input.thesis ?? null,
  }

  const [inserted] = await db
    .insert(decisions)
    .values(decisionRow)
    .returning()

  const evidenceRows: InsertEvidence[] = input.evidence.map((e) => ({
    decisionId: inserted.id,
    category: e.category,
    title: e.title,
    value: e.value,
    stance: e.stance,
  }))

  let insertedEvidence: SelectEvidence[] = []
  if (evidenceRows.length > 0) {
    insertedEvidence = await db
      .insert(evidence)
      .values(evidenceRows)
      .returning()
  }

  return { ...inserted, evidence: insertedEvidence }
}

// ─── Read ─────────────────────────────────────────────

export async function getLatestDecision(
  agentId: string,
): Promise<DecisionWithEvidence | null> {
  const db = await getDb()

  const [decision] = await db
    .select()
    .from(decisions)
    .where(eq(decisions.agentId, agentId))
    .orderBy(desc(decisions.decidedAt))
    .limit(1)

  if (!decision) return null

  const rows = await db
    .select()
    .from(evidence)
    .where(eq(evidence.decisionId, decision.id))

  return { ...decision, evidence: rows }
}

export async function getDecisionHistory(
  agentId: string,
  limit = 20,
): Promise<DecisionWithEvidence[]> {
  const db = await getDb()

  const rows = await db
    .select()
    .from(decisions)
    .where(eq(decisions.agentId, agentId))
    .orderBy(desc(decisions.decidedAt))
    .limit(limit)

  const result: DecisionWithEvidence[] = []
  for (const d of rows) {
    const ev = await db
      .select()
      .from(evidence)
      .where(eq(evidence.decisionId, d.id))
    result.push({ ...d, evidence: ev })
  }

  return result
}

// ─── Admin helpers ────────────────────────────────────

export const ADMIN_AGENT_ID = '00000000-0000-0000-0000-000000000000'

export async function ensureAdminAgentExists(): Promise<string> {
  const db = await getDb()
  const [existing] = await db
    .select()
    .from(agents)
    .where(eq(agents.id, ADMIN_AGENT_ID))
    .limit(1)

  if (existing) return ADMIN_AGENT_ID

  await db.insert(agents).values({
    id: ADMIN_AGENT_ID,
    userId: 'admin',
  })
  return ADMIN_AGENT_ID
}

export async function getLatestAdminDecision(
  asset: string,
): Promise<DecisionWithEvidence | null> {
  const db = await getDb()

  const [decision] = await db
    .select()
    .from(decisions)
    .where(
      and(
        eq(decisions.agentId, ADMIN_AGENT_ID),
        eq(decisions.asset, asset),
      ),
    )
    .orderBy(desc(decisions.decidedAt))
    .limit(1)

  if (!decision) return null

  const rows = await db
    .select()
    .from(evidence)
    .where(eq(evidence.decisionId, decision.id))

  return { ...decision, evidence: rows }
}

export async function getActiveAgents() {
  const db = await getDb()
  return db
    .select()
    .from(agents)
    .where(eq(agents.enabled, true))
}
