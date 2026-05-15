-- Multi-turn strategy chat history. Each user-role row is a strategy
-- revision; the next selbo-role row is the LIGHT paraphrase reply.
-- Idempotent: CREATE TABLE IF NOT EXISTS + CREATE INDEX IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS strategy_revisions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     text NOT NULL,
  role        text NOT NULL,
  message     text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS strategy_revisions_user_id_created_at_idx
  ON strategy_revisions(user_id, created_at ASC);
