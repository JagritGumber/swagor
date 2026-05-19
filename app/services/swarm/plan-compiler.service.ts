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
type SetupCandidate = {
  side: "long" | "short";
  setupType: NonNullable<CompiledPlan["biasByAsset"][number]["setupType"]>;
  invalidationSource: NonNullable<CompiledPlan["biasByAsset"][number]["invalidationSource"]>;
};
type SymFeature = {
  symbol: string;
  timeframes?: { "1h"?: { realizedVolPct?: number } };
  perpMarketState?: { permission?: string; setupCandidates?: SetupCandidate[]; brief?: string };
};

const STRUCTURE_WORDS = ["poc", "vah", "val", "vwap", "swing", "range", "value", "breakout", "breakdown", "sweep", "reclaim", "rejection", "funding", "oi", "open interest"];
const WEAK_WORDS = ["ema", "rsi", "moving average"];

function hasStructure(text: string): boolean {
  const t = text.toLowerCase();
  return STRUCTURE_WORDS.some((w) => t.includes(w));
}

function indicatorOnly(text: string): boolean {
  const t = text.toLowerCase();
  return WEAK_WORDS.some((w) => t.includes(w)) && !hasStructure(t);
}

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
  const features = (opts.swarmContext as { marketFeatures?: { symbols?: SymFeature[] } }).marketFeatures?.symbols ?? [];
  const featureMap = new Map(features.map((s) => [s.symbol.toUpperCase(), s]));
  parsed.biasByAsset = parsed.biasByAsset.flatMap((b) => {
    const feature = featureMap.get(b.asset.toUpperCase());
    const side = b.bias === "long" || b.bias === "short" ? b.bias : null;
    if (!side) return [b];
    const state = feature?.perpMarketState;
    const match = state?.setupCandidates?.find((c) => c.side === side);
    const permission = state?.permission;
    const text = `${b.reason} ${b.invalidatesIf ?? ""} ${b.marketStructureSummary ?? ""}`;
    const blocked = !state || !match || permission === "avoid_new_risk" || permission === "wait_for_retest" || indicatorOnly(text);
    if (blocked) {
      console.warn(`[plan-compiler] rejected weak ${b.asset} ${side}: permission=${permission ?? "missing"} reason=${b.reason}`);
      return [];
    }
    return [{
      ...b,
      setupType: b.setupType ?? match.setupType,
      invalidationSource: b.invalidationSource ?? match.invalidationSource,
      marketStructureSummary: b.marketStructureSummary ?? state.brief,
      realizedVolPct1h: feature?.timeframes?.["1h"]?.realizedVolPct ?? b.realizedVolPct1h,
    }];
  });

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
