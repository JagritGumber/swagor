-- Add user feedback + soft-delete columns to memory_entries. Lets the
-- user thumbs-up / thumbs-down each lesson, or delete it; bad-rated and
-- deleted rows are filtered from future agent context reads.
-- Idempotent: ADD COLUMN IF NOT EXISTS.

ALTER TABLE memory_entries
  ADD COLUMN IF NOT EXISTS user_feedback text,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS memory_entries_user_id_created_at_idx
  ON memory_entries(user_id, created_at DESC)
  WHERE deleted_at IS NULL;

--> statement-breakpoint
ALTER TABLE memory_entries
  DROP CONSTRAINT IF EXISTS memory_entries_user_feedback_check;
ALTER TABLE memory_entries
  ADD CONSTRAINT memory_entries_user_feedback_check
  CHECK (user_feedback IS NULL OR user_feedback IN ('good', 'bad'));
