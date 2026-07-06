import { randomUUID } from 'node:crypto'
import { eq, sql } from 'drizzle-orm'
import { getDb } from '../db/client.ts'
import { users, wallets } from '../db/schema.ts'

export type UserIdentity = {
  id: string
  wallets: { address: string }[]
}

export async function resolveUser(address: string): Promise<UserIdentity> {
  const db = await getDb()

  const existing = await db
    .select({
      id: wallets.id,
      userId: wallets.userId,
      address: wallets.address,
      firstSeenAt: wallets.firstSeenAt,
      createdAt: users.createdAt,
    })
    .from(wallets)
    .innerJoin(users, eq(users.id, wallets.userId))
    .where(sql`LOWER(${wallets.address}) = ${address.toLowerCase()}`)

  if (existing.length > 0) {
    return {
      id: existing[0].userId,
      wallets: existing.map(w => ({ address: w.address })),
    }
  }

  const now = new Date()
  const userId = randomUUID()
  const walletId = randomUUID()

  await db.insert(users).values({ id: userId, createdAt: now })
  await db.insert(wallets).values({
    id: walletId,
    userId,
    address: address.toLowerCase(),
    firstSeenAt: now,
  })

  return {
    id: userId,
    wallets: [{ address: address.toLowerCase() }],
  }
}

export async function getUserById(userId: string): Promise<UserIdentity | null> {
  const db = await getDb()

  const user = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .then(rows => rows[0] ?? null)

  if (!user) return null

  const userWallets = await db
    .select({ address: wallets.address })
    .from(wallets)
    .where(eq(wallets.userId, userId))

  return {
    id: user.id,
    wallets: userWallets.map(w => ({ address: w.address })),
  }
}
