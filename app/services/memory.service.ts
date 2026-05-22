import "server-only";

import { db } from "@/lib/db/client";
import { memoryEntries, type Trade } from "@/lib/db/schema";
import { and, desc, eq, isNull, or, ne } from "drizzle-orm";
import { extractTradeLessons } from "./memory-lessons";

function classifyOutcome(pnlPct: number | null): "win" | "loss" | "breakeven" {
  if (pnlPct === null || Math.abs(pnlPct) < 0.5) return "breakeven";
  return pnlPct > 0 ? "win" : "loss";
}

/**
 * Insert a memory entry for a closed trade. The shared LIGHT-model keeper
 * extracts 1-3 lessons from the trade's thesis + outcome. Non-fatal: errors
 * are logged and swallowed so a memory failure cannot break the settle path.
 */
export async function recordTradeMemory(trade: Trade): Promise<void> {
  if (trade.status !== "closed") return;
  const entry = trade.entryPrice ? Number(trade.entryPrice) : null;
  const exit = trade.exitPrice ? Number(trade.exitPrice) : null;
  const pnlUsd = trade.pnlUsd ? Number(trade.pnlUsd) : null;
  const amount = Number(trade.amountUsd);
  const pnlPct = pnlUsd !== null && amount > 0 ? (pnlUsd / amount) * 100 : null;
  const dr = (trade.decisionReport ?? {}) as Record<string, unknown>;

  try {
    const parsed = await extractTradeLessons({
      asset: trade.asset, side: trade.side, sizeUsd: amount,
      entryPrice: entry, exitPrice: exit, pnlUsd, pnlPct,
      entryReason: typeof dr.reason === "string" ? dr.reason : null,
      setupType: typeof dr.marketTrigger === "string" ? dr.marketTrigger : null,
      exitReason: trade.safetyTriggerReason ?? null,
    });

    await db.insert(memoryEntries).values({
      userId: trade.userId,
      tradeId: trade.id,
      outcome: parsed.outcome ?? classifyOutcome(pnlPct),
      pnlPct: pnlPct !== null ? pnlPct.toString() : null,
      lessons: parsed.lessons,
    });
  } catch (err) {
    console.error("[memory] recordTradeMemory failed for trade", trade.id, err);
  }
}

/**
 * Most recent lessons for a user, newest first. Returned as flat strings
 * so callers can drop them straight into a prompt. Empty array when no
 * memory has been recorded yet.
 */
export async function getRecentLessons(userId: string, limit = 8): Promise<string[]> {
  // Exclude bad-rated and soft-deleted entries so user corrections take
  // effect on the very next agent context read.
  const rows = await db
    .select({ lessons: memoryEntries.lessons })
    .from(memoryEntries)
    .where(and(
      eq(memoryEntries.userId, userId),
      isNull(memoryEntries.deletedAt),
      or(isNull(memoryEntries.userFeedback), ne(memoryEntries.userFeedback, "bad")),
    ))
    .orderBy(desc(memoryEntries.createdAt))
    .limit(limit);
  return rows.flatMap((r) => r.lessons ?? []);
}
