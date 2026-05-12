import { pgTable, uuid, text, numeric, timestamp } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const portfolios = pgTable("portfolios", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id"), // references auth.users(id); FK declared in DB only (Supabase auth schema)
  mode: text("mode").notNull(), // 'paper' | 'live'
  baseCurrency: text("base_currency").default("USDC"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const positions = pgTable("positions", {
  id: uuid("id").primaryKey().defaultRandom(),
  portfolioId: uuid("portfolio_id").references(() => portfolios.id, { onDelete: "cascade" }),
  protocol: text("protocol").notNull(),
  chain: text("chain").notNull(),
  asset: text("asset").notNull(),
  amountUsdc: numeric("amount_usdc", { precision: 20, scale: 6 }).notNull(),
  entryApy: numeric("entry_apy", { precision: 8, scale: 4 }),
  enteredAt: timestamp("entered_at", { withTimezone: true }).defaultNow().notNull(),
  exitTxHash: text("exit_tx_hash"),
});

export const portfolioRelations = relations(portfolios, ({ many }) => ({
  positions: many(positions),
}));

export const positionRelations = relations(positions, ({ one }) => ({
  portfolio: one(portfolios, {
    fields: [positions.portfolioId],
    references: [portfolios.id],
  }),
}));

export type Portfolio = typeof portfolios.$inferSelect;
export type NewPortfolio = typeof portfolios.$inferInsert;
export type Position = typeof positions.$inferSelect;
export type NewPosition = typeof positions.$inferInsert;
