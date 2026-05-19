import "server-only";

import { db } from "@/lib/db/client";
import { agentReasoning } from "@/lib/db/schema";
import { traderLlm, MODELS } from "@/lib/llm-client";
import { logLlmCall } from "@/lib/llm/log";
import type { DailyAggregatorOutput } from "./daily-aggregator.service";
import { COMPILER_SYSTEM_PROMPT, PlanCompilerSchema, type CompiledPlan } from "./plan-compiler-prompt";
import { formatThesisMemoryForPrompt, type ThesisMemory } from "./build-thesis-memory";
import { extractJson } from "@/lib/llm/extract-json";

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
  thesisMemory: ThesisMemory;
}): Promise<CompiledPlan> {
  const memoryBlock = formatThesisMemoryForPrompt(opts.thesisMemory);
  const userPayload = `${memoryBlock}\n\n${JSON.stringify({
    aggregator: opts.aggregator,
    swarmContext: opts.swarmContext,
    strategy: opts.strategyText,
    yesterdayPlanSummary: opts.yesterdayPlanSummary,
  }, null, 2)}`;

  // Compiler runs on the TRADER tier (DeepInfra Mistral 24B by default)
  // for sub-second TTFT. Earlier cycles spent 37s of 38s wall-clock
  // here on glm-4-32b; structured JSON output works fine on the faster
  // tier since the prompt + Zod schema constrain the shape tightly.
  const startedAt = Date.now();
  const completion = await traderLlm.chat.completions.create({
    model: MODELS.TRADER,
    messages: [
      { role: "system", content: COMPILER_SYSTEM_PROMPT },
      { role: "user", content: userPayload },
    ],
    response_format: { type: "json_object" },
    temperature: 0.3,
  });
  const durationMs = Date.now() - startedAt;
  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error("plan-compiler returned empty response");
  const parsed = PlanCompilerSchema.parse(JSON.parse(extractJson(raw)));

  // Deterministic enrichment: fill realizedVolPct1h from features. The
  // model is NOT asked to emit this; risk math is the engine's job.
  type SymFeature = { symbol: string; timeframes?: { "1h"?: { realizedVolPct?: number } } };
  const features = (opts.swarmContext as { marketFeatures?: { symbols?: SymFeature[] } }).marketFeatures?.symbols ?? [];
  const volMap = new Map<string, number | undefined>();
  for (const s of features) volMap.set(s.symbol.toUpperCase(), s.timeframes?.["1h"]?.realizedVolPct);
  parsed.biasByAsset = parsed.biasByAsset.map((b) => ({
    ...b, realizedVolPct1h: volMap.get(b.asset.toUpperCase()) ?? b.realizedVolPct1h,
  }));

  if (opts.thesisMemory.active.length > 0) {
    const reviewedIds = new Set(parsed.activeThesisReviews.map((r) => r.thesisId));
    const missing = opts.thesisMemory.active.filter((a) => !reviewedIds.has(a.thesisId));
    if (missing.length > 0) {
      throw new Error(`plan-compiler omitted reviews for active theses: ${missing.map((m) => m.thesisId).join(", ")}`);
    }
  }

  await db.insert(agentReasoning).values({
    cycleId: opts.cycleId,
    agentName: "plan-compiler",
    model: MODELS.TRADER,
    input: { aggregator: opts.aggregator, strategy: opts.strategyText, yesterdayPlanSummary: opts.yesterdayPlanSummary, thesisMemory: opts.thesisMemory } as object,
    output: parsed as object,
    promptTokens: completion.usage?.prompt_tokens,
    completionTokens: completion.usage?.completion_tokens,
  });

  await logLlmCall({
    cycleId: opts.cycleId,
    agentName: "plan-compiler",
    model: MODELS.TRADER,
    systemPrompt: COMPILER_SYSTEM_PROMPT,
    userMessage: userPayload,
    rawResponse: raw,
    parsedOutput: parsed,
    promptTokens: completion.usage?.prompt_tokens,
    completionTokens: completion.usage?.completion_tokens,
    durationMs,
  });

  return parsed;
}
