import { hlTestnet, hlMainnet } from '../index.ts'
import type { HyperliquidNetwork, HyperliquidCandle } from '@packages/market-data/shared/types'

export type { HyperliquidCandle }

const hlInstance = (network: HyperliquidNetwork) =>
  network === 'mainnet' ? hlMainnet : hlTestnet

export const getCandles = (
  network: HyperliquidNetwork,
  coin: string,
  interval: string,
  startMs: number,
  endMs: number,
) =>
  hlInstance(network).Post<HyperliquidCandle[]>('', {
    type: 'candleSnapshot',
    req: { coin, interval, startTime: startMs, endTime: endMs },
  })
