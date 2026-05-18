-- Some entries in arc_contracts are wallets we control (e.g. seed_wallet
-- used to fund new users at signup) and need a Circle wallet id to send
-- FROM. The address alone is enough for receive-only entries
-- (treasury_wallet, identity_registry, usdc, portfolio_decisions).

ALTER TABLE arc_contracts
  ADD COLUMN IF NOT EXISTS wallet_id text;
