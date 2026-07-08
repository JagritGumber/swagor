import { pgTable, uuid, text, numeric, boolean, jsonb, timestamp } from "drizzle-orm/pg-core";

const DEFAULT_WATCHLIST = ["ETH", "BTC", "SOL"];

/**
 * Per-user Selbo instance. One row per signed-up user (user_id UNIQUE).
 * Stores the user's strategy preferences, kill switch, public profile toggle,
 * and links to their Circle Dev Wallet on Arc Testnet.
 *
 * The simulatedBalanceUsd is tracked independently of the on-chain wallet
 * balance — testnet faucet rate limits make it more reliable to track a
 * simulated balance in DB. The wallet still exists on-chain for anchor txs.
 */
export const selboInstances = pgTable("selbo_instances", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Text type because Better Auth issues nanoid-format user IDs.
  // FK is application-level (Better Auth user.id) rather than DB-enforced.
  userId: text("user_id").notNull().unique(),
  circleWalletId: text("circle_wallet_id").notNull().unique(),
  circleWalletAddress: text("circle_wallet_address").notNull(),
  simulatedBalanceUsd: numeric("simulated_balance_usd", { precision: 20, scale: 6 })
    .notNull()
    .default("1000"),
  strategyText: text("strategy_text")
    .notNull()
    .default(
      "Moderate risk perp futures on Hyperliquid. Trade ETH and BTC. Cut losers fast, let winners run. No more than 3x leverage. Wait for clear setups, hold cash when uncertain.",
    ),
  strategyParsed: jsonb("strategy_parsed"),
  version: text("version").notNull().default("v1"),
  killSwitchActive: boolean("kill_switch_active").notNull().default(false),
  publicProfile: boolean("public_profile").notNull().default(false),
  username: text("username").unique(), // for /selbo/{username} public page
  // Watcher: when next watcher tick is due, and the symbols currently in scope.
  // Set by the watcher agent itself; not a hardcoded interval.
  nextWatcherAt: timestamp("next_watcher_at", { withTimezone: true }).defaultNow().notNull(),
  currentlyWatching: jsonb("currently_watching").$type<string[]>().notNull().default(DEFAULT_WATCHLIST),
  // Subscription tier — gates watcher cadence floor, panel deliberations,
  // public profile, max Selbo count. Matrix in lib/tiers.ts. Billing
  // customer + subscription IDs persisted so the webhook can map events
  // back to the right instance without a user_id lookup. Provider-neutral
  // column names because the billing vendor (currently Polar) may change.
  subscriptionTier: text("subscription_tier").notNull().default("free"),
  billingCustomerId: text("billing_customer_id").unique(),
  billingSubscriptionId: text("billing_subscription_id").unique(),
  // External wallet linked at signup via SIWE-style signature. Unique so one
  // wallet maps to exactly one account (Sybil resistance). Null until the
  // user completes /verify-wallet; dashboard redirects them there if null.
  externalWalletAddress: text("external_wallet_address").unique(),
  // Private-beta gate. When the BETA_CODE env is set, new signups land
  // ungranted; redeeming a matching code via /api/beta/redeem flips this
  // to true and unlocks watcher + orchestrator LLM calls for the user.
  // When BETA_CODE is unset, ensureSelboInstance auto-grants on signup.
  betaAccessGranted: boolean("beta_access_granted").notNull().default(false),
  betaGrantedAt: timestamp("beta_granted_at", { withTimezone: true }),
  // Terms-of-service / paper-mode disclaimer acceptance. Null until the
  // user accepts the gate on first dashboard load. See M10 in
  // C:\Users\jagri\.claude\plans\better-path-phase-radiant-koala.md.
  tosAcceptedAt: timestamp("tos_accepted_at", { withTimezone: true }),
  // ERC-8004 agent identity: each instance mints its own NFT on the Arc
  // IdentityRegistry at signup, signed by the user's Circle wallet.
  // Fire-and-forget background job; null until the registration lands.
  erc8004TokenId: text("erc8004_token_id"),
  erc8004RegistrationTxHash: text("erc8004_registration_tx_hash"),
  // When the admin sent the beta-invite email containing the BETA_CODE.
  // Set by POST /api/admin/waitlist/invite. Null until invited.
  betaInviteSentAt: timestamp("beta_invite_sent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type SelboInstance = typeof selboInstances.$inferSelect;
export type NewSelboInstance = typeof selboInstances.$inferInsert;
