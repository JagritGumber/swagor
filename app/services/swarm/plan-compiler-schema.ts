import { z } from "zod";

const ThesisReview = z.object({
  thesisId: z.string(),
  asset: z.string(),
  decision: z.enum(["maintain", "reduce", "close", "flip"]),
  flipTo: z.enum(["long", "short", "avoid", "neutral"]).nullable(),
  reason: z.string().min(1).max(280),
}).refine(
  (v) => v.decision !== "flip" || v.flipTo !== null,
  { message: "decision=flip requires non-null flipTo", path: ["flipTo"] },
);

export const PlanCompilerSchema = z.object({
  watchlist: z.array(z.string()).min(1).max(20),
  // Reviews of currently-active multi-day theses. Maintain = position
  // held, reduce = future size cut (no-op today), close = exit at the
  // day's close, flip = exit then open opposite (requires flipTo).
  // Defaults to [] so a model that omits the field still parses; the
  // prompt still demands it on every plan that has active theses.
  activeThesisReviews: z.array(ThesisReview).default([]),
  // New bias entries ONLY for assets without an active thesis. The
  // compiler must NOT list an asset here if it appears in
  // activeThesisReviews. These spawn new theses.
  biasByAsset: z.array(z.object({
    asset: z.string(),
    bias: z.enum(["long", "short", "avoid", "neutral"]),
    confidence: z.number().min(0).max(1),
    reason: z.string().min(1).max(280),
    invalidatesIf: z.string().min(1).max(280).nullable(),
    flipsTo: z.enum(["long", "short", "avoid", "neutral"]).nullable(),
    // Filled deterministically by the compile service AFTER Zod parse,
    // from swarmContext.marketFeatures.symbols[i].timeframes["1h"].realizedVolPct.
    // The model is not asked to emit this; the engine owns risk math.
    realizedVolPct1h: z.number().min(0).max(50).optional(),
    // Advisory hints from the model. The simulator computes its own
    // deterministic stop/TP and clamps any model-provided value within
    // +/- 20% of that compute. Code is source of truth.
    stopLossPct: z.number().min(1).max(15).optional(),
    takeProfitPct: z.number().min(2).max(30).optional(),
  })).min(0).max(20),
  riskCaps: z.object({
    maxLeverage: z.number().min(1).max(20),
    maxNotionalPctOfEquity: z.number().min(0).max(100),
  }),
  notes: z.string().min(1).max(800),
  markdown: z.string().min(1).max(4000),
});

export type CompiledPlan = z.infer<typeof PlanCompilerSchema>;
export type CompiledThesisReview = z.infer<typeof ThesisReview>;
