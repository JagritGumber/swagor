import { pgTable, uuid, text, numeric, jsonb, timestamp } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { monitorTicks } from "./monitor-ticks";

/**
 * A trade proposal emitted by Selbo's HEAVY-tier LLM call, gated by a
 * monitor tick with hasSignal=true. Captures the proposed action + venue +
 * sizing + reasoning before the reviewer council debates it.
 *
 * One proposal triggers: 3 reviewers (round 1) + 3 reviewers (round 2
 * adversarial) + 1 synthesis writer + 1 critic call.
 */
export const tradeProposals = pgTable("trade_proposals", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  monitorTickId: uuid("monitor_tick_id").references(() => monitorTicks.id, {
    onDelete: "set null",
  }),
  asset: text("asset").notNull(),
  side: text("side").notNull(), // 'buy' | 'sell' | 'rotate_into' | 'rotate_out' | 'park_usyc'
  sizeUsd: numeric("size_usd", { precision: 20, scale: 6 }).notNull(),
  venue: text("venue").notNull(),
  expectedPnlPct: numeric("expected_pnl_pct"),
  reasoningTrace: text("reasoning_trace").notNull(),
  safetyTriggers: jsonb("safety_triggers").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const tradeProposalRelations = relations(tradeProposals, ({ one }) => ({
  monitorTick: one(monitorTicks, {
    fields: [tradeProposals.monitorTickId],
    references: [monitorTicks.id],
  }),
}));

export type TradeProposal = typeof tradeProposals.$inferSelect;
export type NewTradeProposal = typeof tradeProposals.$inferInsert;
