-- Track when an admin sent the beta-invite email to a waitlisted user,
-- so /api/admin/waitlist can show "invited yyyy-mm-dd" vs "still waiting"
-- and the admin doesn't double-send the same invite by mistake.

ALTER TABLE selbo_instances
  ADD COLUMN IF NOT EXISTS beta_invite_sent_at timestamptz;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS selbo_instances_beta_waitlist_idx
  ON selbo_instances(created_at)
  WHERE beta_access_granted = false;
