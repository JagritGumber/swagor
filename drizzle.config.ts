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
  // Restrict drizzle to our tables only. Leaves existing arc-escrow tables
  // (profiles, wallets, transactions, escrow_agreements, etc.) untouched.
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
    // Solon v4
    "solon_instances",
    "monitor_ticks",
    "trade_proposals",
    "trades",
    "memory_entries",
    "reviewer_track_records",
    "tweet_drafts",
    // Better Auth
    "user",
    "session",
    "account",
    "verification",
  ],
  verbose: true,
  strict: true,
});
