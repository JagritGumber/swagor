import { defineConfig } from "drizzle-kit";
import "dotenv/config";

export default defineConfig({
  schema: "./lib/db/schema",
  out: "./lib/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
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
  ],
  verbose: true,
  strict: true,
});
