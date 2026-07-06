import { index } from 'drizzle-orm/pg-core'
import { relations, sql } from 'drizzle-orm'
import { pgTable, text, timestamp } from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  createdAt: timestamp('created_at').notNull(),
})

export const wallets = pgTable(
  'wallets',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    address: text('address').notNull().unique(),
    firstSeenAt: timestamp('first_seen_at').notNull(),
  },
  t => [
    index('wallets_user_id_idx').on(t.userId),
    index('wallets_address_lower_idx').on(sql`LOWER(${t.address})`),
  ],
)

export const circleWallets = pgTable(
  'circle_wallets',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    circleWalletId: text('circle_wallet_id').notNull().unique(),
    circleWalletAddress: text('circle_wallet_address').notNull(),
    createdAt: timestamp('created_at').notNull(),
  },
  t => [index('circle_wallets_user_id_idx').on(t.userId)],
)

export const usersRelations = relations(users, ({ many }) => ({
  wallets: many(wallets),
  circleWallets: many(circleWallets),
}))

export const walletsRelations = relations(wallets, ({ one }) => ({
  user: one(users, {
    fields: [wallets.userId],
    references: [users.id],
  }),
}))

export const circleWalletsRelations = relations(circleWallets, ({ one }) => ({
  user: one(users, {
    fields: [circleWallets.userId],
    references: [users.id],
  }),
}))
