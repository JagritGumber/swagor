import {
  pgTable,
  text,
  integer,
  real,
  jsonb,
  timestamp,
  varchar,
  primaryKey,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { user } from "./auth";

/**
 * Per-user, per-(recordKind, recordKey) aggregated trade outcomes -- the
 * Selbo agent's actual learning primitive. Replaces the prose-lessons system
 * that the agent rationalized around. See the Setup-Fingerprint Learning
 * Primitive section of C:\Users\jagri\.claude\plans\better-path-phase-radiant-koala.md.
 *
 * recordKind:
 *   - 'fingerprint': recordKey is asset|side|valueLocation|volumeState|oiFlow|fundingState
 *   - 'asset_side':  recordKey is asset|side (coarser, fills in faster, fallback when fingerprint sample is thin)
 *
 * One row per (userId, recordKind, recordKey). Atomically upserted on every
 * trade close via drizzle onConflictDoUpdate -- concurrent closes on the
 * same key cannot drop counts.
 *
 * Exposed to the agent only when trades >= MIN_TRADES_TO_EXPOSE (see
 * app/services/setup-fingerprint/index.ts). Below threshold the lookup
 * returns null. The prompt does NOT ask the agent to self-restrain on
 * low-sample data, the data simply isn't there until it's meaningful.
 *
 * sumR is nullable: null until at least one trade in this record had a
 * correctly-sided non-zero stop. Garbage stops (wrong-side or missing)
 * cannot poison avg_r.
 *
 * lastFive is varchar(5), NOT char(5): Postgres char blank-pads which would
 * corrupt the W/L ring buffer.
 *
 * userId FK is stricter than the existing trades.userId (which has none);
 * we add it here because aggregated records should not outlive their user.
 */
type LossesByReason = { stop: number; liquidation: number; manual: number; time: number };

export const setupRecords = pgTable(
  "setup_records",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    recordKind: text("record_kind").notNull(),
    recordKey: text("record_key").notNull(),
    trades: integer("trades").notNull().default(0),
    wins: integer("wins").notNull().default(0),
    losses: integer("losses").notNull().default(0),
    // sumR is summed over r_trades only (trades with a valid stop). avg_r =
    // sumR / rTrades, NOT sumR / trades -- garbage-stop trades must not
    // dilute the risk-normalized aggregate.
    sumR: real("sum_r"),
    rTrades: integer("r_trades").notNull().default(0),
    lossesByReason: jsonb("losses_by_reason")
      .$type<LossesByReason>()
      .notNull()
      .default(sql`'{"stop":0,"liquidation":0,"manual":0,"time":0}'::jsonb`),
    winsAfterStateShift: integer("wins_after_state_shift").notNull().default(0),
    lossesAfterStateShift: integer("losses_after_state_shift").notNull().default(0),
    lastFive: varchar("last_five", { length: 5 }).notNull().default(""),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.recordKind, table.recordKey] }),
    recordKindCheck: check(
      "setup_records_record_kind_check",
      sql`${table.recordKind} IN ('fingerprint', 'asset_side')`,
    ),
  }),
);

export type SetupRecord = typeof setupRecords.$inferSelect;
export type NewSetupRecord = typeof setupRecords.$inferInsert;
export type SetupRecordKind = "fingerprint" | "asset_side";
export type { LossesByReason };
