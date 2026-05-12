import { z } from "zod";
import { callAgent } from "./shared";

const DeciderOutputSchema = z.object({
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
});

export type DeciderOutput = z.infer<typeof DeciderOutputSchema>;

const SYSTEM_PROMPT = `You are the portfolio decision agent for an AI-managed DeFi yield agent on Arc.

Your job: given the user's current positions, stated goal, and current market state, decide ONE of three actions:
- "stay" - current allocation is fine, no action
- "rotate" - move capital from one protocol to another
- "harvest" - realize a tax-aware gain or loss

You also output safety-layer parameters the agent should monitor between cycles. These are TOOLS YOU DECIDE FOR YOURSELF, not pre-set rules. The numbers/conditions should be specific to the current regime and the user's risk tolerance.

OUTPUT JSON matching exactly:
{
  "decision": "stay" | "rotate" | "harvest",
  "rationale": "1-3 sentence explanation grounded in positions + regime + goal",
  "regime_assessment": "risk_on" | "neutral" | "risk_off",
  "if_rotate": null | {
    "from": "protocol-chain-asset (e.g. 'wallet-arc-USDC')",
    "to": "protocol-chain-asset (e.g. 'aave-arc-USDC')",
    "percent_of_portfolio": number between 0 and 100
  },
  "safety_layer": {
    "stop_loss_trigger": "specific condition, e.g. 'rotate to wallet USDC if USDC peg < 0.97'",
    "take_profit_trigger": "specific condition for locking gains, e.g. 'if Pendle PT yield drops below 5%, exit to wallet'",
    "rebalance_trigger": "what should fire the next cycle automatically, e.g. 'regime shift signal OR APY delta > 200bps OR major news in watch list'"
  }
}

Supported destinations: wallet-arc-USDC, aave-eth-USDC, compound-eth-USDC, pendle-eth-USDC-PT, dsr-eth-sUSDS, usyc.

Reasoning principles:
- "let winners run" - don't rotate just for the sake of discipline; if a position is appreciating toward the user's goal, hold
- Tax cost matters: every rotation = 1% TDS + 30% on gains in India, no inter-asset offset; cheaper to hold
- Risk-off regime - park in USYC (~5% APY, very low risk)
- Risk-on regime - lean into yield (Pendle PT, lending APR with manageable utilization)
- If user has no positions yet, propose a starting allocation aligned with their goal`;

export async function runDecider(opts: {
  cycleId: string;
  context: object;
}): Promise<DeciderOutput> {
  return callAgent({
    agentName: "Decider",
    cycleId: opts.cycleId,
    tier: "HEAVY",
    systemPrompt: SYSTEM_PROMPT,
    userMessage: `Current state:\n${JSON.stringify(opts.context, null, 2)}\n\nMake your decision.`,
    schema: DeciderOutputSchema,
    temperature: 0.3,
  });
}
