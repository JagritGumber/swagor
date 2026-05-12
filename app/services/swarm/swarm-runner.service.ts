import { z } from "zod";
import { llm, MODELS } from "@/lib/llm-client";
import { db } from "@/lib/db/client";
import { swarmRounds } from "@/lib/db/schema";
import { samplePersonas, type Persona } from "./persona-roster";

const SwarmMemberOutputSchema = z.object({
  decision: z.enum(["stay", "rotate", "harvest"]),
  rationale: z.string(),
  regime_assessment: z.enum(["risk_on", "neutral", "risk_off"]),
  if_rotate: z
    .object({
      from: z.string(),
      to: z.string(),
      percent_of_portfolio: z.number().min(0).max(100),
    })
    .nullable(),
  safety_layer: z.object({
    stop_loss_trigger: z.string(),
    take_profit_trigger: z.string(),
    rebalance_trigger: z.string(),
  }),
  confidence: z.number().min(0).max(1).optional(),
});

export type SwarmDecision = z.infer<typeof SwarmMemberOutputSchema> & {
  personaId: string;
};

const SWARM_BASE_PROMPT = `You are a single participant in a swarm of AI agents reviewing a DeFi portfolio. From your specific persona's perspective, decide ONE of:
- "stay" — current allocation is fine, no action
- "rotate" — move capital from one protocol to another
- "harvest" — realize a tax-aware gain/loss

Output JSON EXACTLY in this shape:
{
  "decision": "stay" | "rotate" | "harvest",
  "rationale": "1-3 sentence explanation framed by your persona",
  "regime_assessment": "risk_on" | "neutral" | "risk_off",
  "if_rotate": null | { "from": string, "to": string, "percent_of_portfolio": number },
  "safety_layer": { "stop_loss_trigger": string, "take_profit_trigger": string, "rebalance_trigger": string },
  "confidence": number 0-1
}

Supported sources / destinations: wallet-arc-USDC, aave-eth-USDC, compound-eth-USDC, pendle-eth-USDC-PT, dsr-eth-sUSDS, usyc.

This is YOUR vote in the swarm. Don't compromise to consensus; bring your persona's bias. The aggregator will reconcile across the swarm.`;

async function runSwarmMember(opts: {
  cycleId: string;
  persona: Persona;
  context: object;
  roundNumber: number;
}): Promise<SwarmDecision | null> {
  const systemPrompt = `${opts.persona.system_prompt}\n\n${SWARM_BASE_PROMPT}`;
  const userMessage = `Portfolio state:\n${JSON.stringify(opts.context, null, 2)}\n\nFrom your persona's viewpoint, output your JSON decision.`;

  try {
    const response = await llm.chat.completions.create({
      model: MODELS.LIGHT,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      response_format: { type: "json_object" },
      temperature: 0.6, // higher temp -> diversity across swarm
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
 * Run a swarm of N agents (each a different persona) in parallel.
 * Failures of individual members are tolerated; returns only successful
 * decisions. Falls back gracefully if too many members fail.
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
