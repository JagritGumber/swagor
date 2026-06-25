import { db } from "@/lib/db/client";
import { arcContracts, dailyPlans, trades, monitorTicks } from "@/lib/db/schema";

/**
 * Read-only Arc anchoring verification. Answers, from the DB: is the
 * PortfolioDecisions contract registered, and has anything actually
 * gone end-to-end (Circle tx created -> mined on-chain hash) vs stuck
 * queued vs failed. A real 0x hash anywhere = anchoring works.
 * Run: bun scripts/arc-verify.ts
 */
type Row = { anchor: string | null; hash: string | null };
function tally(rows: Row[]): { total: number; anchored: number; queued: number; mined: number; failed: number } {
  let anchored = 0, queued = 0, mined = 0, failed = 0;
  for (const r of rows) {
    if (!r.anchor) continue;
    anchored++;
    if (!r.hash) queued++;
    else if (r.hash.startsWith("failed:")) failed++;
    else mined++;
  }
  return { total: rows.length, anchored, queued, mined, failed };
}
function report(name: string, t: ReturnType<typeof tally>): void {
  console.log(`  ${name.padEnd(14)} rows=${String(t.total).padStart(5)}  anchored=${t.anchored}  queued=${t.queued}  mined=${t.mined}  failed=${t.failed}`);
}

const contracts = await db.select().from(arcContracts);
console.log("=== arc_contracts registry ===");
if (contracts.length === 0) console.log("  (EMPTY) - nothing can anchor; portfolio_decisions is not registered");
for (const c of contracts) console.log(`  ${c.key}: ${c.address}`);

console.log("\n=== anchor lifecycle (queued -> mined) ===");
const dp = await db.select({ anchor: dailyPlans.arcAnchorTx, hash: dailyPlans.arcOnchainTxHash }).from(dailyPlans);
report("daily_plans", tally(dp));
const tr = await db.select({ a: trades.arcAnchorTx, h: trades.arcOnchainTxHash, oa: trades.openAnchorTx, oh: trades.openOnchainTxHash }).from(trades);
report("trades.close", tally(tr.map((x) => ({ anchor: x.a, hash: x.h }))));
report("trades.open", tally(tr.map((x) => ({ anchor: x.oa, hash: x.oh }))));
const mt = await db.select({ anchor: monitorTicks.arcAnchorTx, hash: monitorTicks.arcOnchainTxHash }).from(monitorTicks);
report("monitor_ticks", tally(mt));

const allHashes = [...dp.map((r) => r.hash), ...tr.map((r) => r.h), ...tr.map((r) => r.oh), ...mt.map((r) => r.hash)];
const realMined = allHashes.find((h) => h && !h.startsWith("failed:"));
console.log("\nVERDICT:", realMined ? `anchoring works end-to-end (sample on-chain hash: ${realMined})` : "NO real on-chain hash found - anchoring has never completed end-to-end");
process.exit(0);


