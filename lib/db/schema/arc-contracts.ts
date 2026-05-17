import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Global Arc contract registry. Replaces NEXT_PUBLIC_ANCHOR_CONTRACT_ADDRESS
 * and the hardcoded IdentityRegistry literal that lived in
 * register-erc8004.service.ts. One row per logical contract; address can be
 * updated without a redeploy by POSTing to /api/admin/arc-contracts.
 *
 * Per-anchor lookup is a direct SELECT (no in-memory cache) so updates
 * propagate immediately across all Vercel function instances. Postgres pool
 * is hot and the table is two rows; query cost is sub-ms.
 */
export const arcContracts = pgTable("arc_contracts", {
  key: text("key").primaryKey(),
  address: text("address").notNull(),
  label: text("label"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type ArcContract = typeof arcContracts.$inferSelect;
export type NewArcContract = typeof arcContracts.$inferInsert;
