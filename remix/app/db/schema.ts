import { pgTable, text, timestamp } from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  createdAt: timestamp('created_at').notNull(),
})

export const wallets = pgTable('wallets', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id),
  address: text('address').notNull().unique(),
  firstSeenAt: timestamp('first_seen_at').notNull(),
})

export const circleWallets = pgTable('circle_wallets', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id),
  circleWalletId: text('circle_wallet_id').notNull().unique(),
  circleWalletAddress: text('circle_wallet_address').notNull(),
  createdAt: timestamp('created_at').notNull(),
})
