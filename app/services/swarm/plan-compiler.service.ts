import "server-only";

import { db } from "@/lib/db/client";
import { agentReasoning } from "@/lib/db/schema";
import { llm, MODELS } from "@/lib/llm-client";
import { logLlmCall } from "@/lib/llm/log";
import type { DailyAggregatorOutput } from "./daily-aggregator.service";
import { COMPILER_SYSTEM_PROMPT, PlanCompilerSchema, type CompiledPlan } from "./plan-compiler-prompt";

export type { CompiledPlan };

/**
 * Compile the daily-aggregator output into a user-facing daily analysis.
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
      { role: "system", content: COMPILER_SYSTEM_PROMPT },
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
    systemPrompt: COMPILER_SYSTEM_PROMPT,
    userMessage: userPayload,
    rawResponse: raw,
    parsedOutput: parsed,
    promptTokens: completion.usage?.prompt_tokens,
    completionTokens: completion.usage?.completion_tokens,
  });

  return parsed;
}
