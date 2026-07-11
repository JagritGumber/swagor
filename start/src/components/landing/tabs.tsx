export const ASSETS = ['SOL', 'BTC', 'ETH', 'DOGE'] as const

export type Asset = (typeof ASSETS)[number]
