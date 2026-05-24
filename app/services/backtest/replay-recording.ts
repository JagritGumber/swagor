import type { Candle } from "@/lib/data-sources/hyperliquid";
import type { OpenPos } from "./simulate-helpers";
import { buildSnapshotAt } from "./backtest-snapshot";
import { deriveEntryState, deriveStateShifted, computeAssetSideKey } from "@/app/services/setup-fingerprint";
import { recordOutcomeInMemory, type InMemoryStore } from "@/app/services/setup-fingerprint/in-memory";

/**
 * Record a closed backtest trade into the in-memory setup-records store.
 * Mirrors the live close path in paper-trade.service.ts byte-identically:
 * reads fingerprint + entryStateSnapshot + initialRiskUsd from the OpenPos
 * stash, derives close-time state from current candles, computes stateShifted,
 * calls recordOutcomeInMemory for both fingerprint and asset_side records.
 *
 * Pre-stash positions (none currently in backtest, but defensively safe) skip
 * aggregation silently when fingerprint is missing.
 */
export function recordCloseToStore(args: {
  fpStore: InMemoryStore;
  candleCache: Map<string, Candle[]>;
  asset: string;
  pos: OpenPos;
  pnlUsd: number;
  hitReason: string;
  exitTickMs: number;
}): void {
  const { fpStore, candleCache, asset, pos, pnlUsd, hitReason, exitTickMs } = args;
  if (!pos.fingerprint || (pos.side !== "long" && pos.side !== "short")) return;
  const closeFeatures = buildSnapshotAt([asset], candleCache, exitTickMs).symbols.find((s) => s.symbol === asset);
  const closeState = closeFeatures ? deriveEntryState(closeFeatures.perpMarketState, closeFeatures.recentCandles) : null;
  const stateShifted = (closeState && pos.entryStateSnapshot) ? deriveStateShifted(pos.entryStateSnapshot, closeState) : false;
  const exitReason: "stop_loss" | "take_profit" | null = hitReason === "stop_loss" ? "stop_loss" : hitReason === "take_profit" ? "take_profit" : null;
  const baseArgs = { userId: "backtest", pnlUsd, initialRiskUsd: pos.initialRiskUsd ?? null, exitReason, stateShifted };
  recordOutcomeInMemory(fpStore, { ...baseArgs, recordKind: "fingerprint", recordKey: pos.fingerprint });
  recordOutcomeInMemory(fpStore, { ...baseArgs, recordKind: "asset_side", recordKey: computeAssetSideKey(asset, pos.side) });
}
