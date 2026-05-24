import type { PerpMarketState } from "@/lib/perp-market-state";

/**
 * Pure derivation helpers for the setup-fingerprint primitive. Kept separate
 * from the service entry point so the 100-line cap holds. No DB, no side
 * effects, no async.
 */

export type VolumeState = "spike" | "expanding" | "normal" | "contracting" | "unknown";
export type FundingState = "long_pays" | "short_pays" | "neutral" | "extreme";

// Volume thresholds. NOT exposed to the prompt (per the no-hardcoded-thresholds
// rule): they live in the extractor as constants. Tunable here only.
const VOL_SMA_WINDOW = 10;
const SPIKE_RATIO = 2.0;
const EXPANDING_RATIO = 1.2;
const CONTRACTING_RATIO = 0.8;

export function deriveVolumeState(recentCandles: ReadonlyArray<{ v: number }>): VolumeState {
  if (recentCandles.length < VOL_SMA_WINDOW + 1) return "unknown";
  const last = recentCandles[recentCandles.length - 1];
  if (!last || !Number.isFinite(last.v) || last.v <= 0) return "unknown";
  const trailing = recentCandles.slice(-(VOL_SMA_WINDOW + 1), -1);
  const sma = trailing.reduce((sum, c) => sum + (Number.isFinite(c.v) ? c.v : 0), 0) / VOL_SMA_WINDOW;
  if (sma <= 0) return "unknown";
  const ratio = last.v / sma;
  if (ratio >= SPIKE_RATIO) return "spike";
  if (ratio >= EXPANDING_RATIO) return "expanding";
  if (ratio <= CONTRACTING_RATIO) return "contracting";
  return "normal";
}

export function deriveFundingState(
  raw: PerpMarketState["derivativesFlow"]["fundingState"],
): FundingState {
  if (raw === "extreme_positive" || raw === "extreme_negative") return "extreme";
  if (raw === "positive") return "long_pays";
  if (raw === "negative") return "short_pays";
  return "neutral";
}

export type EntryStateSnapshot = {
  valueLocation: PerpMarketState["valueLocation"];
  volumeState: VolumeState;
  oiFlow: PerpMarketState["derivativesFlow"]["oiState"];
  fundingState: FundingState;
};

export function deriveEntryState(
  perp: PerpMarketState,
  recentCandles: ReadonlyArray<{ v: number }>,
): EntryStateSnapshot {
  return {
    valueLocation: perp.valueLocation,
    volumeState: deriveVolumeState(recentCandles),
    oiFlow: perp.derivativesFlow.oiState,
    fundingState: deriveFundingState(perp.derivativesFlow.fundingState),
  };
}

export function deriveStateShifted(
  entry: EntryStateSnapshot,
  close: EntryStateSnapshot,
): boolean {
  return (
    entry.valueLocation !== close.valueLocation ||
    entry.volumeState !== close.volumeState ||
    entry.oiFlow !== close.oiFlow ||
    entry.fundingState !== close.fundingState
  );
}

/**
 * Real R-multiple risk basis. Returns null if the stop is missing, on the
 * wrong side of entry (agent output bug), or risk computes to zero. Garbage
 * stops cannot poison the avg_r aggregate downstream.
 */
export function computeInitialRiskUsd(opts: {
  side: "long" | "short";
  entryPrice: number;
  stopPrice: number | null;
  sizeUsd: number;
}): number | null {
  const { side, entryPrice, stopPrice, sizeUsd } = opts;
  if (stopPrice === null || !Number.isFinite(stopPrice) || stopPrice <= 0) return null;
  if (!Number.isFinite(entryPrice) || entryPrice <= 0) return null;
  if (!Number.isFinite(sizeUsd) || sizeUsd <= 0) return null;
  if (side === "long" && stopPrice >= entryPrice) return null;
  if (side === "short" && stopPrice <= entryPrice) return null;
  const distancePct = Math.abs(entryPrice - stopPrice) / entryPrice;
  const risk = sizeUsd * distancePct;
  return risk > 0 ? risk : null;
}
