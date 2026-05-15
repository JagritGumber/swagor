import "server-only";

import { db } from "@/lib/db/client";
import { llmCalls } from "@/lib/db/schema";

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
};

/**
 * Append a row to llm_calls. Swallows errors so a logging failure never
 * propagates into the calling agent path. Audit data, not load-bearing.
 *
 * Caller is responsible for which context ids to attach (tickId, tradeId,
 * cycleId). Pass whichever apply; leave the rest undefined.
 */
export async function logLlmCall(input: LogLlmCallInput): Promise<void> {
  try {
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
    });
  } catch (err) {
    console.error("[llm-log] insert failed:", err);
  }
}
