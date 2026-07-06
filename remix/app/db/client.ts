import type { PgliteDatabase } from 'drizzle-orm/pglite'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import * as schema from './schema.ts'

type DrizzleDb = PgliteDatabase<typeof schema> | PostgresJsDatabase<typeof schema>

const databaseUrl = process.env.DATABASE_URL

let db: DrizzleDb | null = null

export async function getDb(): Promise<DrizzleDb> {
  if (db) return db

  if (databaseUrl?.startsWith('postgres')) {
    // Production: real PostgreSQL via postgres.js
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
