import {
  pgTable,
  uuid,
  text,
  numeric,
  timestamp,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { tradeProposals } from "./trade-proposals";

/**
 * A trade — entry or exit. Entry trades reference a tradeProposal; exit
 * trades reference their entry via parentTradeId. PnL computed at close.
 *
 * Mode is 'simulation' for hackathon (executor simulates against Uniswap
 * pool spot prices). Future v1.5 may add 'live' mode for real on-chain
 * execution via Circle Wallet `executeContract`.
 */
export const trades = pgTable("trades", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  proposalId: uuid("proposal_id").references(() => tradeProposals.id, {
    onDelete: "set null",
  }),
  parentTradeId: uuid("parent_trade_id").references(
    (): AnyPgColumn => trades.id,
    { onDelete: "set null" },
  ),
  asset: text("asset").notNull(),
  venue: text("venue").notNull(),
  side: text("side").notNull(),
  amountUsd: numeric("amount_usd", { precision: 20, scale: 6 }).notNull(),
  entryPrice: numeric("entry_price", { precision: 30, scale: 12 }),
  exitPrice: numeric("exit_price", { precision: 30, scale: 12 }),
  pnlUsd: numeric("pnl_usd", { precision: 20, scale: 6 }),
  status: text("status").notNull(), // 'pending' | 'open' | 'closed' | 'failed'
  mode: text("mode").notNull().default("simulation"), // 'simulation' | 'live'
  simulatedTxHash: text("simulated_tx_hash"),
  failureReason: text("failure_reason"),
  arcAnchorTx: text("arc_anchor_tx"),
  openedAt: timestamp("opened_at", { withTimezone: true }),
  closedAt: timestamp("closed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const tradeRelations = relations(trades, ({ one }) => ({
  proposal: one(tradeProposals, {
    fields: [trades.proposalId],
    references: [tradeProposals.id],
  }),
}));

export type Trade = typeof trades.$inferSelect;
export type NewTrade = typeof trades.$inferInsert;
