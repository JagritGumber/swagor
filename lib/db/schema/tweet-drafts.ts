import { pgTable, uuid, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { trades } from "./trades";

/**
 * Auto-tweet drafts generated when a settled trade has |PnL%| > 5 or is
 * the first trade of day, AND the user's profile is public.
 * v1: drafts logged to DB + console (manual retweet by Jagrit).
 * v1.5: post via Twitter API v2 if TWITTER_BEARER_TOKEN is set.
 */
export const tweetDrafts = pgTable("tweet_drafts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  tradeId: uuid("trade_id").references(() => trades.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  posted: boolean("posted").notNull().default(false),
  postedAt: timestamp("posted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const tweetDraftRelations = relations(tweetDrafts, ({ one }) => ({
  trade: one(trades, {
    fields: [tweetDrafts.tradeId],
    references: [trades.id],
  }),
}));

export type TweetDraft = typeof tweetDrafts.$inferSelect;
export type NewTweetDraft = typeof tweetDrafts.$inferInsert;
