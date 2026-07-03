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
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL
  )
`)

db.exec(`
  CREATE TABLE IF NOT EXISTS wallets (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    address TEXT NOT NULL UNIQUE,
    first_seen_at TEXT NOT NULL
  )
`)

const insertUser = db.prepare('INSERT INTO users (id, created_at) VALUES (?, ?)')
const insertWallet = db.prepare('INSERT INTO wallets (id, user_id, address, first_seen_at) VALUES (?, ?, ?, ?)')
const findWalletByAddress = db.prepare(
  'SELECT w.id, w.user_id, w.address, w.first_seen_at, u.created_at FROM wallets w JOIN users u ON u.id = w.user_id WHERE LOWER(w.address) = ?',
)
const findWalletsByUserId = db.prepare('SELECT address, first_seen_at FROM wallets WHERE user_id = ?')
const findUserById = db.prepare('SELECT id, created_at FROM users WHERE id = ?')

export type UserIdentity = {
  id: string
  wallets: { address: string }[]
}

export function resolveUser(address: string): UserIdentity {
  const existing = findWalletByAddress.all(address.toLowerCase()) as Array<{
    id: string
    user_id: string
    address: string
    first_seen_at: string
    created_at: string
  }>

  if (existing.length > 0) {
    return {
      id: existing[0].user_id,
      wallets: existing.map(w => ({ address: w.address })),
    }
  }

  const now = new Date().toISOString()
  const userId = randomUUID()
  const walletId = randomUUID()

  insertUser.run(userId, now)
  insertWallet.run(walletId, userId, address.toLowerCase(), now)

  return {
    id: userId,
    wallets: [{ address: address.toLowerCase() }],
  }
}

export function getUserById(userId: string): UserIdentity | null {
  const user = findUserById.get(userId) as { id: string; created_at: string } | undefined
  if (!user) return null

  const wallets = findWalletsByUserId.all(userId) as { address: string; first_seen_at: string }[]

  return {
    id: user.id,
    wallets: wallets.map(w => ({ address: w.address })),
  }
}
