export type ScalperLongInput = {
  strategyMode: string;
  side: "long" | "short";
  trigger: string;
  regime: string;
  pressure: "bullish" | "bearish" | "neutral" | "risk_warning" | null;
};

/**
 * Scalper long-side discipline. Empirically (runs 71da4da0, 51ad4900
 * and prior) the scalper long book is the entire loss source while the
 * short book carries the only consistent edge:
 *   long  side: net negative across windows
 *   short side: small but consistently positive
 *
 * Two narrow, reversible blocks until the long setup matures:
 *   - sweep_reclaim longs are disabled in scalper mode (repeatedly the
 *     worst bucket, e.g. "buying near value high in a range").
 *   - val_reclaim longs are allowed ONLY in a confirmed uptrend with
 *     aligned bullish pressure (buy dips in an uptrend with support).
 *
 * Shorts and non-scalper modes are untouched. This is a pragmatic
 * stability call, not a proven invariant; lift it once long setups
 * show an edge across multiple windows.
 */
export function scalperLongBlocks(input: ScalperLongInput): string[] {
  if (input.strategyMode !== "scalper" || input.side !== "long") return [];
  if (input.trigger === "sweep_reclaim") return ["scalper_long_sweep_disabled"];
  if (input.trigger === "val_reclaim" && !(input.regime === "trend_up" && input.pressure === "bullish")) {
    return ["scalper_long_needs_uptrend_and_aligned_pressure"];
  }
  return [];
}
