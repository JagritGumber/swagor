import type { Candle } from '@shared/candle'
import type { OverlaySegment } from '@/components/chart/types'
import type { ReaderMarketRegimeMode } from '@packages/strategy-lab/read-core/market-regime/types'
import type { LiveReaderStance } from '@packages/strategy-lab/reader/reader-live/types'
import type { Asset } from './tabs'

export interface LandingAuction {
  location: string
  locationLabel: string
  bias: string
  narrative: string
  profile: {
    poc: number
    valueAreaLow: number
    valueAreaHigh: number
    bins: { low: number; high: number; volume: number }[]
  } | null
  level: {
    price: number
    kind: string
    touches: number
  } | null
}

export interface LandingRegime {
  mode: ReaderMarketRegimeMode
  label: string
  rangePct: number
  driftPct: number
  directionalEfficiency: number
}

export interface LandingReaderRead {
  stance: LiveReaderStance
  narrative: string
  invalidation: string | null
  target: string | null
  orderflow: {
    pressure: string
    delta: number
    tradeCount: number
    events: string[]
  }
}

export interface LandingPortfolio {
  equity: number
  totalPnl: number
  dailyPnl: number
  tradeCount: number
  winCount: number
  lossCount: number
  openPositionCount: number
  positions: {
    id: string
    asset: string
    side: string
    entryPrice: number
    entryTime: number
    size: number
    stop: number
    target: number
    status: string
    exitPrice?: number
    exitTime?: number
    exitReason?: string
    pnlPct?: number
    judgmentId: string
  }[]
  equityCurve: { timestamp: number; equity: number }[]
}

export interface LandingAssetData {
  candles: Candle[]
  segments: OverlaySegment[]
  auction: LandingAuction | null
  regime: LandingRegime | null
  read: LandingReaderRead | null
  portfolio: LandingPortfolio | null
}

export interface LandingViewProps {
  assets: Record<Asset, LandingAssetData>
  activeAsset: Asset
}
