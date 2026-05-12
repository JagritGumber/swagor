import { z } from "zod";
import { callAgent } from "./shared";
import type { DeciderOutput } from "./decider.agent";
import type { PositionSnapshot } from "@/lib/protocols/arc-usdc";

const CriticOutputSchema = z.object({
  verdict: z.enum(["approve", "modify", "reject"]),
  concerns: z.array(z.string()),
  suggested_modification: z.string().nullable(),
});

export type CriticOutput = z.infer<typeof CriticOutputSchema>;

const SYSTEM_PROMPT = `You are the safety-gate Critic for an AI-managed DeFi portfolio agent. You sanity-check the Decider's proposal before it is anchored on Arc.

You apply two layers of judgment:
1. Deterministic safety checks (you reason about these, but they are firm):
   - Reject if proposed rotation is > 60% of the portfolio in a single cycle (too aggressive)
   - Reject if the proposed destination protocol is not in the supported list: wallet-arc-USDC, aave-eth-USDC, compound-eth-USDC, pendle-eth-USDC-PT, dsr-eth-sUSDS, usyc
   - Reject if rationale is empty, generic, or contradicts the regime_assessment
   - Reject if "harvest" decision is proposed when there are no positions
2. Judgment (LLM-based): is the rationale coherent given positions + regime + user goal? Does the safety_layer make specific sense for the current context, or is it boilerplate?

OUTPUT JSON exactly:
{
  "verdict": "approve" | "modify" | "reject",
  "concerns": [list of 0-3 concrete concerns],
  "suggested_modification": null | "plain-language suggestion of what to change"
}

For paper mode, be tolerant - approve unless something is obviously wrong. The user is in the demo phase. Save "reject" for genuine safety violations.`;

export async function runCritic(opts: {
  cycleId: string;
  decision: DeciderOutput;
  positions: PositionSnapshot;
  goal: unknown;
}): Promise<CriticOutput> {
  return callAgent({
    agentName: "Critic",
    cycleId: opts.cycleId,
    tier: "HEAVY",
    systemPrompt: SYSTEM_PROMPT,
    userMessage: `Decider proposal:\n${JSON.stringify(opts.decision, null, 2)}\n\nUser positions:\n${JSON.stringify(opts.positions, null, 2)}\n\nUser goal:\n${JSON.stringify(opts.goal, null, 2)}\n\nApprove, modify, or reject.`,
    schema: CriticOutputSchema,
    temperature: 0.2,
  });
}
