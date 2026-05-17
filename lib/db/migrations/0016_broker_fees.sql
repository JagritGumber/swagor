-- Slice 3: brokerage revenue line. Every closed paper trade triggers a
-- Circle USDC transfer from the user's wallet to the Selbo treasury for
-- min($0.10, sizeUsd * 2%). One broker_fees row per trade; the UNIQUE
-- index on trade_id makes chargeBrokerFee retry-safe.
--
-- Treasury wallet address goes into arc_contracts via the admin endpoint;
-- this migration only seeds the well-known USDC ERC-20 interface address.

CREATE TABLE IF NOT EXISTS broker_fees (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           text NOT NULL,
  trade_id          uuid REFERENCES trades(id) ON DELETE SET NULL,
  fee_usd           numeric(20, 6) NOT NULL,
  pnl_usd_at_close  numeric(20, 6),
  circle_tx_id      text,
  onchain_tx_hash   text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS broker_fees_trade_id_unique_idx
  ON broker_fees(trade_id) WHERE trade_id IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS broker_fees_user_id_idx
  ON broker_fees(user_id, created_at DESC);
--> statement-breakpoint
-- Partial index keeps the heartbeat poller scan O(pending) not O(rows).
CREATE INDEX IF NOT EXISTS broker_fees_pending_anchor_idx
  ON broker_fees(created_at)
  WHERE circle_tx_id IS NOT NULL AND onchain_tx_hash IS NULL;

--> statement-breakpoint
-- Well-known USDC ERC-20 interface on Arc Testnet. Public, immutable
-- per https://docs.arc.network/arc/references/contract-addresses.
INSERT INTO arc_contracts (key, address, label) VALUES
  ('usdc', '0x3600000000000000000000000000000000000000', 'USDC ERC-20 interface on Arc Testnet')
ON CONFLICT (key) DO NOTHING;
