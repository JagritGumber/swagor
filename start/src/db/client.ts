import type { PgliteDatabase } from 'drizzle-orm/pglite'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import * as schema from './schema.ts'

type DrizzleDb = PgliteDatabase<typeof schema> | PostgresJsDatabase<typeof schema>

const driver = process.env.DRIZZLE_DRIVER ?? 'pglite'
const databaseUrl = process.env.DATABASE_URL

let db: DrizzleDb | null = null
let lastError: unknown = null

export async function getDb(): Promise<DrizzleDb> {
  if (db) return db

  if (driver === 'postgres') {
    if (!databaseUrl) {
      throw new Error('DATABASE_URL is required when DRIZZLE_DRIVER=postgres')
    }
    const postgres = (await import('postgres')).default
    const client = postgres(databaseUrl, { prepare: false })
    const { drizzle } = await import('drizzle-orm/postgres-js')
    db = drizzle(client, { schema })
  } else {
    const { PGlite } = await import('@electric-sql/pglite')
    const dataDir = databaseUrl ?? '.data/pglite'
    try {
      const pglite = new PGlite(dataDir)
      await pglite.waitReady
      const { drizzle } = await import('drizzle-orm/pglite')
      db = drizzle(pglite, { schema })
    } catch (err) {
      lastError = err
      // If PGlite fails to open (e.g. corrupted lock from crash), try to
      // recover by clearing the WAL/lock files and retrying once.
      console.error(`[db] PGlite open failed, attempting recovery:`, err)
      try {
        const fs = await import('node:fs/promises')
        const path = await import('node:path')
        const wal = path.join(dataDir, 'pg_wal')
        const lock = path.join(dataDir, 'postmaster.pid')
        // Only remove lock/wal artifacts, not the whole data directory
        await fs.rm(lock, { force: true }).catch(() => {})
        await fs.rm(wal, { recursive: true, force: true }).catch(() => {})

        const pglite = new PGlite(dataDir)
        await pglite.waitReady
        const { drizzle } = await import('drizzle-orm/pglite')
        db = drizzle(pglite, { schema })
        console.error(`[db] PGlite recovery succeeded`)
      } catch (recoveryErr) {
        lastError = recoveryErr
        console.error(`[db] PGlite recovery failed:`, recoveryErr)
        throw recoveryErr
      }
    }
  }

  return db!
}

export function resetDb(): void {
  db = null
  lastError = null
}
