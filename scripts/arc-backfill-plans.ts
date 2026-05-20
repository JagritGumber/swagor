import { db } from "@/lib/db/client";
import { dailyPlans, selboInstances } from "@/lib/db/schema";
import { and, eq, isNull, isNotNull, sql } from "drizzle-orm";
import { fireDailyPlanAnchor, pollPendingAnchors } from "@/lib/arc/anchor";

/**
 * Backfill on-chain anchors for the LIVE daily-plan track record only
 * (backtestRunId IS NULL, status complete, not yet anchored). Backtest
 * plans are simulation noise and are intentionally skipped. Fires one
 * Circle tx per plan, then polls until mined; prod's /api/watcher/tick
 * poller resolves any stragglers.
 * Run: bun --conditions react-server scripts/arc-backfill-plans.ts
 */
const rows = await db.select({
  id: dailyPlans.id, gen: dailyPlans.generatedAt, md: dailyPlans.planMarkdown, wallet: selboInstances.circleWalletId,
}).from(dailyPlans).innerJoin(selboInstances, eq(dailyPlans.selboInstanceId, selboInstances.id))
  .where(and(isNull(dailyPlans.backtestRunId), eq(dailyPlans.status, "complete"), isNull(dailyPlans.arcAnchorTx)));

console.log("backfilling", rows.length, "live plans");
for (const r of rows) {
  if (!r.wallet) { console.log("  skip", r.id.slice(0, 8), "(no wallet)"); continue; }
  await fireDailyPlanAnchor({ walletId: r.wallet, planId: r.id, generatedAt: r.gen, compiled: { markdown: r.md ?? "daily plan" }, kind: "live" });
  console.log("  anchored", r.id.slice(0, 8));
}

const remaining = async (): Promise<number> => (await db.select({ n: sql<number>`count(*)::int` }).from(dailyPlans)
  .where(and(isNull(dailyPlans.backtestRunId), isNotNull(dailyPlans.arcAnchorTx), isNull(dailyPlans.arcOnchainTxHash))))[0].n;

for (let i = 0; i < 36; i++) {
  const r = await pollPendingAnchors();
  const left = await remaining();
  console.log(`  poll t+${i * 5}s scanned=${r.scanned} resolved=${r.resolved} failed=${r.failed} | queued-left=${left}`);
  if (left === 0) { console.log("ALL LIVE PLANS MINED"); process.exit(0); }
  await new Promise((res) => setTimeout(res, 5000));
}
console.log("some still queued; prod /api/watcher/tick poller will resolve them.");
process.exit(0);
