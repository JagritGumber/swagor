import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";

export const selboInstances = pgTable("selbo_instances", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type SelboInstance = typeof selboInstances.$inferSelect;
export type NewSelboInstance = typeof selboInstances.$inferInsert;
