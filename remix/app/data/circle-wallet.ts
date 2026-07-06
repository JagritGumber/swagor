import { randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import { eq } from 'drizzle-orm'
import { getDb } from '../db/client.ts'
import { circleWallets } from '../db/schema.ts'

export type CircleWallet = {
  id: string
  user_id: string
  circle_wallet_id: string
  circle_wallet_address: string
  created_at: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let sdkInstance: any = null

function getCircleSdk() {
  if (sdkInstance) return sdkInstance

  const apiKey = process.env.CIRCLE_API_KEY
  const entitySecret = process.env.CIRCLE_ENTITY_SECRET

  if (!apiKey || !entitySecret) {
    throw new Error('CIRCLE_API_KEY and CIRCLE_ENTITY_SECRET environment variables are required')
  }

  const require = createRequire(import.meta.url)
  const { initiateDeveloperControlledWalletsClient } = require('@circle-fin/developer-controlled-wallets')

  sdkInstance = initiateDeveloperControlledWalletsClient({
    apiKey,
    entitySecret,
  })
  return sdkInstance
}

export async function getCircleWalletForUser(userId: string): Promise<CircleWallet | null> {
  const db = await getDb()

  const wallet = await db
    .select()
    .from(circleWallets)
    .where(eq(circleWallets.userId, userId))
    .then(rows => rows[0] ?? null)

  if (!wallet) return null

  return {
    id: wallet.id,
    user_id: wallet.userId,
    circle_wallet_id: wallet.circleWalletId,
    circle_wallet_address: wallet.circleWalletAddress,
    created_at: wallet.createdAt.toISOString(),
  }
}

export async function allocateCircleWallet(userId: string): Promise<CircleWallet> {
  const existing = await getCircleWalletForUser(userId)
  if (existing) return existing

  const sdk = getCircleSdk()

  const walletSet = await sdk.createWalletSet({
    name: `remix-${userId.slice(0, 8)}`,
  })
  const walletSetId = walletSet.data?.walletSet?.id
  if (!walletSetId) throw new Error('Circle wallet set creation returned no id')

  const created = await sdk.createWallets({
    accountType: 'SCA',
    blockchains: ['ARC-TESTNET'],
    walletSetId,
    count: 1,
  })
  const wallet = created.data?.wallets?.[0]
  if (!wallet) throw new Error('Circle wallet creation returned no wallet')

  const db = await getDb()
  const now = new Date()
  const id = randomUUID()

  await db.insert(circleWallets).values({
    id,
    userId,
    circleWalletId: wallet.id,
    circleWalletAddress: wallet.address.toLowerCase(),
    createdAt: now,
  })

  return {
    id,
    user_id: userId,
    circle_wallet_id: wallet.id,
    circle_wallet_address: wallet.address.toLowerCase(),
    created_at: now.toISOString(),
  }
}
