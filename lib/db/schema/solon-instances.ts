import { pgTable, uuid, text, numeric, boolean, jsonb, timestamp } from "drizzle-orm/pg-core";

/**
 * Per-user Solon instance. One row per signed-up user (user_id UNIQUE).
 * Stores the user's strategy preferences, kill switch, public profile toggle,
 * and links to their Circle Dev Wallet on Arc Testnet.
 *
 * The simulatedBalanceUsd is tracked independently of the on-chain wallet
 * balance — testnet faucet rate limits make it more reliable to track a
 * simulated balance in DB. The wallet still exists on-chain for anchor txs.
 */
export const solonInstances = pgTable("solon_instances", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().unique(), // FK to auth.users; Supabase enforces
  circleWalletId: text("circle_wallet_id").notNull().unique(),
  circleWalletAddress: text("circle_wallet_address").notNull(),
  simulatedBalanceUsd: numeric("simulated_balance_usd", { precision: 20, scale: 6 })
    .notNull()
    .default("1000"),
  strategyText: text("strategy_text")
    .notNull()
    .default(
      "Moderate risk. USDC stablecoin yield focus. Target 5-15% conviction trades. No leverage.",
    ),
  strategyParsed: jsonb("strategy_parsed"),
  killSwitchActive: boolean("kill_switch_active").notNull().default(false),
  publicProfile: boolean("public_profile").notNull().default(false),
  username: text("username").unique(), // for /solon/{username} public page
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type SolonInstance = typeof solonInstances.$inferSelect;
export type NewSolonInstance = typeof solonInstances.$inferInsert;
