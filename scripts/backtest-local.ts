import { writeFileSync } from "node:fs";
import { fetchCandlesPaginated } from "@/lib/data-sources/hyperliquid-candles";
import type { Candle } from "@/lib/data-sources/hyperliquid";
import { closeAllAtEnd, closeRealizedPnl, type CloseSink, STARTING_EQUITY_USD } from "@/app/services/backtest/simulate-helpers";
import { stepWatcherTick, type ReplayCtx } from "@/app/services/backtest/watcher-tick-step";
import { summarizeBacktestTrades } from "@/app/services/backtest/summarize-trades";

const HOUR_MS = 3_600_000;

function arg(name: string, def?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}

/**
 * Local, no-deploy, no-DB backtest harness. Runs the EXACT same
 * deterministic watcher engine (stepWatcherTick) the app uses, but with
 * an in-memory close-sink instead of the DB writer, and writes a
 * run_result.json byte-compatible with the deployed run shape.
 *
 * Run: bun run backtest:local -- --start 2026-04-20 --end 2026-05-19 [--assets BTC,ETH,SOL] [--out run_result.json]
 * (the backtest:local script passes --conditions react-server, which
 * no-ops `server-only` so the engine modules import in a plain runtime.)
 */
async function main(): Promise<void> {
  const start = arg("start");
  const end = arg("end");
  if (!start || !end) {
    console.error("usage: --start YYYY-MM-DD --end YYYY-MM-DD [--assets BTC,ETH,SOL] [--out run_result.json]");
    process.exit(1);
  }
  const assets = (arg("assets") ?? "BTC,ETH,SOL").split(",").map((a) => a.trim().toUpperCase());
  const out = arg("out") ?? "run_result.json";
  const strategy = arg("strategy") ?? "Trade BTC, ETH and SOL perps. Buy strong dips that reclaim value, short clear rejections at value highs. Be decisive on clean setups, cut losers fast, no more than 3x leverage.";
  const startMs = Date.parse(`${start}T00:00:00Z`);
  const endMs = Date.parse(`${end}T23:00:00Z`);
  const days = Math.round((endMs - startMs) / 86_400_000) + 1;

  const candleCache = new Map<string, Candle[]>();
  for (const a of assets) {
    candleCache.set(a, await fetchCandlesPaginated(a, "1h", startMs - 7 * 86_400_000, endMs + 86_400_000));
  }

  const trades: Record<string, unknown>[] = [];
  const writeClose: CloseSink = async ({ asset, pos, exitDate, exitPrice, reason }) => {
    const pnlUsd = closeRealizedPnl(pos, exitPrice);
    const pnlPct = pos.sizeUsd > 0 ? (pnlUsd / pos.sizeUsd) * 100 : 0;
    trades.push({
      asset, side: pos.side, entryDate: pos.entryDate.toISOString(), entryPrice: String(pos.entryPrice),
      exitDate: exitDate.toISOString(), exitPrice: String(exitPrice), sizeUsd: String(pos.sizeUsd),
      pnlUsd: String(pnlUsd), pnlPct: String(pnlPct), biasConfidence: String(pos.confidence),
      setupType: pos.setupType ?? null, exitReason: reason, decisionReport: pos.watcherDecision ?? null, status: "closed",
    });
    return pnlUsd;
  };

  const ctx: ReplayCtx = {
    runId: "local", assets, candleCache, positions: new Map(), equity: STARTING_EQUITY_USD,
    opened: 0, closed: 0, currentDayMs: Number.NaN, dailyTradeCount: 0, dailyLossCount: 0,
    dailyRealizedPnlUsd: 0, cooldownUntil: {}, writeClose,
  };
  for (let t = startMs; t <= endMs; t += HOUR_MS) await stepWatcherTick(ctx, t, true);
  await closeAllAtEnd({ writeClose, positions: ctx.positions, candleCache, lastDayMs: endMs });

  const summary = summarizeBacktestTrades(trades as Array<{ pnlUsd: string | null }>);
  const result = {
    run: { id: `local-${Date.now()}`, startDate: start, endDate: end, days, status: "completed", cyclesFailed: 0, plannerPromptVersion: "local_v1" },
    trades, summary,
  };
  writeFileSync(out, JSON.stringify(result, null, 2));
  console.log(`[local] ${assets.join(",")} ${start}->${end} | ${summary.totalTrades} trades | WR ${(summary.winRate * 100).toFixed(1)}% | net $${summary.totalPnlUsd.toFixed(2)} -> ${out}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
