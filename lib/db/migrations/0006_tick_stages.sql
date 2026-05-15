CREATE TABLE IF NOT EXISTS tick_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  selbo_instance_id uuid NOT NULL REFERENCES selbo_instances(id) ON DELETE CASCADE,
  tick_id uuid NOT NULL REFERENCES monitor_ticks(id) ON DELETE CASCADE,
  stage text NOT NULL,
  status text NOT NULL,
  summary text NOT NULL,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tick_stages_instance_tick_created_idx
  ON tick_stages (selbo_instance_id, tick_id, created_at);
