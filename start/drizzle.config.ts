import { defineConfig } from 'drizzle-kit'

const driver = process.env.DRIZZLE_DRIVER === 'pglite' ? 'pglite' as const : undefined

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  tablesFilter: ['users', 'wallets', 'agents', 'agent_wallets', 'decisions', 'evidence', 'executions', 'outcomes'],
  ...(driver ? { driver } : {}),
  dbCredentials: {
    url: driver
      ? (process.env.DATABASE_URL ?? '.data/pglite')
      : process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
})
