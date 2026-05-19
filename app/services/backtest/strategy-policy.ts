/**
 * Risk policy enforced by the backtest engine. The swarm decides
 * direction and conviction (confidence); the engine decides sizing.
 * One PR ships this as a single hardcoded `DEFAULT_POLICY` (Thesis
 * Trend numbers). A follow-up wires per-run preset selection.
 *
 * Why hardcoded: empirically, letting the LLM emit `maxLeverage` and
 * `maxNotionalPctOfEquity` produced 1x/2x/3x leverage swaps day-to-day
 * for no defensible reason and accounted for most of the cross-run PnL
 * variance on otherwise identical entries (ETH short 4-21: +$13.79 at
 * lev 2 in run A, +$20.69 at lev 3 in run B with identical price path).
 */
export type StrategyPolicy = {
  maxLeverage: number;
  baseNotionalPct: number;
  highConvictionNotionalPct: number;
  highConvictionThreshold: number;
  minConfidenceToOpen: number;
  maxNewThesesPerDay: number;
};

export const DEFAULT_POLICY: StrategyPolicy = {
  maxLeverage: 2,
  baseNotionalPct: 10,
  highConvictionNotionalPct: 15,
  highConvictionThreshold: 0.8,
  minConfidenceToOpen: 0.7,
  maxNewThesesPerDay: 1,
};

/** Notional % of equity for a position with the given confidence. */
export function notionalForConfidence(policy: StrategyPolicy, confidence: number): number {
  return confidence >= policy.highConvictionThreshold ? policy.highConvictionNotionalPct : policy.baseNotionalPct;
}
