import { pgTable, uuid, text, integer, numeric, jsonb, timestamp } from "drizzle-orm/pg-core";

/**
 * Every LLM invocation Selbo makes gets a row here: system prompt, user
 * message, raw response, parsed output, token counts, and links to the
 * context (Selbo instance, watcher tick, trade, cycle). Admin-only
 * surface; not exposed to regular users.
 *
 * Foreign keys are application-level (uuid columns, no constraints) so a
 * tick or trade can be deleted independently without cascading; rows here
 * are append-only audit data anyway.
 */
export const llmCalls = pgTable("llm_calls", {
  id: uuid("id").primaryKey().defaultRandom(),
  selboInstanceId: uuid("selbo_instance_id"),
  tickId: uuid("tick_id"),
  tradeId: uuid("trade_id"),
  cycleId: uuid("cycle_id"),
  agentName: text("agent_name").notNull(),
  model: text("model").notNull(),
  systemPrompt: text("system_prompt").notNull(),
  userMessage: text("user_message").notNull(),
  rawResponse: text("raw_response").notNull(),
  parsedOutput: jsonb("parsed_output"),
  promptTokens: integer("prompt_tokens"),
  completionTokens: integer("completion_tokens"),
  // Per-call cost in USD, computed at log time using lib/llm/rates.ts.
  // NULL for legacy rows or models not registered in the rate table.
  costUsd: numeric("cost_usd", { precision: 20, scale: 8 }),
  // Wall-clock duration of the LLM call in milliseconds. Caller-measured
  // around the chat.completions.create call. NULL on rows written before
  // this field was added (use createdAt as a rough proxy in queries).
  durationMs: integer("duration_ms"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type LlmCall = typeof llmCalls.$inferSelect;
export type NewLlmCall = typeof llmCalls.$inferInsert;
