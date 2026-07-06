import type { PgliteDatabase } from 'drizzle-orm/pglite'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import * as schema from './schema.ts'

type DrizzleDb = PgliteDatabase<typeof schema> | PostgresJsDatabase<typeof schema>

const driver = process.env.DRIZZLE_DRIVER ?? 'pglite'
const databaseUrl = process.env.DATABASE_URL

let db: DrizzleDb | null = null

export async function getDb(): Promise<DrizzleDb> {
  if (db) return db

  if (driver === 'postgres') {
    // Production: real PostgreSQL via postgres.js
    if (!databaseUrl) {
      throw new Error('DATABASE_URL is required when DRIZZLE_DRIVER=postgres')
    }
    const postgres = (await import('postgres')).default
    const client = postgres(databaseUrl, { prepare: false })
    const { drizzle } = await import('drizzle-orm/postgres-js')
    db = drizzle(client, { schema })
  } else {
    // Dev: embedded PGlite
    const { PGlite } = await import('@electric-sql/pglite')
    const pglite = new PGlite(databaseUrl ?? '.data/pglite')
    await pglite.waitReady
    const { drizzle } = await import('drizzle-orm/pglite')
    db = drizzle(pglite, { schema })
  }

  return db!
}
