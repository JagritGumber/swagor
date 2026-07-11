import { relations, sql } from 'drizzle-orm'
import {
  pgTable,
  uuid,
  text,
  numeric,
  boolean,
  jsonb,
  timestamp,
  real,
  integer,
  pgEnum,
  index,
} from 'drizzle-orm/pg-core'

// ─── Enums ────────────────────────────────────────────

export const agentModeEnum = pgEnum('agent_mode', ['live', 'paper', 'simulation'])
export const decisionActionEnum = pgEnum('decision_action', ['long', 'short', 'no_trade'])
export const convictionEnum = pgEnum('conviction', ['low', 'medium', 'high'])
export const evidenceCategoryEnum = pgEnum('evidence_category', [
  'regime',
  'volume_profile',
  'orderflow',
  'price_level',
  'liquidity',
  'tape',
  'volatility',
  'funding',
  'open_interest',
])
export const evidenceStanceEnum = pgEnum('evidence_stance', ['supporting', 'contradicting'])
export const executionStatusEnum = pgEnum('execution_status', ['pending', 'filled', 'cancelled', 'expired'])
export const outcomeStatusEnum = pgEnum('outcome_status', ['win', 'loss', 'breakeven', 'invalidated', 'expired'])

// ─── Users ────────────────────────────────────────────

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  createdAt: timestamp('created_at').notNull(),
})

// ─── User wallets (auth - the wallet the human connects) ──

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

// ─── Agents ───────────────────────────────────────────

export const agents = pgTable('agents', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id)
    .unique(),
  mode: agentModeEnum('mode').notNull().default('paper'),
  enabled: boolean('enabled').notNull().default(true),
  version: text('version').notNull().default('v1'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

// ─── Agent wallets (optional - only when mode = live) ──

export const agentWallets = pgTable('agent_wallets', {
  id: uuid('id').primaryKey().defaultRandom(),
  agentId: uuid('agent_id')
    .notNull()
    .references(() => agents.id, { onDelete: 'cascade' })
    .unique(),
  circleWalletId: text('circle_wallet_id'),
  circleWalletAddress: text('circle_wallet_address'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

// ─── Decisions ────────────────────────────────────────

export const decisions = pgTable('decisions', {
  id: uuid('id').primaryKey().defaultRandom(),
  agentId: uuid('agent_id')
    .notNull()
    .references(() => agents.id, { onDelete: 'cascade' }),
  decidedAt: timestamp('decided_at', { withTimezone: true }).defaultNow().notNull(),
  action: decisionActionEnum('action').notNull(),
  asset: text('asset').notNull(),
  entry: real('entry'),
  stop: real('stop'),
  target: real('target'),
  invalidation: text('invalidation'),
  conviction: convictionEnum('conviction').notNull(),
  thesis: text('thesis'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, t => [
  index('decisions_agent_id_idx').on(t.agentId),
  index('decisions_decided_at_idx').on(t.decidedAt),
])

// ─── Evidence ─────────────────────────────────────────

export const evidence = pgTable('evidence', {
  id: uuid('id').primaryKey().defaultRandom(),
  decisionId: uuid('decision_id')
    .notNull()
    .references(() => decisions.id, { onDelete: 'cascade' }),
  category: evidenceCategoryEnum('category').notNull(),
  title: text('title').notNull(),
  value: text('value').notNull(),
  stance: evidenceStanceEnum('stance').notNull(),
}, t => [
  index('evidence_decision_id_idx').on(t.decisionId),
])

// ─── Executions ───────────────────────────────────────

export const executions = pgTable('executions', {
  id: uuid('id').primaryKey().defaultRandom(),
  decisionId: uuid('decision_id')
    .notNull()
    .references(() => decisions.id, { onDelete: 'cascade' }),
  executedPrice: real('executed_price').notNull(),
  executedAt: timestamp('executed_at', { withTimezone: true }).notNull(),
  txHash: text('tx_hash'),
  status: executionStatusEnum('status').notNull().default('pending'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, t => [
  index('executions_decision_id_idx').on(t.decisionId),
])

// ─── Outcomes ─────────────────────────────────────────

export const outcomes = pgTable('outcomes', {
  id: uuid('id').primaryKey().defaultRandom(),
  executionId: uuid('execution_id')
    .notNull()
    .references(() => executions.id, { onDelete: 'cascade' })
    .unique(),
  status: outcomeStatusEnum('status').notNull(),
  exitPrice: real('exit_price'),
  pnl: real('pnl'),
  closedAt: timestamp('closed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

// ─── Relations ────────────────────────────────────────

export const usersRelations = relations(users, ({ many }) => ({
  wallets: many(wallets),
  agents: many(agents),
}))

export const walletsRelations = relations(wallets, ({ one }) => ({
  user: one(users, {
    fields: [wallets.userId],
    references: [users.id],
  }),
}))

export const agentsRelations = relations(agents, ({ one, many }) => ({
  user: one(users, {
    fields: [agents.userId],
    references: [users.id],
  }),
  wallet: one(agentWallets),
  decisions: many(decisions),
}))

export const agentWalletsRelations = relations(agentWallets, ({ one }) => ({
  agent: one(agents, {
    fields: [agentWallets.agentId],
    references: [agents.id],
  }),
}))

export const decisionsRelations = relations(decisions, ({ one, many }) => ({
  agent: one(agents, {
    fields: [decisions.agentId],
    references: [agents.id],
  }),
  evidence: many(evidence),
  execution: one(executions),
}))

export const evidenceRelations = relations(evidence, ({ one }) => ({
  decision: one(decisions, {
    fields: [evidence.decisionId],
    references: [decisions.id],
  }),
}))

export const executionsRelations = relations(executions, ({ one }) => ({
  decision: one(decisions, {
    fields: [executions.decisionId],
    references: [decisions.id],
  }),
  outcome: one(outcomes),
}))

export const outcomesRelations = relations(outcomes, ({ one }) => ({
  execution: one(executions, {
    fields: [outcomes.executionId],
    references: [executions.id],
  }),
}))

// ─── Types ────────────────────────────────────────────

// Select types (what comes out of the DB)
export type SelectUser = typeof users.$inferSelect
export type SelectAgent = typeof agents.$inferSelect
export type SelectAgentWallet = typeof agentWallets.$inferSelect
export type SelectDecision = typeof decisions.$inferSelect
export type SelectEvidence = typeof evidence.$inferSelect
export type SelectExecution = typeof executions.$inferSelect
export type SelectOutcome = typeof outcomes.$inferSelect

// Insert types (what goes into the DB)
export type InsertUser = typeof users.$inferInsert
export type InsertAgent = typeof agents.$inferInsert
export type InsertAgentWallet = typeof agentWallets.$inferInsert
export type InsertDecision = typeof decisions.$inferInsert
export type InsertEvidence = typeof evidence.$inferInsert
export type InsertExecution = typeof executions.$inferInsert
export type InsertOutcome = typeof outcomes.$inferInsert
