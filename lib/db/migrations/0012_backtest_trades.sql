-- Simulated trades from a backtest. Populated by
-- simulateTradesForBacktest after a backtest_runs row hits 'completed'.
-- One row per trade the bias filter opened; entry + exit prices come
-- from daily Hyperliquid candles fetched across the run window.

CREATE TABLE IF NOT EXISTS backtest_trades (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  backtest_run_id    uuid NOT NULL,
  asset              text NOT NULL,
  side               text NOT NULL,
  entry_date         timestamptz NOT NULL,
  entry_price        numeric(30, 12) NOT NULL,
  exit_date          timestamptz,
  exit_price         numeric(30, 12),
  size_usd           numeric(20, 6) NOT NULL,
  pnl_usd            numeric(20, 6),
  pnl_pct            numeric(10, 4),
  bias_confidence    numeric(4, 3) NOT NULL,
  status             text NOT NULL,
  exit_reason        text
);

--> statement-breakpoint
ALTER TABLE backtest_trades
  DROP CONSTRAINT IF EXISTS backtest_trades_status_check;
ALTER TABLE backtest_trades
  ADD CONSTRAINT backtest_trades_status_check
  CHECK (status IN ('open', 'closed'));

--> statement-breakpoint
ALTER TABLE backtest_trades
  DROP CONSTRAINT IF EXISTS backtest_trades_side_check;
ALTER TABLE backtest_trades
  ADD CONSTRAINT backtest_trades_side_check
  CHECK (side IN ('long', 'short'));

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS backtest_trades_run_id_idx
  ON backtest_trades(backtest_run_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS backtest_trades_run_id_entry_date_idx
  ON backtest_trades(backtest_run_id, entry_date);
