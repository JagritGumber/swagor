import { readFileSync } from "node:fs";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { backtestRuns, backtestTrades, selboInstances } from "@/lib/db/schema";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : undefined;
}

type T = {
  asset: string; side: string; entryDate: string; entryPrice: string;
  exitDate: string | null; exitPrice: string | null; sizeUsd: string;
  pnlUsd: string | null; pnlPct: string | null; biasConfidence: string;
  setupType?: string | null; exitReason?: string | null;
  decisionReport?: Record<string, unknown> | null; status?: string;
};

/**
 * Persist an ALREADY-COMPUTED agent backtest (run_result.json from
 * backtest:local) straight into the featured tables - no re-run, no LLM.
 * The trades are the real agent's decisions; this just records them so the
 * public profile features them.
 *
 * Run (prod DB): NODE_ENV=production bun --conditions react-server scripts/backtest-import.ts --instance flagship --file run_result.json
 */
async function main(): Promise<void> {
  const username = arg("instance");
  const file = arg("file");
  if (!username || !file) {
    console.error("usage: --instance <username> --file <run_result.json>");
    process.exit(1);
  }
  const data = JSON.parse(readFileSync(file, "utf8")) as { run: { startDate: string; endDate: string; days: number; plannerPromptVersion?: string }; trades: T[] };

  const [instance] = await db.select({ id: selboInstances.id, userId: selboInstances.userId })
    .from(selboInstances).where(eq(selboInstances.username, username)).limit(1);
  if (!instance) throw new Error(`no Selbo instance with username "${username}"`);

  const [run] = await db.insert(backtestRuns).values({
    userId: instance.userId, selboInstanceId: instance.id,
    startDate: data.run.startDate, endDate: data.run.endDate, days: data.run.days,
    status: "completed", cyclesRequested: data.run.days, cyclesCompleted: data.run.days,
    completedAt: new Date(), plannerPromptVersion: data.run.plannerPromptVersion ?? "agent_v1",
  }).returning({ id: backtestRuns.id });
  if (!run) throw new Error("backtest_runs insert returned no row");

  for (const t of data.trades) {
    await db.insert(backtestTrades).values({
      backtestRunId: run.id, asset: t.asset, side: t.side === "long" ? "long" : "short",
      entryDate: new Date(t.entryDate), entryPrice: t.entryPrice,
      exitDate: t.exitDate ? new Date(t.exitDate) : null, exitPrice: t.exitPrice,
      sizeUsd: t.sizeUsd, pnlUsd: t.pnlUsd, pnlPct: t.pnlPct,
      biasConfidence: t.biasConfidence, capitalGate: "ALLOW_PAPER",
      setupType: t.setupType ?? null, exitReason: t.exitReason ?? null,
      decisionReport: t.decisionReport ?? null, status: t.status ?? "closed",
    });
  }
  console.log(`[import] run ${run.id}: ${data.trades.length} trades imported for ${username} (${data.run.startDate}->${data.run.endDate}). Now featured.`);
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });


