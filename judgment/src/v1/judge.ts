import type { JudgmentAction } from "./judgment-types";
import type { MarketMetrics } from "../shared/market/metrics";
import type { EngineState } from "./engine-state";

export type JudgeConfig = {
  id: string;
  label: string;
  regimeFilter?: "all" | "trend-down" | "trend-up" | "range" | "high-vol";
  requireAbsorption?: boolean;
  minTradeCount?: number;
  maxInvalidationBps?: number;
  requireActiveTape?: boolean;
  side: "long" | "short" | "both";
};

export type JudgeResult = {
  configId: string;
  label: string;
  action: JudgmentAction;
  invalidation: string | null;
  confidence: number;
  reason: string;
};

export function runJudge(
  config: JudgeConfig,
  metrics: MarketMetrics,
  _state: EngineState,
): JudgeResult {
  const { regime, priceLocation, orderflow, volumeProfile, levels } = metrics;

  const fail = (reason: string): JudgeResult => ({
    configId: config.id,
    label: config.label,
    action: { type: "no-trade" },
    invalidation: null,
    confidence: 0,
    reason,
  });

  if (!volumeProfile || levels.length === 0) return fail("Not enough data to read the market right now.");
  if (regime.mode === "unknown") return fail("Market regime is unclear, waiting for clarity.");

  if (config.regimeFilter && config.regimeFilter !== "all" && regime.mode !== config.regimeFilter) {
    return fail(`Market is ${regime.mode} but this setup needs ${config.regimeFilter}.`);
  }

  if (config.requireActiveTape && orderflow.tapeActivity === "thin") {
    return fail("Trading activity is too thin to confirm a read.");
  }

  if (orderflow.tradeCount < (config.minTradeCount ?? 10)) {
    return fail("Not enough trades yet to form a view.");
  }

  const nearestLevel = levels.reduce((closest, level) => {
    const dist = Math.abs(metrics.lastPrice - level.price);
    const closestDist = Math.abs(metrics.lastPrice - closest.price);
    return dist < closestDist ? level : closest;
  });

  const invalidationBps = Math.abs(metrics.lastPrice - nearestLevel.price) / metrics.lastPrice * 10000;
  if (invalidationBps > (config.maxInvalidationBps ?? 50)) {
    return fail("Price is too far from a key level to act on.");
  }

  const hasAbsorption = orderflow.absorption !== "none";
  if (config.requireAbsorption && !hasAbsorption) {
    return fail("No absorption event to confirm the read.");
  }

  const alignedRegimeLong = regime.mode === "trend-up" || regime.mode === "range";
  const alignedRegimeShort = regime.mode === "trend-down" || regime.mode === "range";

  if (
    config.side !== "short" &&
    nearestLevel.kind === "support" &&
    priceLocation === "value-low" &&
    orderflow.dominantSide === "buy" &&
    alignedRegimeLong
  ) {
    const confidence = computeConfidence(regime.mode === "trend-up", hasAbsorption, orderflow.tapeActivity);
    return {
      configId: config.id,
      label: config.label,
      action: {
        type: "enter",
        side: "long",
        entry: metrics.lastPrice,
        stop: nearestLevel.price * 0.995,
        target: volumeProfile.poc,
        confidence,
      },
      invalidation: `below ${nearestLevel.price.toFixed(2)}`,
      confidence,
      reason: `Support at value low with buying pressure in a ${regime.mode.replace('-', ' ')} market.`,
    };
  }

  if (
    config.side !== "long" &&
    nearestLevel.kind === "resistance" &&
    priceLocation === "value-high" &&
    orderflow.dominantSide === "sell" &&
    alignedRegimeShort
  ) {
    const confidence = computeConfidence(regime.mode === "trend-down", hasAbsorption, orderflow.tapeActivity);
    return {
      configId: config.id,
      label: config.label,
      action: {
        type: "enter",
        side: "short",
        entry: metrics.lastPrice,
        stop: nearestLevel.price * 1.005,
        target: volumeProfile.poc,
        confidence,
      },
      invalidation: `above ${nearestLevel.price.toFixed(2)}`,
      confidence,
      reason: `Resistance at value high with selling pressure in a ${regime.mode.replace('-', ' ')} market.`,
    };
  }

  return fail("No clear setup found right now.");
}

function computeConfidence(alignedRegime: boolean, hasAbsorption: boolean, tapeActivity: string): number {
  let confidence = 0.4;
  if (alignedRegime) confidence += 0.2;
  if (hasAbsorption) confidence += 0.15;
  if (tapeActivity === "heavy") confidence += 0.1;
  else if (tapeActivity === "active") confidence += 0.05;
  return Math.min(confidence, 0.9);
}

export function collectJudgments(
  configs: JudgeConfig[],
  metrics: MarketMetrics,
  state: EngineState,
): JudgeResult[] {
  return configs
    .map((cfg) => runJudge(cfg, metrics, state))
    .filter((r) => r.action.type !== "no-trade")
    .sort((a, b) => b.confidence - a.confidence);
}

export function pickBestJudgment(results: JudgeResult[]): JudgeResult | null {
  if (results.length === 0) return null;
  return results[0];
}
