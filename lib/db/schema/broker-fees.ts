import { pgTable, uuid, text, numeric, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { trades } from "./trades";

/**
 * Broker-fee ledger. One row per closed paper trade where Selbo collected
 * its `min($0.10, sizeUsd * 2%)` cut as a USDC transfer from the user's
 * Circle wallet to the Selbo treasury wallet. The UNIQUE index on
 * `tradeId` enforces idempotency: chargeBrokerFee can be retried safely
 * after a Circle hiccup; the second call sees a conflict and short-circuits.
 *
 * `circleTxId` is filled when the transfer is queued; `onchainTxHash` is
 * backfilled by pollPendingAnchors once Circle reports state=COMPLETE
 * (same heartbeat that resolves the anchor hashes).
 */
export const brokerFees = pgTable("broker_fees", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  tradeId: uuid("trade_id").references(() => trades.id, { onDelete: "set null" }),
  feeUsd: numeric("fee_usd", { precision: 20, scale: 6 }).notNull(),
  pnlUsdAtClose: numeric("pnl_usd_at_close", { precision: 20, scale: 6 }),
  circleTxId: text("circle_tx_id"),
  onchainTxHash: text("onchain_tx_hash"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  tradeIdUnique: uniqueIndex("broker_fees_trade_id_unique_idx").on(table.tradeId),
  userIdIdx: index("broker_fees_user_id_idx").on(table.userId),
}));

export type BrokerFee = typeof brokerFees.$inferSelect;
export type NewBrokerFee = typeof brokerFees.$inferInsert;
