import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { backtestRuns, backtestTrades, selboInstances, trades } from "@/lib/db/schema";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : undefined;
}
const DELETE = process.argv.includes("--delete");

/**
 * Inspect (and with --delete, clean up) a flagship instance's backtest data:
 * keeps only the newest backtest_run, deletes the rest + their trades. Reports
 * the live-trades table too (the chart markers come from there, not backtests).
 * Run (prod): NODE_ENV=production bun --conditions react-server scripts/flagship-cleanup.ts --instance flagship [--delete]
 */
async function main(): Promise<void> {
  const username = arg("instance") ?? "flagship";
  const [inst] = await db.select({ id: selboInstances.id, userId: selboInstances.userId })
    .from(selboInstances).where(eq(selboInstances.username, username)).limit(1);
  if (!inst) throw new Error(`no instance "${username}"`);

  const runs = await db.select({ id: backtestRuns.id, createdAt: backtestRuns.createdAt, days: backtestRuns.days, status: backtestRuns.status })
    .from(backtestRuns).where(eq(backtestRuns.selboInstanceId, inst.id)).orderBy(desc(backtestRuns.createdAt));
  console.log(`[cleanup] ${username}: ${runs.length} backtest run(s)`);
  for (const r of runs) console.log(`  ${r.id} | ${r.createdAt.toISOString()} | ${r.days}d | ${r.status}`);

  const live = await db.select({ status: trades.status }).from(trades).where(eq(trades.userId, inst.userId));
  const liveByStatus = live.reduce<Record<string, number>>((a, t) => { a[t.status] = (a[t.status] ?? 0) + 1; return a; }, {});
  console.log(`[cleanup] live trades (chart markers): ${live.length}`, liveByStatus);

  const stale = runs.slice(1).map((r) => r.id);
  if (stale.length === 0) { console.log("[cleanup] only one run; nothing stale."); }
  else if (!DELETE) { console.log(`[cleanup] ${stale.length} stale run(s) would be deleted. Re-run with --delete.`); }
  else {
    const delTrades = await db.delete(backtestTrades).where(inArray(backtestTrades.backtestRunId, stale)).returning({ id: backtestTrades.id });
    await db.delete(backtestRuns).where(inArray(backtestRuns.id, stale));
    console.log(`[cleanup] deleted ${stale.length} stale run(s) + ${delTrades.length} trade(s). Kept ${runs[0]?.id}.`);
  }
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });

