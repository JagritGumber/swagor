import { z } from "zod";
import { callAgent } from "./shared";
import { INDIAN_VDA_TAX, INDIAN_VDA_TAX_PROMPT_BRIEF } from "@/lib/india-tax";
import type { AggregatorOutput } from "@/app/services/swarm/aggregator.service";
import type { PositionSnapshot } from "@/lib/protocols/arc-usdc";

const TaxOptimizerOutputSchema = z.object({
  approved_decision: z.enum(["stay", "rotate", "harvest", "postpone"]),
  rationale: z.string(),
  tax_impact: z.object({
    capital_gains_tax_usd: z.number(),
    tds_usd: z.number(),
    total_tax_cost_usd: z.number(),
    after_tax_apy_delta_pct: z.number(),
  }),
  modifications: z.string().nullable(),
  india_specific_flags: z.object({
    no_loss_offset_warning: z.boolean(),
    high_frequency_tds_drag: z.boolean(),
    cost_basis_uncertainty: z.boolean(),
  }),
});

export type TaxOptimizerOutput = z.infer<typeof TaxOptimizerOutputSchema>;

const SYSTEM_PROMPT = `You are the TaxOptimizer agent for an Indian retail crypto investor. You review the swarm's aggregated decision through Indian Virtual Digital Asset tax rules.

${INDIAN_VDA_TAX_PROMPT_BRIEF}

The "no inter-asset offset" + "no loss carry-forward" rules are what most non-Indian tax bots get wrong.

Your job: compute realistic tax impact, then REASON about whether the swarm's proposal is tax-coherent given the user's goal and the math. You do NOT apply fixed numeric cutoffs. Use judgment.

Decision authority:
  - approve as-is when the tax cost is reasonable relative to expected gain and aligns with the user's intent
  - modify the sizing or destination if a tax-cheaper alternative serves the same goal (use the "modifications" field to describe what changed)
  - downgrade to "postpone" or "stay" when tax cost dominates expected gain, or the proposal triggers an avoidable taxable event with little upside

Cost-basis caveat: position events aren't tracked yet. Use current position value as upper bound for gain. Set cost_basis_uncertainty=true.

Output JSON EXACTLY:
{
  "approved_decision": "stay" | "rotate" | "harvest" | "postpone",
  "rationale": "1-3 sentence tax-aware explanation",
  "tax_impact": {
    "capital_gains_tax_usd": number,
    "tds_usd": number,
    "total_tax_cost_usd": number,
    "after_tax_apy_delta_pct": number
  },
  "modifications": null | "what you changed and why",
  "india_specific_flags": {
    "no_loss_offset_warning": boolean,
    "high_frequency_tds_drag": boolean,
    "cost_basis_uncertainty": boolean
  }
}`;

export async function runTaxOptimizer(opts: {
  cycleId: string;
  aggregated: AggregatorOutput;
  positions: PositionSnapshot;
}): Promise<TaxOptimizerOutput> {
  return callAgent({
    agentName: "TaxOptimizer",
    cycleId: opts.cycleId,
    tier: "REVIEW",
    systemPrompt: SYSTEM_PROMPT,
    userMessage: `Aggregated swarm decision:\n${JSON.stringify(opts.aggregated, null, 2)}\n\nUser positions:\n${JSON.stringify(opts.positions, null, 2)}\n\nTax constants in effect:\n${JSON.stringify(INDIAN_VDA_TAX, null, 2)}\n\nCompute tax impact, then approve or downgrade.`,
    schema: TaxOptimizerOutputSchema,
    temperature: 0.2,
  });
}
