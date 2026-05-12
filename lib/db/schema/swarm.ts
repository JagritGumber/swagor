import { pgTable, uuid, text, integer, numeric, jsonb, timestamp } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { rebalanceCycles } from "./cycles";

export const swarmRounds = pgTable("swarm_rounds", {
  id: uuid("id").primaryKey().defaultRandom(),
  cycleId: uuid("cycle_id").references(() => rebalanceCycles.id, { onDelete: "cascade" }),
  roundNumber: integer("round_number").notNull(),
  personaId: text("persona_id").notNull(),
  proposedAllocation: jsonb("proposed_allocation").notNull(),
  reasoning: text("reasoning").notNull(),
  confidence: numeric("confidence"),
  reactedToRound: integer("reacted_to_round"),
  tokensIn: integer("tokens_in"),
  tokensOut: integer("tokens_out"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const aggregations = pgTable("aggregations", {
  id: uuid("id").primaryKey().defaultRandom(),
  cycleId: uuid("cycle_id").references(() => rebalanceCycles.id, { onDelete: "cascade" }),
  recommendedAllocation: jsonb("recommended_allocation").notNull(),
  dispersion: numeric("dispersion"),
  clusterSummary: jsonb("cluster_summary"),
  keyDrivers: jsonb("key_drivers"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const swarmRoundRelations = relations(swarmRounds, ({ one }) => ({
  cycle: one(rebalanceCycles, {
    fields: [swarmRounds.cycleId],
    references: [rebalanceCycles.id],
  }),
}));

export const aggregationRelations = relations(aggregations, ({ one }) => ({
  cycle: one(rebalanceCycles, {
    fields: [aggregations.cycleId],
    references: [rebalanceCycles.id],
  }),
}));

export type SwarmRound = typeof swarmRounds.$inferSelect;
export type NewSwarmRound = typeof swarmRounds.$inferInsert;
export type Aggregation = typeof aggregations.$inferSelect;
export type NewAggregation = typeof aggregations.$inferInsert;
