import { readFileSync } from 'node:fs'
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { getDb } from './client.ts'

export async function runMigrations() {
  const db = await getDb()
  const migrationsDir = join(import.meta.dirname, '../../drizzle')

  let files: string[]
  try {
    files = await readdir(migrationsDir)
  } catch {
    return
  }

  const sqlFiles = files.filter(f => f.endsWith('.sql')).sort()

  for (const file of sqlFiles) {
    const sql = readFileSync(join(migrationsDir, file), 'utf-8')
    const statements = sql
      .split('--> statement-breakpoint')
      .map(s => s.trim())
      .filter(s => s.length > 0)

    for (const stmt of statements) {
      await db.execute(stmt)
    }
  }
}
