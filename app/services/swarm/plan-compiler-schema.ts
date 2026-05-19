import { z } from "zod";

const ThesisReview = z.object({
  thesisId: z.string(),
  asset: z.string(),
  decision: z.enum(["maintain", "reduce", "close", "flip"]),
  flipTo: z.enum(["long", "short", "avoid", "neutral"]).nullable().optional(),
  reason: z.string().min(1).max(280),
}).refine(
  (v) => v.decision !== "flip" || (v.flipTo !== null && v.flipTo !== undefined),
  { message: "decision=flip requires non-null flipTo", path: ["flipTo"] },
);

// Strip null-id placeholder reviews before per-entry validation. Some
// reasoning models emit `{thesisId: null, asset: null, ...}` when they
// have no real review to make. plan-compiler.service.ts still throws if
// an ACTIVE thesis went un-reviewed, so dropping these is safe.
const stripInvalidReviews = (val: unknown): unknown => {
  if (!Array.isArray(val)) return val;
  return val.filter((v) => {
    if (!v || typeof v !== "object") return false;
    const o = v as Record<string, unknown>;
    return typeof o.thesisId === "string" && o.thesisId.length > 0
      && typeof o.asset === "string" && o.asset.length > 0;
  });
};

// Coerce numeric invalidatesIf to its string form. The model is asked
// for a descriptive threshold ("BTC below 78234") but sometimes emits
// just the bare number. A numeric string is degraded but usable; other
// shapes become null so the position simply has no invalidation rule.
const coerceInvalidatesIf = (v: unknown): unknown => {
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  if (typeof v === "string" || v === null || v === undefined) return v;
  return null;
};

const coerceAssetPressureSource = (v: unknown): unknown => {
  if (v === "news" || v === "macro" || v === "regulatory" || v === "social" || v === "memory") return v;
  return undefined;
};

export const PlanCompilerSchema = z.object({
  watchlist: z.array(z.string()).min(1).max(20),
  marketMood: z.enum(["risk_on", "risk_off", "neutral", "event_risk"]).optional(),
  assetPressure: z.array(z.object({
    asset: z.string(),
    pressure: z.enum(["bullish", "bearish", "neutral", "risk_warning"]),
    confidence: z.number().min(0).max(1),
    reason: z.string().min(1).max(280),
    source: z.preprocess(coerceAssetPressureSource, z.enum(["news", "macro", "regulatory", "social", "memory"]).optional()),
  })).default([]),
  shockEvents: z.array(z.object({
    title: z.string().min(1).max(180),
    affectedAssets: z.array(z.string()).max(10),
    impact: z.enum(["bullish", "bearish", "risk_warning", "ignore"]),
    reason: z.string().min(1).max(280),
  })).default([]),
  watcherWarnings: z.array(z.string().min(1).max(220)).default([]),
  memoryUsed: z.array(z.string().min(1).max(220)).default([]),
  // Reviews of currently-active multi-day theses. Maintain = position
  // held, reduce = future size cut (no-op today), close = exit at the
  // day's close, flip = exit then open opposite (requires flipTo).
  // Defaults to [] so a model that omits the field still parses; the
  // prompt still demands it on every plan that has active theses.
  activeThesisReviews: z.preprocess(stripInvalidReviews, z.array(ThesisReview).default([])),
  // New bias entries ONLY for assets without an active thesis. The
  // compiler must NOT list an asset here if it appears in
  // activeThesisReviews. These spawn new theses.
  biasByAsset: z.array(z.object({
    asset: z.string(),
    bias: z.enum(["long", "short", "avoid", "neutral"]),
    confidence: z.number().min(0).max(1),
    reason: z.string().min(1).max(280),
    setupType: z.enum(["value_reclaim", "value_rejection", "accepted_breakout", "failed_breakout", "failed_breakdown", "liquidity_sweep_reclaim", "trend_pullback_to_value", "range_rotation", "crowded_side_fade", "hedge_against_active_thesis"]).optional(),
    strategyMode: z.enum(["scalper", "swing"]).optional(),
    marketStructureSummary: z.string().min(1).max(280).optional(),
    invalidationSource: z.enum(["vwap", "poc", "vah", "val", "range_high", "range_low", "swing_high", "swing_low", "liquidation_cluster", "funding_oi_shift"]).optional(),
    invalidatesIf: z.preprocess(coerceInvalidatesIf, z.string().min(1).max(280).nullable().optional()),
    flipsTo: z.enum(["long", "short", "avoid", "neutral"]).nullable().optional(),
    // Legacy field kept so old UI/code paths can parse old plan rows.
    // External swarm snapshots force biasByAsset empty at compile time.
    realizedVolPct1h: z.number().optional(),
    // Advisory hints. NO bounds at the schema layer: the engine clamps
    // every model value within +/- 20% of its deterministic compute.
    // Hardcoded min/max here would just turn model overreach into a
    // Zod failure, defeating the whole point of code-as-source-of-truth.
    stopLossPct: z.number().optional(),
    takeProfitPct: z.number().optional(),
  })).min(0).max(20),
  riskCaps: z.object({
    maxLeverage: z.number().min(1).max(20),
    maxNotionalPctOfEquity: z.number().min(0).max(100),
  }).optional(),
  notes: z.string().min(1).max(800),
  markdown: z.string().min(1).max(4000),
});

export type CompiledPlan = z.infer<typeof PlanCompilerSchema>;
export type CompiledThesisReview = z.infer<typeof ThesisReview>;
