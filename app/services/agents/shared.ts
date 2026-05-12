import { z } from "zod";
import { llm, MODELS, type ModelTier } from "@/lib/llm-client";
import { db } from "@/lib/db/client";
import { agentReasoning } from "@/lib/db/schema";

export type AgentCallOpts<TOutput> = {
  agentName: string;
  cycleId: string;
  tier?: ModelTier;
  systemPrompt: string;
  userMessage: string;
  schema: z.ZodSchema<TOutput>;
  temperature?: number;
};

/**
 * Shared LLM-call helper used by every agent.
 *  - Calls the configured provider (GLM default) with JSON-output mode
 *  - Validates the raw response against a zod schema
 *  - Persists input/output/token-counts to agent_reasoning for the cycle trace
 *  - Returns the validated, typed object
 *
 * Errors thrown by JSON parse / zod validation should be caught by the
 * orchestrator and recorded as a failed cycle.
 */
export async function callAgent<TOutput>(opts: AgentCallOpts<TOutput>): Promise<TOutput> {
  const tier = opts.tier ?? "LIGHT";
  const model = MODELS[tier];

  const response = await llm.chat.completions.create({
    model,
    messages: [
      { role: "system", content: opts.systemPrompt },
      { role: "user", content: opts.userMessage },
    ],
    response_format: { type: "json_object" },
    temperature: opts.temperature ?? 0.3,
  });

  const raw = response.choices[0]?.message?.content;
  if (!raw) {
    throw new Error(`Agent ${opts.agentName} returned no content`);
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    throw new Error(
      `Agent ${opts.agentName} returned invalid JSON: ${raw.slice(0, 200)}`,
    );
  }

  const validated = opts.schema.parse(parsedJson);

  await db.insert(agentReasoning).values({
    cycleId: opts.cycleId,
    agentName: opts.agentName,
    model,
    input: { systemPrompt: opts.systemPrompt, userMessage: opts.userMessage },
    output: validated as object,
    promptTokens: response.usage?.prompt_tokens,
    completionTokens: response.usage?.completion_tokens,
  });

  return validated;
}
