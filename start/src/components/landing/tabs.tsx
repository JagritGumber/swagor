export const ASSETS = ['SOL', 'BTC', 'ETH', 'DOGE', 'AVAX'] as const

export type Asset = (typeof ASSETS)[number]
