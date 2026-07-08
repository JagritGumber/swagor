import { defineConfig } from "drizzle-kit";
import { config } from "dotenv";

// Load .env.local (Next.js convention); plain dotenv defaults to .env only.
config({ path: ".env.local" });

export default defineConfig({
  schema: "./lib/db/schema",
  out: "./lib/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    // For migrations we want the DIRECT connection (port 5432), not the
    // pooler (6543). pgbouncer in transaction mode breaks the long-lived
    // sessions drizzle-kit uses for schema introspection.
    // Falls back to DATABASE_URL if DIRECT_URL isn't set.
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL!,
  },
  // Restrict drizzle to our tables only. Any other tables that exist in the
  // database (from prior tenants of this Supabase project) are left untouched.
  tablesFilter: [
    "portfolios",
    "positions",
    "rebalance_cycles",
    "agent_reasoning",
    "market_snapshots",
    "nodes",
    "edges",
    "graph_snapshots",
    "swarm_rounds",
    "aggregations",
    // Selbo
    "selbo_instances",
    "monitor_ticks",
    "trade_proposals",
    "trades",
    "setup_records",
    "tweet_drafts",
    "llm_calls",
    "equity_snapshots",
    "strategy_revisions",
    "tick_stages",
    "judgment_ticks",
    "daily_plans",
    "backtest_runs",
    "backtest_trades",
    "arc_contracts",
    "broker_fees",
    // Better Auth
    "user",
    "session",
    "account",
    "verification",
  ],
  verbose: true,
  strict: true,
});
