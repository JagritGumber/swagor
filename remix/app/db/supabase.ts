type SupabaseDb = ReturnType<typeof import('drizzle-orm/postgres-js').drizzle>

let supabaseDb: SupabaseDb | null = null

/**
 * Returns a Drizzle client connected to the root Supabase PostgreSQL DB.
 * Uses SUPABASE_DATABASE_URL env var (separate from the Remix app's
 * local DATABASE_URL which points to PGlite in dev).
 *
 * In production, SUPABASE_DATABASE_URL should equal DATABASE_URL
 * (both point to the same Supabase project).
 */
export async function getSupabaseDb(): Promise<SupabaseDb> {
  if (supabaseDb) return supabaseDb

  const url = process.env.SUPABASE_DATABASE_URL
  if (!url) {
    throw new Error(
      'SUPABASE_DATABASE_URL is required for judgment queries. ' +
      'Set it to the same value as the root app DATABASE_URL.',
    )
  }

  const postgres = (await import('postgres')).default
  const client = postgres(url, { prepare: false })
  const { drizzle } = await import('drizzle-orm/postgres-js')

  // Import the root schema so Drizzle knows about judgment_ticks, selbo_instances, etc.
  const schema = await import('../../../lib/db/schema/index.ts')
  supabaseDb = drizzle(client, { schema })

  return supabaseDb!
}
