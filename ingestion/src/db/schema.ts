import { integer, pgTable, primaryKey, real, text } from 'drizzle-orm/pg-core'

export const trades = pgTable('trades', {
  id: integer().generatedAlwaysAsIdentity(),
  asset: text().notNull(),
  price: real().notNull(),
  size: real().notNull(),
  side: text().notNull(),
  timestamp: integer().notNull(),
})

export const candles = pgTable('candles', {
  t: integer().notNull(),
  o: real().notNull(),
  h: real().notNull(),
  l: real().notNull(),
  c: real().notNull(),
  v: real().notNull(),
  asset: text().notNull(),
  interval: text().notNull(),
  closed: integer().notNull().$default(() => 1),
}, (table) => [
  primaryKey({ columns: [table.asset, table.interval, table.t] }),
])
