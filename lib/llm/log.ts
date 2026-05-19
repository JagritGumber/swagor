import "server-only";

import { db } from "@/lib/db/client";
import { llmCalls } from "@/lib/db/schema";
import { computeLlmCost } from "./rates";

export type LogLlmCallInput = {
  selboInstanceId?: string;
  tickId?: string;
  tradeId?: string;
  cycleId?: string;
  agentName: string;
  model: string;
  systemPrompt: string;
  userMessage: string;
  rawResponse: string;
  parsedOutput?: unknown;
  promptTokens?: number | null;
  completionTokens?: number | null;
  durationMs?: number | null;
};

/**
 * Append a row to llm_calls. Stamps cost_usd at insert time using the
 * per-model rate table in lib/llm/rates.ts so downstream cost queries
 * just sum a column (no rate guessing). Swallows errors so logging
 * failures never propagate into the calling agent path.
 */
export async function logLlmCall(input: LogLlmCallInput): Promise<void> {
  try {
    const costUsd = computeLlmCost(input.model, input.promptTokens, input.completionTokens);
    if (costUsd === null) {
      console.warn(`[llm-log] no rate registered for model="${input.model}"; cost_usd will be null`);
    }
    await db.insert(llmCalls).values({
      selboInstanceId: input.selboInstanceId ?? null,
      tickId: input.tickId ?? null,
      tradeId: input.tradeId ?? null,
      cycleId: input.cycleId ?? null,
      agentName: input.agentName,
      model: input.model,
      systemPrompt: input.systemPrompt,
      userMessage: input.userMessage,
      rawResponse: input.rawResponse,
      parsedOutput: (input.parsedOutput ?? null) as never,
      promptTokens: input.promptTokens ?? null,
      completionTokens: input.completionTokens ?? null,
      costUsd: costUsd !== null ? costUsd.toString() : null,
      durationMs: input.durationMs ?? null,
    });
  } catch (err) {
    console.error("[llm-log] insert failed:", err);
  }
}
