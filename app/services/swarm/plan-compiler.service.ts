import "server-only";

import { z } from "zod";
import { db } from "@/lib/db/client";
import { agentReasoning } from "@/lib/db/schema";
import { llm, MODELS } from "@/lib/llm-client";
import { logLlmCall } from "@/lib/llm/log";
import type { DailyAggregatorOutput } from "./daily-aggregator.service";

const PlanCompilerSchema = z.object({
  watchlist: z.array(z.string()).min(1).max(20),
  biasByAsset: z.array(z.object({
    asset: z.string(),
    bias: z.enum(["long", "short", "avoid", "neutral"]),
    confidence: z.number().min(0).max(1),
    reason: z.string().min(1).max(280),
  })).min(1).max(20),
  riskCaps: z.object({
    maxLeverage: z.number().min(1).max(20),
    maxNotionalPctOfEquity: z.number().min(0).max(100),
  }),
  notes: z.string().min(1).max(800),
  markdown: z.string().min(1).max(4000),
});

export type CompiledPlan = z.infer<typeof PlanCompilerSchema>;

const SYSTEM = `You compile a daily trading plan from a swarm's aggregated output.

Output JSON exactly:
{
  "watchlist": ["BTC", "ETH", ...],
  "biasByAsset": [{ "asset": string, "bias": "long" | "short" | "avoid" | "neutral", "confidence": 0-1, "reason": "one line tying bias to the swarm's signals" }],
  "riskCaps": { "maxLeverage": 1-10, "maxNotionalPctOfEquity": 0-100 },
  "notes": "one paragraph on the overall regime read, news caveats, what would change the plan",
  "markdown": "the same content rendered as user-facing markdown with sections: Today's bias, Risk caps, Notes"
}

Rules:
- watchlist mirrors the assets that have a biasByAsset entry.
- riskCaps come from the user's strategy text + the swarm's regime read. Default 1-3x max leverage; default 5-20% max notional per asset.
- notes is plain English, no jargon dump. Mention dispersion if > 0.5 (the swarm disagreed).
- markdown sections (in order): "## Today's bias" with one row per asset, "## Risk caps", "## Notes". Use bullet points; no walls of text.
- Ground the plan in the swarm output and the user's strategy. Do not invent assets or numbers not present in the input.`;

/**
 * Compile the daily-aggregator output into a user-facing daily plan.
 * Cheap LIGHT-tier LLM call. Writes one agent_reasoning row tagged
 * `plan-compiler` so the admin dev panel can replay it.
 */
export async function compileDailyPlan(opts: {
  cycleId: string;
  aggregator: DailyAggregatorOutput;
  swarmContext: object;
  strategyText: string;
  yesterdayPlanSummary: object | null;
}): Promise<CompiledPlan> {
  const userPayload = JSON.stringify({
    aggregator: opts.aggregator,
    swarmContext: opts.swarmContext,
    strategy: opts.strategyText,
    yesterdayPlanSummary: opts.yesterdayPlanSummary,
  }, null, 2);

  const completion = await llm.chat.completions.create({
    model: MODELS.LIGHT,
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: userPayload },
    ],
    response_format: { type: "json_object" },
    temperature: 0.3,
  });
  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error("plan-compiler returned empty response");
  const parsed = PlanCompilerSchema.parse(JSON.parse(raw));

  await db.insert(agentReasoning).values({
    cycleId: opts.cycleId,
    agentName: "plan-compiler",
    model: MODELS.LIGHT,
    input: { aggregator: opts.aggregator, strategy: opts.strategyText, yesterdayPlanSummary: opts.yesterdayPlanSummary } as object,
    output: parsed as object,
    promptTokens: completion.usage?.prompt_tokens,
    completionTokens: completion.usage?.completion_tokens,
  });

  await logLlmCall({
    cycleId: opts.cycleId,
    agentName: "plan-compiler",
    model: MODELS.LIGHT,
    systemPrompt: SYSTEM,
    userMessage: userPayload,
    rawResponse: raw,
    parsedOutput: parsed,
    promptTokens: completion.usage?.prompt_tokens,
    completionTokens: completion.usage?.completion_tokens,
  });

  return parsed;
}
