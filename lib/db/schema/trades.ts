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
  // Text type because Better Auth issues nanoid-format user IDs.
  userId: text("user_id").notNull(),
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
  // Circle's internal transaction id, returned synchronously when the
  // anchor SDK call is queued. We poll Circle for state=COMPLETE and
  // backfill `arcOnchainTxHash` once the tx is mined on Arc.
  arcAnchorTx: text("arc_anchor_tx"),
  arcOnchainTxHash: text("arc_onchain_tx_hash"),
  // Safety levels set by the agent that opened the trade. The watcher
  // tick handler runs an enforcement scan against current Hyperliquid
  // mid; when mark crosses a level, the position is closed automatically
  // and `safetyTriggerReason` records which trigger fired.
  stopLossPriceUsd: numeric("stop_loss_price_usd", { precision: 30, scale: 12 }),
  takeProfitPriceUsd: numeric("take_profit_price_usd", { precision: 30, scale: 12 }),
  safetyTriggerReason: text("safety_trigger_reason"),
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
