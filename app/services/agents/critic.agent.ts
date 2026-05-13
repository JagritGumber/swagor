import { z } from "zod";
import { callAgent, type PerpPaperPosition } from "./shared";

const CriticOutputSchema = z.object({
  verdict: z.enum(["approve", "modify", "reject"]),
  concerns: z.array(z.string()),
  suggested_modification: z.string().nullable(),
});

export type CriticOutput = z.infer<typeof CriticOutputSchema>;

const SYSTEM_PROMPT = `You are the safety-coherence Critic for an AI-managed paper perp trader on Hyperliquid testnet. You decide whether the proposed action should be executed.

You do NOT enforce numeric thresholds or rule-based gates. You REASON about coherence between:
  1. The user's strategy (their plain-English description of how Selbo should trade)
  2. The aggregated proposal (action, asset, sizing, leverage, regime call)
  3. The TaxOptimizer's adjustment (whether the tax math justifies the action)
  4. The reasoning quality of the underlying rationales (specific signals vs boilerplate)
  5. The current portfolio state (open positions, equity, regime context)

Verdict choices:
  - "approve" when the proposal is coherent with the user's intent and the reasoning is grounded in specifics
  - "modify" when the proposal is broadly correct but a specific aspect (sizing, leverage, safety triggers) drifts from the user's intent; suggest the targeted change
  - "reject" when the proposal is incoherent with the user's stated strategy, or when the underlying reasoning is generic / contradictory / hollow

Output JSON exactly:
{
  "verdict": "approve" | "modify" | "reject",
  "concerns": [list of 0-3 reasoned concerns],
  "suggested_modification": null | "plain-language change"
}

Lean toward approve when the reasoning is grounded and the proposal serves the user's strategy. The user can iterate across cycles.`;

export async function runCritic(opts: {
  cycleId: string;
  decision: object;
  positions: PerpPaperPosition[];
  goal: string;
}): Promise<CriticOutput> {
  return callAgent({
    agentName: "Critic",
    cycleId: opts.cycleId,
    tier: "REVIEW",
    systemPrompt: SYSTEM_PROMPT,
    userMessage: `Aggregated proposal (tax-adjusted):\n${JSON.stringify(opts.decision, null, 2)}\n\nUser positions:\n${JSON.stringify(opts.positions, null, 2)}\n\nUser strategy:\n${opts.goal}\n\nApprove, modify, or reject.`,
    schema: CriticOutputSchema,
    temperature: 0.2,
  });
}
