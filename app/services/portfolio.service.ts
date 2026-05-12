import { db } from "@/lib/db/client";
import { portfolios, rebalanceCycles, agentReasoning } from "@/lib/db/schema";
import { eq, desc, asc } from "drizzle-orm";

/**
 * Portfolio + cycle queries over Drizzle. A "portfolio" here is the binding
 * between a Supabase auth user and an Arc-compatible wallet address;
 * no balances are stored — those are read live from on-chain.
 */

export async function getPortfolioById(portfolioId: string) {
  const [p] = await db.select().from(portfolios).where(eq(portfolios.id, portfolioId)).limit(1);
  return p;
}

export async function getCycleById(cycleId: string) {
  const [c] = await db.select().from(rebalanceCycles).where(eq(rebalanceCycles.id, cycleId)).limit(1);
  return c;
}

export async function getAgentReasoningForCycle(cycleId: string) {
  return db
    .select()
    .from(agentReasoning)
    .where(eq(agentReasoning.cycleId, cycleId))
    .orderBy(asc(agentReasoning.createdAt));
}

export async function findOrCreatePortfolioForWallet(
  userId: string,
  walletAddress: string,
  mode: "paper" | "live" = "paper",
) {
  const existing = await db
    .select()
    .from(portfolios)
    .where(eq(portfolios.walletAddress, walletAddress))
    .limit(1);
  if (existing[0]) return existing[0];
  const [created] = await db
    .insert(portfolios)
    .values({ userId, walletAddress, mode })
    .returning();
  return created;
}

export async function listPortfoliosForUser(userId: string) {
  return db.select().from(portfolios).where(eq(portfolios.userId, userId));
}

export async function createCycle(portfolioId: string) {
  const [cycle] = await db
    .insert(rebalanceCycles)
    .values({ portfolioId, status: "running" })
    .returning();
  return cycle;
}

export async function listRecentCycles(portfolioId: string, limit = 20) {
  return db
    .select()
    .from(rebalanceCycles)
    .where(eq(rebalanceCycles.portfolioId, portfolioId))
    .orderBy(desc(rebalanceCycles.startedAt))
    .limit(limit);
}

export async function saveGoal(
  portfolioId: string,
  goalText: string,
  goalParsed: unknown,
) {
  const [updated] = await db
    .update(portfolios)
    .set({ goalText, goalParsed: goalParsed as object })
    .where(eq(portfolios.id, portfolioId))
    .returning();
  return updated;
}

export async function updateCycleStatus(
  cycleId: string,
  status: "running" | "approved" | "rejected" | "executed" | "failed",
  extras?: {
    ipfsCid?: string;
    arcTxHash?: string;
    cycleState?: unknown;
    completedAt?: Date;
  },
) {
  const [updated] = await db
    .update(rebalanceCycles)
    .set({ status, ...(extras as object) })
    .where(eq(rebalanceCycles.id, cycleId))
    .returning();
  return updated;
}
