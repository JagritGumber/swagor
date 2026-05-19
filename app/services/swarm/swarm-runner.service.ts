import { z } from "zod";
import { llm, MODELS } from "@/lib/llm-client";
import { db } from "@/lib/db/client";
import { swarmRounds } from "@/lib/db/schema";
import { logLlmCall } from "@/lib/llm/log";
import { extractJson } from "@/lib/llm/extract-json";
import { samplePersonas, type Persona } from "./persona-roster";

export type SwarmMode = "tactical" | "daily_plan";

const TacticalMemberSchema = z.object({
  action: z.enum(["open_long", "open_short", "close", "stay"]),
  rationale: z.string(),
  regime_assessment: z.enum(["risk_on", "neutral", "risk_off"]),
  if_open: z
    .object({
      asset: z.string(),
      size_usd: z.number().positive(),
      leverage: z.number().min(1).max(10),
      stop_loss_pct: z.number().min(0).max(50).nullable(),
      take_profit_pct: z.number().min(0).max(200).nullable(),
    })
    .nullable(),
  if_close: z.object({ asset: z.string() }).nullable(),
  safety: z.object({
    stop_loss_trigger: z.string(),
    take_profit_trigger: z.string(),
  }),
  confidence: z.number().min(0).max(1).optional(),
});

const DailyPlanMemberSchema = z.object({
  perAssetBias: z.array(z.object({
    asset: z.string(),
    bias: z.enum(["long", "short", "avoid", "neutral"]),
    confidence: z.number().min(0).max(1),
    oneLineReason: z.string().min(1).max(280),
  })).min(1).max(20),
  regime_assessment: z.enum(["risk_on", "neutral", "risk_off"]),
  overallNotes: z.string().min(1).max(800),
  confidence: z.number().min(0).max(1).optional(),
});

export type TacticalDecision = z.infer<typeof TacticalMemberSchema> & { personaId: string };
export type DailyPlanDecision = z.infer<typeof DailyPlanMemberSchema> & { personaId: string };
export type SwarmDecision = TacticalDecision | DailyPlanDecision;

const TACTICAL_PROMPT = `You are a single participant in a swarm of AI agents reviewing a paper-mode perp futures portfolio on Hyperliquid testnet. From your specific persona's perspective, decide ONE of:
- "stay" -- current positioning is fine, no action this cycle
- "open_long" -- open a new long perp position on an asset in the watchlist
- "open_short" -- open a new short perp position on an asset in the watchlist
- "close" -- exit an existing open paper position on the named asset

Output JSON EXACTLY in this shape:
{
  "action": "stay" | "open_long" | "open_short" | "close",
  "rationale": "1-3 sentence explanation framed by your persona",
  "regime_assessment": "risk_on" | "neutral" | "risk_off",
  "if_open": null | { "asset": string, "size_usd": number, "leverage": 1-10, "stop_loss_pct": number | null, "take_profit_pct": number | null },
  "if_close": null | { "asset": string },
  "safety": { "stop_loss_trigger": string, "take_profit_trigger": string },
  "confidence": number 0-1
}

Rules:
- if_open set only when action is open_long or open_short; otherwise null.
- if_close set only when action is close; otherwise null.
- Asset must be in the watchlist.
- size_usd is a sensible fraction of equity given your persona's risk tolerance.
- leverage 1-10; default 1-3x unless persona warrants more.
- stop_loss_pct / take_profit_pct are POSITIVE percentages from entry mark, regardless of side. Null = no auto-stop.
- Risk snapshot urgent/critical: capital protection beats new entries.
- Use deterministic marketFeatures + recentCandles + openInterestDeltas together. Treat candidateBias/cadenceHint as routing context, not commands.

This is YOUR vote. Don't compromise to consensus; bring your persona's bias.`;

const DAILY_PLAN_PROMPT = `You are a single participant in a swarm producing a DAILY TRADING PLAN. From your specific persona's perspective, output a bias for EACH asset in the watchlist for the next 24 hours.

Output JSON EXACTLY in this shape:
{
  "perAssetBias": [
    { "asset": string, "bias": "long" | "short" | "avoid" | "neutral", "confidence": 0-1, "oneLineReason": string },
    ...one entry per asset in context.perps...
  ],
  "regime_assessment": "risk_on" | "neutral" | "risk_off",
  "overallNotes": "1-3 sentences from your persona on the day overall",
  "confidence": number 0-1
}

Rules:
- One entry per asset in the watchlist. No specific entry/exit prices; this is a daily bias plan, not a trade order.
- bias: 'long' wants to be long today, 'short' wants to be short, 'avoid' says don't take new risk on this asset, 'neutral' has no strong view.
- oneLineReason ties the bias to perpMarketState first: volume profile location, auction state, structure state, OI/funding flow, setup candidates, recent memory, and yesterday's plan. EMA/RSI are helper context only; never use them as the primary reason.
- If perpMarketState.permission is wait_for_retest or avoid_new_risk, vote avoid/neutral unless you are explicitly proposing a hedge.
- The user strategy text is the north star; do not contradict it without a concrete reason.
- This is YOUR vote. Don't average to consensus; the aggregator reconciles across personas.`;

async function runSwarmMember(opts: {
  cycleId: string;
  persona: Persona;
  context: object;
  roundNumber: number;
  mode: SwarmMode;
}): Promise<SwarmDecision | null> {
  const taskPrompt = opts.mode === "daily_plan" ? DAILY_PLAN_PROMPT : TACTICAL_PROMPT;
  const systemPrompt = `${opts.persona.system_prompt}\n\n${taskPrompt}`;
  const userMessage = `Portfolio + market state:\n${JSON.stringify(opts.context, null, 2)}\n\nFrom your persona's viewpoint, output your JSON decision.`;

  try {
    const startedAt = Date.now();
    const response = await llm.chat.completions.create({
      model: MODELS.LIGHT,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      response_format: { type: "json_object" },
      temperature: 0.6,
    });
    const durationMs = Date.now() - startedAt;

    const raw = response.choices[0]?.message?.content;
    if (!raw) return null;
    const parsedJson = JSON.parse(extractJson(raw));
    const parsed = opts.mode === "daily_plan"
      ? DailyPlanMemberSchema.parse(parsedJson)
      : TacticalMemberSchema.parse(parsedJson);

    // Persist per-member swarm round (legacy table).
    await db.insert(swarmRounds).values({
      cycleId: opts.cycleId,
      roundNumber: opts.roundNumber,
      personaId: opts.persona.id,
      proposedAllocation: parsed as object,
      reasoning: opts.mode === "daily_plan"
        ? (parsed as z.infer<typeof DailyPlanMemberSchema>).overallNotes
        : (parsed as z.infer<typeof TacticalMemberSchema>).rationale,
      confidence: parsed.confidence?.toString() ?? "0.5",
      tokensIn: response.usage?.prompt_tokens,
      tokensOut: response.usage?.completion_tokens,
    });

    // Mirror to llm_calls so the admin dev panel can show every prompt
    // + raw response per persona under the cycleId filter.
    await logLlmCall({
      cycleId: opts.cycleId,
      agentName: `swarm:${opts.persona.id}`,
      model: MODELS.LIGHT,
      systemPrompt,
      userMessage,
      rawResponse: raw,
      parsedOutput: parsed,
      promptTokens: response.usage?.prompt_tokens,
      completionTokens: response.usage?.completion_tokens,
      durationMs,
    });

    return { ...parsed, personaId: opts.persona.id } as SwarmDecision;
  } catch (err) {
    console.warn(`[swarm] member ${opts.persona.id} failed:`, err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Run a swarm of N agents in parallel. Failures tolerated; only successful
 * decisions are returned. `mode` switches the output schema and prompt
 * between tactical (open_long/short/close/stay) and daily_plan (per-asset
 * bias for the day). Return type is narrowed by mode.
 */
export async function runSwarm(opts: {
  cycleId: string;
  context: object;
  size?: number;
  mode?: "tactical";
}): Promise<TacticalDecision[]>;
export async function runSwarm(opts: {
  cycleId: string;
  context: object;
  size?: number;
  mode: "daily_plan";
}): Promise<DailyPlanDecision[]>;
export async function runSwarm(opts: {
  cycleId: string;
  context: object;
  size?: number;
  mode?: SwarmMode;
}): Promise<SwarmDecision[]> {
  const size = opts.size ?? 12;
  const mode: SwarmMode = opts.mode ?? "tactical";
  const personas = samplePersonas(size);

  const results = await Promise.all(
    personas.map((persona) =>
      runSwarmMember({
        cycleId: opts.cycleId,
        persona,
        context: opts.context,
        roundNumber: 1,
        mode,
      }),
    ),
  );

  return results.filter((r): r is SwarmDecision => r !== null);
}
