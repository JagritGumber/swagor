import "server-only";

import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { selboInstances, trades } from "@/lib/db/schema";
import type { ActiveThesis, RecentOutcome, ThesisMemory } from "./build-thesis-memory";

/**
 * Live thesis memory pulled from the trades table.
 *
 * KNOWN GAP (codex review 2026-05-19): the trades table has no columns
 * for entryReason or invalidatesIf, so live active theses come back
 * with those fields empty. The compiler prompt asks reviews to cite the
 * original invalidatesIf — for live theses today that citation can't be
 * grounded in stored data. In practice this is moot because the live
 * trader has not produced trades yet; when it does, the right fix is to
 * persist entry thesis context on `trades` (new columns or an
 * agentContext jsonb) and read them here. unrealizedPctFromEntry is
 * also 0 because we don't fetch Hyperliquid mids in this helper.
 */
export async function buildLiveThesisMemory(instanceId: string): Promise<ThesisMemory> {
  const [instance] = await db.select({ userId: selboInstances.userId })
    .from(selboInstances).where(eq(selboInstances.id, instanceId)).limit(1);
  if (!instance) return { active: [], recent: [] };

  const [openRows, closedRows] = await Promise.all([
    db.select().from(trades)
      .where(and(eq(trades.userId, instance.userId), eq(trades.status, "open"))),
    db.select().from(trades)
      .where(and(eq(trades.userId, instance.userId), eq(trades.status, "closed")))
      .orderBy(desc(trades.closedAt)).limit(5),
  ]);

  const active: ActiveThesis[] = openRows.map((t) => {
    const entryDate = t.openedAt ?? t.createdAt;
    return {
      thesisId: `${t.asset.toUpperCase()}:${entryDate.toISOString()}:${t.side}`,
      asset: t.asset.toUpperCase(), side: t.side as "long" | "short",
      entryDate: entryDate.toISOString(), entryPrice: Number(t.entryPrice ?? 0),
      sizeUsd: Number(t.amountUsd ?? 0),
      daysHeld: Math.max(0, Math.floor((Date.now() - entryDate.getTime()) / 86_400_000)),
      unrealizedPctFromEntry: 0, originalConfidence: 0,
      entryReason: "", invalidatesIf: null,
    };
  });

  const recent: RecentOutcome[] = closedRows.map((t) => ({
    asset: t.asset.toUpperCase(), side: t.side as "long" | "short",
    pnlPct: t.pnlUsd && Number(t.amountUsd) > 0 ? (Number(t.pnlUsd) / Number(t.amountUsd)) * 100 : 0,
    exitReason: t.safetyTriggerReason ?? "agent_close",
    closedAt: (t.closedAt ?? t.createdAt).toISOString(),
    thesis: "",
  }));

  return { active, recent };
}
