import { pgTable, uuid, text, jsonb, timestamp } from "drizzle-orm/pg-core";
import { selboInstances } from "./selbo-instances";
import { monitorTicks } from "./monitor-ticks";

export const tickStages = pgTable("tick_stages", {
  id: uuid("id").primaryKey().defaultRandom(),
  selboInstanceId: uuid("selbo_instance_id")
    .notNull()
    .references(() => selboInstances.id, { onDelete: "cascade" }),
  tickId: uuid("tick_id")
    .notNull()
    .references(() => monitorTicks.id, { onDelete: "cascade" }),
  stage: text("stage").notNull(),
  status: text("status").notNull(),
  summary: text("summary").notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type TickStage = typeof tickStages.$inferSelect;
export type NewTickStage = typeof tickStages.$inferInsert;
