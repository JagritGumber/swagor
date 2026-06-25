import { db } from "@/lib/db/client";
import { dailyPlans, selboInstances } from "@/lib/db/schema";
import { and, eq, isNotNull } from "drizzle-orm";
import { fireDailyPlanAnchor, pollPendingAnchors } from "@/lib/arc/anchor";

/**
 * Fire ONE real anchor end-to-end to prove the path works: pick a
 * completed daily plan, anchor it from its owner's Circle wallet, then
 * poll until the Circle tx mines into an on-chain hash.
 * Run: bun --conditions react-server scripts/arc-anchor-one.ts
 */
const [row] = await db.select({
  id: dailyPlans.id, gen: dailyPlans.generatedAt, md: dailyPlans.planMarkdown, wallet: selboInstances.circleWalletId,
}).from(dailyPlans).innerJoin(selboInstances, eq(dailyPlans.selboInstanceId, selboInstances.id))
  .where(and(eq(dailyPlans.status, "complete"), isNotNull(selboInstances.circleWalletId))).limit(1);
if (!row?.wallet) { console.error("no anchorable completed plan with a wallet"); process.exit(1); }

console.log("anchoring plan", row.id.slice(0, 8), "from wallet", row.wallet.slice(0, 8) + "...");
await fireDailyPlanAnchor({ walletId: row.wallet, planId: row.id, generatedAt: row.gen, compiled: { markdown: row.md ?? "daily plan" }, kind: "live" });

for (let i = 0; i < 24; i++) {
  const [p] = await db.select({ a: dailyPlans.arcAnchorTx, h: dailyPlans.arcOnchainTxHash })
    .from(dailyPlans).where(eq(dailyPlans.id, row.id)).limit(1);
  console.log(`  t+${i * 5}s  anchorTx=${p?.a ? p.a.slice(0, 8) : "none"}  onchain=${p?.h ?? "pending"}`);
  if (p?.h) { console.log("MINED ON-CHAIN:", p.h); process.exit(0); }
  await pollPendingAnchors();
  await new Promise((r) => setTimeout(r, 5000));
}
console.log("anchorTx is set; mine not yet confirmed - the /api/watcher/tick poller will resolve it.");
process.exit(0);


