import type { MarketFeatureSnapshot } from "@/lib/market-features";

export const LOW_REALIZED_VOL_PCT = 0.15;
export const HIGH_REALIZED_VOL_PCT = 0.8;
export const LOW_VOL_MIN_CADENCE_SECONDS = 600;
export const HIGH_VOL_MAX_CADENCE_SECONDS = 180;
export const RISK_EMERGENCY_MAX_CADENCE_SECONDS = 120;

export type CadenceBlendMode =
  | "risk_emergency"
  | "high_realized_vol"
  | "mid_realized_vol"
  | "low_realized_vol"
  | "unavailable";

export type CadenceBlendResult = {
  mode: CadenceBlendMode;
  agentNextCheckSeconds: number;
  nextCheckSeconds: number;
  averageRealizedVolPct: number | null;
  reason: string;
};

function clampSeconds(value: number, min: number, max: number): number {
  return Math.min(Math.max(Math.floor(value), min), max);
}

function averageFiveMinuteRealizedVol(snapshot: MarketFeatureSnapshot): number | null {
  const values = snapshot.symbols
    .map((s) => s.timeframes["5m"]?.realizedVolPct)
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export function blendWatcherCadence({
  agentNextCheckSeconds,
  marketFeatures,
  tierMinSeconds,
  tierMaxSeconds,
  riskEmergency,
}: {
  agentNextCheckSeconds: number;
  marketFeatures: MarketFeatureSnapshot;
  tierMinSeconds: number;
  tierMaxSeconds: number;
  riskEmergency: boolean;
}): CadenceBlendResult {
  const agentClamped = clampSeconds(agentNextCheckSeconds, tierMinSeconds, tierMaxSeconds);

  if (riskEmergency) {
    const nextCheckSeconds = clampSeconds(
      Math.min(agentClamped, RISK_EMERGENCY_MAX_CADENCE_SECONDS),
      tierMinSeconds,
      tierMaxSeconds,
    );
    return {
      mode: "risk_emergency",
      agentNextCheckSeconds: agentClamped,
      nextCheckSeconds,
      averageRealizedVolPct: null,
      reason: `Risk emergency capped watcher cadence at ${nextCheckSeconds}s.`,
    };
  }

  const averageRealizedVolPct = averageFiveMinuteRealizedVol(marketFeatures);
  if (averageRealizedVolPct === null) {
    return {
      mode: "unavailable",
      agentNextCheckSeconds: agentClamped,
      nextCheckSeconds: agentClamped,
      averageRealizedVolPct,
      reason: `Realized volatility unavailable; using agent cadence ${agentClamped}s.`,
    };
  }

  if (averageRealizedVolPct >= HIGH_REALIZED_VOL_PCT) {
    const nextCheckSeconds = clampSeconds(
      Math.min(agentClamped, HIGH_VOL_MAX_CADENCE_SECONDS),
      tierMinSeconds,
      tierMaxSeconds,
    );
    return {
      mode: "high_realized_vol",
      agentNextCheckSeconds: agentClamped,
      nextCheckSeconds,
      averageRealizedVolPct,
      reason: `Average 5m realized volatility ${averageRealizedVolPct.toFixed(2)}%; capped cadence at ${nextCheckSeconds}s.`,
    };
  }

  if (averageRealizedVolPct <= LOW_REALIZED_VOL_PCT) {
    const nextCheckSeconds = clampSeconds(
      Math.max(agentClamped, LOW_VOL_MIN_CADENCE_SECONDS),
      tierMinSeconds,
      tierMaxSeconds,
    );
    return {
      mode: "low_realized_vol",
      agentNextCheckSeconds: agentClamped,
      nextCheckSeconds,
      averageRealizedVolPct,
      reason: `Average 5m realized volatility ${averageRealizedVolPct.toFixed(2)}%; floored cadence at ${nextCheckSeconds}s.`,
    };
  }

  return {
    mode: "mid_realized_vol",
    agentNextCheckSeconds: agentClamped,
    nextCheckSeconds: agentClamped,
    averageRealizedVolPct,
    reason: `Average 5m realized volatility ${averageRealizedVolPct.toFixed(2)}%; using agent cadence ${agentClamped}s.`,
  };
}
