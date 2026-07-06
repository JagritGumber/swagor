import { DatabaseSync } from 'node:sqlite'
import * as path from 'node:path'
import * as fs from 'node:fs'
import { randomUUID } from 'node:crypto'

const DB_DIR = path.resolve('.data')
const DB_PATH = path.join(DB_DIR, 'auth.db')

if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true })
}

const db = new DatabaseSync(DB_PATH)

db.exec(`
  CREATE TABLE IF NOT EXISTS circle_wallets (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    circle_wallet_id TEXT NOT NULL UNIQUE,
    circle_wallet_address TEXT NOT NULL,
    created_at TEXT NOT NULL
  )
`)

const insertWallet = db.prepare(
  'INSERT INTO circle_wallets (id, user_id, circle_wallet_id, circle_wallet_address, created_at) VALUES (?, ?, ?, ?, ?)'
)
const findWalletByUserId = db.prepare(
  'SELECT id, user_id, circle_wallet_id, circle_wallet_address, created_at FROM circle_wallets WHERE user_id = ?'
)

export type CircleWallet = {
  id: string
  user_id: string
  circle_wallet_id: string
  circle_wallet_address: string
  created_at: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let sdkInstance: any = null

async function getCircleSdk() {
  if (sdkInstance) return sdkInstance

  const apiKey = process.env.CIRCLE_API_KEY
  const entitySecret = process.env.CIRCLE_ENTITY_SECRET

  if (!apiKey || !entitySecret) {
    throw new Error('CIRCLE_API_KEY and CIRCLE_ENTITY_SECRET environment variables are required')
  }

  const { initiateDeveloperControlledWalletsClient } = await import('@circle-fin/developer-controlled-wallets')

  sdkInstance = initiateDeveloperControlledWalletsClient({
    apiKey,
    entitySecret,
  })
  return sdkInstance
}

export function getCircleWalletForUser(userId: string): CircleWallet | null {
  const wallet = findWalletByUserId.get(userId) as CircleWallet | undefined
  return wallet || null
}

export async function allocateCircleWallet(userId: string): Promise<CircleWallet> {
  const existing = getCircleWalletForUser(userId)
  if (existing) return existing

  const sdk = await getCircleSdk()

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

  const now = new Date().toISOString()
  const id = randomUUID()

  insertWallet.run(id, userId, wallet.id, wallet.address.toLowerCase(), now)

  return {
    id,
    user_id: userId,
    circle_wallet_id: wallet.id,
    circle_wallet_address: wallet.address.toLowerCase(),
    created_at: now,
  }
}
