import { z } from "zod";
import { llm, MODELS } from "@/lib/llm-client";
import { db } from "@/lib/db/client";
import { swarmRounds } from "@/lib/db/schema";
import { samplePersonas, type Persona } from "./persona-roster";

const SwarmMemberOutputSchema = z.object({
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

export type SwarmDecision = z.infer<typeof SwarmMemberOutputSchema> & {
  personaId: string;
};

const SWARM_BASE_PROMPT = `You are a single participant in a swarm of AI agents reviewing a paper-mode perp futures portfolio on Hyperliquid testnet. From your specific persona's perspective, decide ONE of:
- "stay" -- current positioning is fine, no action this cycle
- "open_long" -- open a new long perp position on an asset in the watchlist
- "open_short" -- open a new short perp position on an asset in the watchlist
- "close" -- exit an existing open paper position on the named asset

Output JSON EXACTLY in this shape:
{
  "action": "stay" | "open_long" | "open_short" | "close",
  "rationale": "1-3 sentence explanation framed by your persona",
  "regime_assessment": "risk_on" | "neutral" | "risk_off",
  "if_open": null | {
    "asset": "ETH" | "BTC" | "SOL" | etc,
    "size_usd": number,
    "leverage": number 1-10,
    "stop_loss_pct": number | null,    // positive percent from entry; e.g. 3.5 means a 3.5% adverse move closes the position. Null = no auto-stop.
    "take_profit_pct": number | null   // positive percent from entry; e.g. 8 means an 8% favourable move closes the position. Null = no auto-tp.
  },
  "if_close": null | { "asset": "ETH" | "BTC" | "SOL" | etc },
  "safety": { "stop_loss_trigger": string, "take_profit_trigger": string },
  "confidence": number 0-1
}

Rules:
- if_open is set ONLY when action is "open_long" or "open_short". Otherwise null.
- if_close is set ONLY when action is "close". Otherwise null.
- Asset must be a symbol from the watchlist in the user payload.
- size_usd should be a sensible fraction of available equity given your persona's risk tolerance.
- leverage cap is 10x; default to 1-3x unless your persona explicitly warrants more.
- stop_loss_pct and take_profit_pct are POSITIVE percentages from entry mark, regardless of side. They become absolute price levels at open and are enforced automatically every cron heartbeat. Use null only when your persona truly wants no auto-stop.
- safety triggers are plain-English thresholds tied to the same levels you set in if_open, e.g. "ETH below 3100 (4% stop)" or "funding flips positive".
- The payload includes a deterministic risk snapshot. If it is urgent or critical, capital protection beats new entries.

This is YOUR vote. Don't compromise to consensus; bring your persona's bias. The aggregator reconciles across the swarm.`;

async function runSwarmMember(opts: {
  cycleId: string;
  persona: Persona;
  context: object;
  roundNumber: number;
}): Promise<SwarmDecision | null> {
  const systemPrompt = `${opts.persona.system_prompt}\n\n${SWARM_BASE_PROMPT}`;
  const userMessage = `Portfolio + market state:\n${JSON.stringify(opts.context, null, 2)}\n\nFrom your persona's viewpoint, output your JSON decision.`;

  try {
    const response = await llm.chat.completions.create({
      model: MODELS.LIGHT,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      response_format: { type: "json_object" },
      temperature: 0.6,
    });

    const raw = response.choices[0]?.message?.content;
    if (!raw) return null;
    const parsed = SwarmMemberOutputSchema.parse(JSON.parse(raw));

    await db.insert(swarmRounds).values({
      cycleId: opts.cycleId,
      roundNumber: opts.roundNumber,
      personaId: opts.persona.id,
      proposedAllocation: parsed as object,
      reasoning: parsed.rationale,
      confidence: parsed.confidence?.toString() ?? "0.5",
      tokensIn: response.usage?.prompt_tokens,
      tokensOut: response.usage?.completion_tokens,
    });

    return { ...parsed, personaId: opts.persona.id };
  } catch (err) {
    console.warn(`[swarm] member ${opts.persona.id} failed:`, err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Run a swarm of N agents in parallel. Failures tolerated; only successful
 * decisions are returned.
 */
export async function runSwarm(opts: {
  cycleId: string;
  context: object;
  size?: number;
}): Promise<SwarmDecision[]> {
  const size = opts.size ?? 12;
  const personas = samplePersonas(size);

  const results = await Promise.all(
    personas.map((persona) =>
      runSwarmMember({
        cycleId: opts.cycleId,
        persona,
        context: opts.context,
        roundNumber: 1,
      }),
    ),
  );

  return results.filter((r): r is SwarmDecision => r !== null);
}





