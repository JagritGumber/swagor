import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { backtestRuns, selboInstances } from "@/lib/db/schema";
import { fetchCandlesPaginated } from "@/lib/data-sources/hyperliquid-candles";
import type { Candle } from "@/lib/data-sources/hyperliquid";
import { closeAllAtEnd, writeBacktestClose, STARTING_EQUITY_USD, type CloseSink } from "@/app/services/backtest/simulate-helpers";
import { stepWatcherTick, type ReplayCtx } from "@/app/services/backtest/watcher-tick-step";
import { createBacktestRun } from "@/app/services/backtest/run-backtest.service";
import { createInMemoryStore } from "@/app/services/setup-fingerprint/in-memory";

const HOUR_MS = 3_600_000;

function arg(name: string, def?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}

/**
 * Persist a deterministic backtest straight to the featured tables. Runs
 * the EXACT engine the local harness uses (stepWatcherTick, all hours
 * enabled - no LLM plan gating), but with the DB close-sink so a
 * backtest_runs + backtest_trades row land for the public profile to
 * feature. No swarm cycles, so a long 1h window costs zero LLM calls.
 *
 * Run (local, with DB env): bun run backtest:persist -- --instance flagship --start 2025-10-25 --end 2026-05-21 [--assets BTC,ETH,SOL]
 */
async function main(): Promise<void> {
  const username = arg("instance");
  const start = arg("start");
  const end = arg("end");
  if (!username || !start || !end) {
    console.error("usage: --instance <username> --start YYYY-MM-DD --end YYYY-MM-DD [--assets BTC,ETH,SOL]");
    process.exit(1);
  }

  const [instance] = await db.select().from(selboInstances).where(eq(selboInstances.username, username)).limit(1);
  if (!instance) throw new Error(`no Selbo instance with username "${username}"`);

  const assetsArg = arg("assets");
  const assets = (assetsArg ? assetsArg.split(",") : instance.currentlyWatching ?? ["BTC", "ETH", "SOL"]).map((a) => a.trim().toUpperCase());

  const startMs = Date.parse(`${start}T00:00:00Z`);
  const endDayMs = Date.parse(`${end}T00:00:00Z`);
  const days = Math.round((endDayMs - startMs) / 86_400_000) + 1;
  const lastTickMs = endDayMs + 23 * HOUR_MS;

  const run = await createBacktestRun(instance, days, new Date(startMs));
  console.log(`[persist] run ${run.id} | ${run.startDate} -> ${run.endDate} (${days}d) | assets ${assets.join(",")}`);

  const candleCache = new Map<string, Candle[]>();
  for (const a of assets) candleCache.set(a, await fetchCandlesPaginated(a, "1h", startMs - 7 * 86_400_000, lastTickMs + 86_400_000));

  const writeClose: CloseSink = (a) => writeBacktestClose({ runId: run.id, ...a });
  const ctx: ReplayCtx = {
    runId: run.id, assets, candleCache, positions: new Map(), equity: STARTING_EQUITY_USD,
    opened: 0, closed: 0, currentDayMs: Number.NaN, dailyTradeCount: 0, dailyLossCount: 0,
    dailyRealizedPnlUsd: 0, cooldownUntil: {}, writeClose,
    // --strategy overrides the instance's saved strategy for THIS run only
    // (does not mutate the live instance); falls back to the saved one.
    strategyText: arg("strategy") ?? instance.strategyText,
    fpStore: createInMemoryStore(),
  };
  for (let t = startMs; t <= lastTickMs; t += HOUR_MS) await stepWatcherTick(ctx, t, true);
  const tail = await closeAllAtEnd({ writeClose, positions: ctx.positions, candleCache, lastDayMs: lastTickMs });

  await db.update(backtestRuns).set({ status: "completed", cyclesCompleted: days, completedAt: new Date() }).where(eq(backtestRuns.id, run.id));
  console.log(`[persist] completed: opened ${ctx.opened}, closed ${ctx.closed + tail.closed}. /selbo/${username} now features this run.`);
}

main().catch((err) => { console.error(err); process.exit(1); });
