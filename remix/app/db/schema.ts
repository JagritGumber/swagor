import { index } from 'drizzle-orm/pg-core'
import { relations, sql } from 'drizzle-orm'
import { pgTable, uuid, text, numeric, boolean, jsonb, timestamp, real } from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  createdAt: timestamp('created_at').notNull(),
})

export const wallets = pgTable(
  'wallets',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    address: text('address').notNull().unique(),
    firstSeenAt: timestamp('first_seen_at').notNull(),
  },
  t => [
    index('wallets_user_id_idx').on(t.userId),
    index('wallets_address_lower_idx').on(sql`LOWER(${t.address})`),
  ],
)

export const circleWallets = pgTable(
  'circle_wallets',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    circleWalletId: text('circle_wallet_id').notNull().unique(),
    circleWalletAddress: text('circle_wallet_address').notNull(),
    createdAt: timestamp('created_at').notNull(),
  },
  t => [index('circle_wallets_user_id_idx').on(t.userId)],
)

const DEFAULT_WATCHLIST = ['ETH', 'BTC', 'SOL']

export const selboInstances = pgTable('selbo_instances', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull().unique(),
  circleWalletId: text('circle_wallet_id').notNull().unique(),
  circleWalletAddress: text('circle_wallet_address').notNull(),
  simulatedBalanceUsd: numeric('simulated_balance_usd', { precision: 20, scale: 6 })
    .notNull()
    .default('1000'),
  strategyText: text('strategy_text')
    .notNull()
    .default(
      'Moderate risk perp futures on Hyperliquid. Trade ETH and BTC. Cut losers fast, let winners run. No more than 3x leverage. Wait for clear setups, hold cash when uncertain.',
    ),
  strategyParsed: jsonb('strategy_parsed'),
  version: text('version').notNull().default('v1'),
  killSwitchActive: boolean('kill_switch_active').notNull().default(false),
  publicProfile: boolean('public_profile').notNull().default(false),
  username: text('username').unique(),
  nextWatcherAt: timestamp('next_watcher_at', { withTimezone: true }).defaultNow().notNull(),
  currentlyWatching: jsonb('currently_watching').$type<string[]>().notNull().default(DEFAULT_WATCHLIST),
  subscriptionTier: text('subscription_tier').notNull().default('free'),
  billingCustomerId: text('billing_customer_id').unique(),
  billingSubscriptionId: text('billing_subscription_id').unique(),
  externalWalletAddress: text('external_wallet_address').unique(),
  betaAccessGranted: boolean('beta_access_granted').notNull().default(false),
  betaGrantedAt: timestamp('beta_granted_at', { withTimezone: true }),
  tosAcceptedAt: timestamp('tos_accepted_at', { withTimezone: true }),
  erc8004TokenId: text('erc8004_token_id'),
  erc8004RegistrationTxHash: text('erc8004_registration_tx_hash'),
  betaInviteSentAt: timestamp('beta_invite_sent_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const judgmentTicks = pgTable('judgment_ticks', {
  id: uuid('id').primaryKey().defaultRandom(),
  selboInstanceId: uuid('selbo_instance_id')
    .references(() => selboInstances.id, { onDelete: 'cascade' }),
  asset: text('asset').notNull(),
  version: text('version').notNull(),
  side: text('side'),
  confidence: real('confidence'),
  reason: text('reason'),
  entryPrice: text('entry_price'),
  stopPrice: text('stop_price'),
  targetPrice: text('target_price'),
  invalidation: text('invalidation'),
  previousJudgmentId: uuid('previous_judgment_id'),
  tradeId: uuid('trade_id'),
  adminJudgment: boolean('admin_judgment').notNull().default(false),
  allJudgments: jsonb('all_judgments'),
  metricsSnapshot: jsonb('metrics_snapshot'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export type SelboInstance = typeof selboInstances.$inferSelect
export type JudgmentTick = typeof judgmentTicks.$inferSelect

export const usersRelations = relations(users, ({ many }) => ({
  wallets: many(wallets),
  circleWallets: many(circleWallets),
}))

export const walletsRelations = relations(wallets, ({ one }) => ({
  user: one(users, {
    fields: [wallets.userId],
    references: [users.id],
  }),
}))

export const circleWalletsRelations = relations(circleWallets, ({ one }) => ({
  user: one(users, {
    fields: [circleWallets.userId],
    references: [users.id],
  }),
}))

export const selboInstanceRelations = relations(selboInstances, ({ many }) => ({
  judgmentTicks: many(judgmentTicks),
}))

export const judgmentTickRelations = relations(judgmentTicks, ({ one }) => ({
  selboInstance: one(selboInstances, {
    fields: [judgmentTicks.selboInstanceId],
    references: [selboInstances.id],
  }),
  previousJudgment: one(judgmentTicks, {
    fields: [judgmentTicks.previousJudgmentId],
    references: [judgmentTicks.id],
    relationName: 'judgmentChain',
  }),
}))
