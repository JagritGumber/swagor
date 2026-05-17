-- Global Arc contract registry. Replaces NEXT_PUBLIC_ANCHOR_CONTRACT_ADDRESS
-- env var and the hardcoded IdentityRegistry literal. One row per logical
-- contract. POST /api/admin/arc-contracts to set portfolio_decisions after
-- db:push (the IdentityRegistry seed below covers ERC-8004 out of the box).

CREATE TABLE IF NOT EXISTS arc_contracts (
  key        text PRIMARY KEY,
  address    text NOT NULL,
  label      text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

--> statement-breakpoint
-- Seed Arc's pre-deployed ERC-8004 IdentityRegistry. Public, well-known
-- address per https://docs.arc.network/arc/tutorials/register-your-first-ai-agent.
INSERT INTO arc_contracts (key, address, label) VALUES
  ('identity_registry', '0x8004A818BFB912233c491871b3d84c89A494BD9e', 'Arc ERC-8004 IdentityRegistry')
ON CONFLICT (key) DO NOTHING;
