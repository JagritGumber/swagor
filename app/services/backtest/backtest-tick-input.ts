import { evaluatePerpRisk } from "@/app/services/risk-engine.service";
import { buildSnapshotAt } from "./backtest-snapshot";
import { deterministicPressureSnapshot } from "./deterministic-pressure";
import type { SelboTickInput, WatcherExecutionState, SetupRecordLookup, SymbolFingerprints } from "@/app/services/watcher/selbo-tick-types";
import { computeFingerprintFromMarketState, computeAssetSideKey } from "@/app/services/setup-fingerprint";
import { getInMemoryRecordView } from "@/app/services/setup-fingerprint/in-memory";
import type { ReplayCtx } from "./watcher-tick-step";

/**
 * Build the SelboTickInput for one replay tick - the same shape the live
 * watcher feeds the agent. Backtest mirrors the live setup-fingerprint
 * lookup + symbolFingerprints map over the in-memory store on ReplayCtx;
 * agent payload shape is byte-identical to live.
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
  const symbolFingerprints: SymbolFingerprints = new Map();
  for (const s of marketFeatures.symbols) {
    symbolFingerprints.set(s.symbol, {
      long: computeFingerprintFromMarketState({ asset: s.symbol, side: "long", perp: s.perpMarketState, recentCandles: s.recentCandles }),
      short: computeFingerprintFromMarketState({ asset: s.symbol, side: "short", perp: s.perpMarketState, recentCandles: s.recentCandles }),
    });
  }
  const setupRecordLookup: SetupRecordLookup = (asset, side) => {
    const fps = symbolFingerprints.get(asset.toUpperCase());
    const fp = fps ? fps[side] : null;
    return {
      fingerprint: fp ? getInMemoryRecordView(ctx.fpStore, "fingerprint", fp) : null,
      assetSide: getInMemoryRecordView(ctx.fpStore, "asset_side", computeAssetSideKey(asset, side)),
    };
  };
  return {
    mode: "backtest", asOf: new Date(tickMs).toISOString(), strategyText: ctx.strategyText ?? "",
    externalSentiment: deterministicPressureSnapshot(marketFeatures), marketFeatures,
    positions: [...ctx.positions].map(([asset, pos]) => ({
      asset, side: pos.side, entryPrice: pos.entryPrice, markPrice: priceAt(asset),
      sizeUsd: pos.sizeUsd, openedAt: pos.entryDate.toISOString(),
    })),
    risk, setupRecordLookup, symbolFingerprints,
    executionState: {
      dailyTradeCount: ctx.dailyTradeCount, dailyLossCount: ctx.dailyLossCount,
      dailyRealizedPnlUsd: ctx.dailyRealizedPnlUsd, assetSideCooldownUntil: ctx.cooldownUntil,
    } satisfies WatcherExecutionState,
  };
}
