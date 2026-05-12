import { pgTable, uuid, text, numeric, integer, jsonb, timestamp, customType, unique } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { rebalanceCycles } from "./cycles";

// Custom pgvector type — Supabase has the pgvector extension enabled.
// drizzle-kit will need `CREATE EXTENSION IF NOT EXISTS vector;` first.
export const vector = (name: string, opts: { dimensions: number }) =>
  customType<{ data: number[]; driverData: string }>({
    dataType() {
      return `vector(${opts.dimensions})`;
    },
    toDriver(value) {
      return `[${value.join(",")}]`;
    },
    fromDriver(value) {
      return JSON.parse(value as string);
    },
  })(name);

export const nodes = pgTable(
  "nodes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    nodeType: text("node_type").notNull(), // 'protocol' | 'chain' | 'asset' | 'event' | 'entity'
    label: text("label").notNull(),
    properties: jsonb("properties").default({}),
    embedding: vector("embedding", { dimensions: 1536 }),
    firstSeen: timestamp("first_seen", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    uniqueTypeLabel: unique().on(table.nodeType, table.label),
  })
);

export const edges = pgTable("edges", {
  id: uuid("id").primaryKey().defaultRandom(),
  fromNode: uuid("from_node").references(() => nodes.id, { onDelete: "cascade" }),
  toNode: uuid("to_node").references(() => nodes.id, { onDelete: "cascade" }),
  relation: text("relation").notNull(), // 'depends_on' | 'correlates_with' | 'exclusive_with' | 'causes' | 'belongs_to'
  weight: numeric("weight").default("1.0"),
  properties: jsonb("properties").default({}),
  observedAt: timestamp("observed_at", { withTimezone: true }).defaultNow().notNull(),
  observedInCycle: uuid("observed_in_cycle").references(() => rebalanceCycles.id),
});

export const graphSnapshots = pgTable("graph_snapshots", {
  id: uuid("id").primaryKey().defaultRandom(),
  cycleId: uuid("cycle_id").references(() => rebalanceCycles.id, { onDelete: "cascade" }),
  snapshotHash: text("snapshot_hash").notNull(),
  nodeCount: integer("node_count"),
  edgeCount: integer("edge_count"),
  snapshotAt: timestamp("snapshot_at", { withTimezone: true }).defaultNow().notNull(),
});

export const edgeRelations = relations(edges, ({ one }) => ({
  from: one(nodes, { fields: [edges.fromNode], references: [nodes.id], relationName: "from_node" }),
  to: one(nodes, { fields: [edges.toNode], references: [nodes.id], relationName: "to_node" }),
}));

export type Node = typeof nodes.$inferSelect;
export type NewNode = typeof nodes.$inferInsert;
export type Edge = typeof edges.$inferSelect;
export type NewEdge = typeof edges.$inferInsert;
export type GraphSnapshot = typeof graphSnapshots.$inferSelect;
