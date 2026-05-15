-- Add llm_calls table. Every LLM invocation Selbo makes records one row
-- here (system prompt, user message, raw response, parsed output, tokens,
-- links to instance / tick / trade / cycle). Admin-only audit surface.
--
-- Apply before deploying code that calls logLlmCall.
-- Idempotent: CREATE TABLE IF NOT EXISTS + CREATE INDEX IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS llm_calls (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  selbo_instance_id   uuid,
  tick_id             uuid,
  trade_id            uuid,
  cycle_id            uuid,
  agent_name          text NOT NULL,
  model               text NOT NULL,
  system_prompt       text NOT NULL,
  user_message        text NOT NULL,
  raw_response        text NOT NULL,
  parsed_output       jsonb,
  prompt_tokens       integer,
  completion_tokens   integer,
  created_at          timestamptz NOT NULL DEFAULT now()
);

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS llm_calls_tick_id_idx
  ON llm_calls(tick_id) WHERE tick_id IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS llm_calls_trade_id_idx
  ON llm_calls(trade_id) WHERE trade_id IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS llm_calls_cycle_id_idx
  ON llm_calls(cycle_id) WHERE cycle_id IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS llm_calls_selbo_instance_id_idx
  ON llm_calls(selbo_instance_id) WHERE selbo_instance_id IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS llm_calls_created_at_idx
  ON llm_calls(created_at DESC);
