import type { Candle } from '@shared/candle'
import type { OverlaySegment } from '../../components/chart/types.ts'

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
  mode: string
  label: string
  rangePct: number
  driftPct: number
  directionalEfficiency: number
}

export interface LandingReaderRead {
  stance: string
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

export interface LandingTradePlan {
  status: string
  side?: string
  entryLow?: number
  entryHigh?: number
  stop?: number
  target?: number
  invalidation?: string
  confidence?: number
  reasons: string[]
}

export interface LandingJudgment {
  id: string
  action: string
  side?: string
  confidence: number
  reason: string
  allJudgments: {
    configId: string
    label: string
    confidence: number
    reason: string
  }[]
}

export interface LandingPortfolio {
  equity: number
  totalPnl: number
  dailyPnl: number
  tradeCount: number
  winCount: number
  lossCount: number
  openPositionCount: number
}

export interface LandingViewProps {
  candles: Candle[]
  segments: OverlaySegment[]
  auction: LandingAuction | null
  regime: LandingRegime | null
  read?: LandingReaderRead | null
  plan?: LandingTradePlan | null
  judgment?: LandingJudgment | null
  portfolio?: LandingPortfolio | null
  asset: string
}
