import { z } from "zod";

export const PlanCompilerSchema = z.object({
  watchlist: z.array(z.string()).min(1).max(20),
  biasByAsset: z.array(z.object({
    asset: z.string(),
    bias: z.enum(["long", "short", "avoid", "neutral"]),
    confidence: z.number().min(0).max(1),
    reason: z.string().min(1).max(280),
    // Trigger condition that would flip this bias. Mirrors how real
    // traders pre-commit: "I'm bearish BTC, but if it closes above
    // 95k on the 4h and holds, I'm flipping neutral/long." Null only
    // when no clean invalidation level exists.
    invalidatesIf: z.string().min(1).max(280).nullable(),
    flipsTo: z.enum(["long", "short", "avoid", "neutral"]).nullable(),
  })).min(1).max(20),
  riskCaps: z.object({
    maxLeverage: z.number().min(1).max(20),
    maxNotionalPctOfEquity: z.number().min(0).max(100),
  }),
  notes: z.string().min(1).max(800),
  markdown: z.string().min(1).max(4000),
});

export type CompiledPlan = z.infer<typeof PlanCompilerSchema>;

export const COMPILER_SYSTEM_PROMPT = `You compile a daily ANALYSIS from a swarm's aggregated output. Think like a trader writing their morning prep: an opinion + a boundary that would flip it.

Output JSON exactly:
{
  "watchlist": ["BTC", "ETH", ...],
  "biasByAsset": [{
    "asset": string,
    "bias": "long" | "short" | "avoid" | "neutral",
    "confidence": 0-1,
    "reason": "one line tying bias to the swarm's signals",
    "invalidatesIf": "observable trigger that would flip your view (e.g. 'BTC closes above 95000 on the 4h and holds') or null if no clean level",
    "flipsTo": "long" | "short" | "avoid" | "neutral" | null
  }],
  "riskCaps": { "maxLeverage": 1-10, "maxNotionalPctOfEquity": 0-100 },
  "notes": "one paragraph on the overall regime read, news caveats, what would change the plan",
  "markdown": "the same content rendered as user-facing markdown with sections: Today's bias, Boundaries, Risk caps, Notes"
}

Rules:
- watchlist mirrors the assets that have a biasByAsset entry.
- invalidatesIf MUST be observable from price / funding / OI / volume / candle close data. Never use vague sentiment language ("if the mood shifts"). Examples: "ETH funding stays positive for 8h", "BTC reclaims the 1h ema50 and holds 2 candles".
- flipsTo names the bias you would switch to if invalidatesIf triggers. Required when invalidatesIf is not null.
- Either both invalidatesIf and flipsTo are set, or both are null. No half-states.
- riskCaps come from the user's strategy text + the swarm's regime read. Default 1-3x max leverage; default 5-20% max notional per asset.
- notes is plain English, no jargon dump. Mention dispersion if > 0.5 (the swarm disagreed).
- markdown sections (in order): "## Today's bias" with one bullet per asset, "## Boundaries" with one bullet per asset that has an invalidatesIf, "## Risk caps", "## Notes". Bullet points only; no walls of text.
- Ground the analysis in the swarm output and the user's strategy. Do not invent assets or price levels not present in the input.`;
