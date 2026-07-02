import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import * as schema from './schema.ts'
import type { PgliteDatabase } from 'drizzle-orm/pglite'

export type DB = PgliteDatabase<typeof schema>

let db: DB | null = null

export async function getDb(): Promise<DB> {
  if (db) return db
  const client = new PGlite()
  await client.waitReady

  await client.sql`CREATE TABLE IF NOT EXISTS trades (
    id INTEGER GENERATED ALWAYS AS IDENTITY,
    asset TEXT NOT NULL,
    price REAL NOT NULL,
    size REAL NOT NULL,
    side TEXT NOT NULL,
    timestamp INTEGER NOT NULL
  )`

  await client.sql`CREATE TABLE IF NOT EXISTS candles (
    t INTEGER NOT NULL,
    o REAL NOT NULL,
    h REAL NOT NULL,
    l REAL NOT NULL,
    c REAL NOT NULL,
    v REAL NOT NULL,
    asset TEXT NOT NULL,
    interval TEXT NOT NULL,
    closed INTEGER NOT NULL DEFAULT 1,
    PRIMARY KEY (asset, interval, t)
  )`

  db = drizzle(client, { schema }) as unknown as DB
  return db
}
