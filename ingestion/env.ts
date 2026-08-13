export const PORT = Number(process.env.PORT ?? 44101)
export const NETWORK = (process.env.NETWORK ?? 'testnet') as 'testnet' | 'mainnet'
export const DATABASE_URL = process.env.DATABASE_URL ?? null
export const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379'
