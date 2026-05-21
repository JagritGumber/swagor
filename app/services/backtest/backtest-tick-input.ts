import { evaluatePerpRisk } from "@/app/services/risk-engine.service";
import { buildSnapshotAt } from "./backtest-snapshot";
import { deterministicPressureSnapshot } from "./deterministic-pressure";
import type { SelboTickInput, WatcherExecutionState } from "@/app/services/watcher/selbo-tick-types";
import type { ReplayCtx } from "./watcher-tick-step";

/**
 * Build the SelboTickInput for one replay tick - the same shape the live
 * watcher feeds the agent: historical market snapshot, risk, open positions,
 * accumulated lessons, and the day's execution counters.
 */
export function backtestTickInput(ctx: ReplayCtx, tickMs: number): SelboTickInput {
  const priceAt = (asset: string) => Number((ctx.candleCache.get(asset) ?? []).find((c) => c.t === tickMs)?.c);
  const marketFeatures = buildSnapshotAt(ctx.assets, ctx.candleCache, tickMs);
  const risk = evaluatePerpRisk({
    account: { equityUsd: ctx.equity, withdrawableUsd: ctx.equity },
    positions: [...ctx.positions].map(([asset, pos]) => {
      const price = priceAt(asset);
      return { source: "paper" as const, asset, side: pos.side, sizeUsd: pos.sizeUsd, entryPrice: pos.entryPrice, markPrice: Number.isFinite(price) ? price : null };
    }),
  });
  return {
    mode: "backtest", asOf: new Date(tickMs).toISOString(), strategyText: ctx.strategyText ?? "",
    externalSentiment: deterministicPressureSnapshot(marketFeatures), marketFeatures,
    positions: [...ctx.positions].map(([asset, pos]) => ({
      asset, side: pos.side, entryPrice: pos.entryPrice, markPrice: priceAt(asset),
      sizeUsd: pos.sizeUsd, openedAt: pos.entryDate.toISOString(),
    })),
    risk, recentLessons: ctx.recentLessons ?? [],
    executionState: {
      dailyTradeCount: ctx.dailyTradeCount, dailyLossCount: ctx.dailyLossCount,
      dailyRealizedPnlUsd: ctx.dailyRealizedPnlUsd, assetSideCooldownUntil: ctx.cooldownUntil,
    } satisfies WatcherExecutionState,
  };
}
