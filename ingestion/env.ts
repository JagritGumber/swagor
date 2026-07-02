export const PORT = Number(process.env.PORT ?? 44101)
export const NETWORK = (process.env.NETWORK ?? 'testnet') as 'testnet' | 'mainnet'
export const DATABASE_URL = process.env.DATABASE_URL ?? null
