export type CapitalGate = "BLOCK" | "WATCH" | "ALLOW_PAPER";
export type TradeSide = "long" | "short";

export type TradeQualityInput = {
  asset: string;
  side: TradeSide;
  entryPrice: number;
  llmConfidence: number;
  setupType?: string | null;
  invalidationLevel?: number | null;
  invalidationSource?: string | null;
  realizedVolPct1h?: number | null;
  reason?: string | null;
};

export type TradeQualityReport = {
  asset: string;
  side: TradeSide;
  setupType: string | null;
  invalidationSource: string | null;
  invalidationLevel: number | null;
  llmConfidence: number;
  engineConfidence: number;
  qualityScore: number;
  capitalGate: CapitalGate;
  rejectReasons: string[];
  warnings: string[];
};

const STRONG_SETUPS = new Set(["failed_breakout", "value_rejection"]);
const MEDIUM_SETUPS = new Set(["value_reclaim", "liquidity_sweep_reclaim", "failed_breakdown"]);

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function round(n: number): number {
  return Number(n.toFixed(3));
}

function finite(n: number | null | undefined): number | null {
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

function setupBase(setupType: string | null | undefined): number {
  if (!setupType) return 0.52;
  if (STRONG_SETUPS.has(setupType)) return 0.72;
  if (MEDIUM_SETUPS.has(setupType)) return 0.62;
  if (setupType === "range_rotation") return 0.58;
  return 0.55;
}

export function evaluateTradeQuality(input: TradeQualityInput): TradeQualityReport {
  const entry = input.entryPrice;
  const invalidation = finite(input.invalidationLevel);
  const llmConfidence = clamp01(input.llmConfidence);
  const warnings: string[] = [];
  const rejectReasons: string[] = [];
  let score = setupBase(input.setupType);

  if (!Number.isFinite(entry) || entry <= 0) rejectReasons.push("invalid_entry_price");

  if (invalidation === null) {
    rejectReasons.push("missing_numeric_invalidation");
  } else if (input.side === "long" && invalidation >= entry) {
    rejectReasons.push("long_invalidation_not_below_entry");
  } else if (input.side === "short" && invalidation <= entry) {
    rejectReasons.push("short_invalidation_not_above_entry");
  } else {
    const distancePct = Math.abs((entry - invalidation) / entry) * 100;
    const vol = finite(input.realizedVolPct1h);
    if (distancePct < 0.35) rejectReasons.push("invalidation_too_close");
    if (vol !== null && distancePct < vol * 0.75) {
      warnings.push("invalidation_inside_noise_band");
      score -= 0.08;
    }
    if (distancePct > 8) {
      warnings.push("invalidation_too_far_for_thesis");
      score -= 0.05;
    }
  }

  if (llmConfidence < 0.55) score -= 0.08;
  else if (llmConfidence >= 0.8) score += 0.03;
  else if (llmConfidence >= 0.7) score += 0.02;

  if ((input.reason ?? "").toLowerCase().includes("ema") && !(input.reason ?? "").toLowerCase().match(/vwap|vah|val|poc|value|swing|range/)) {
    rejectReasons.push("indicator_only_reason");
  }

  const qualityScore = clamp01(score);
  const engineConfidence = rejectReasons.length ? Math.min(0.55, qualityScore) : qualityScore;
  const capitalGate: CapitalGate = rejectReasons.length
    ? "BLOCK"
    : engineConfidence >= 0.68
      ? "ALLOW_PAPER"
      : "WATCH";

  return {
    asset: input.asset.toUpperCase(),
    side: input.side,
    setupType: input.setupType ?? null,
    invalidationSource: input.invalidationSource ?? null,
    invalidationLevel: invalidation,
    llmConfidence: round(llmConfidence),
    engineConfidence: round(engineConfidence),
    qualityScore: round(qualityScore),
    capitalGate,
    rejectReasons,
    warnings,
  };
}
