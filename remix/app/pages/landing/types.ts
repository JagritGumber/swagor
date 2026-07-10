import type { Candle } from '@shared/candle'
import type { OverlaySegment } from '@/components/chart/types'
import type { ReaderMarketRegimeMode } from '@packages/strategy-lab/read-core/market-regime/types'
import type { LiveReaderStance } from '@packages/strategy-lab/reader/reader-live/types'
import type { Asset } from '@/components/landing/tabs'

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

export interface LandingAssetData {
  candles: Candle[]
  segments: OverlaySegment[]
  auction: LandingAuction | null
  regime: LandingRegime | null
  read: LandingReaderRead | null
}

export interface LandingViewProps {
  assets: Record<Asset, LandingAssetData>
  activeAsset: Asset
}
