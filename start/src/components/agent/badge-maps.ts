import type { ReaderMarketRegimeMode } from '@packages/strategy-lab/read-core/market-regime/types'
import type { LiveReaderStance } from '@packages/strategy-lab/reader/reader-live/types'
import type { ReaderTradePlanStatus } from '@packages/strategy-lab/backtest/trade-plan/types'
import * as s from './style.ts'

export const regimeBadgeClass: Record<ReaderMarketRegimeMode, string> = {
  'range': s.regimeRange,
  'trend-up': s.regimeTrendUp,
  'trend-down': s.regimeTrendDown,
  'high-vol': s.regimeHighVol,
  'unknown': s.regimeRange,
}

export const stanceBadgeClass: Record<LiveReaderStance, string> = {
  'wait': s.stanceWait,
  'possible-long': s.stancePossibleLong,
  'possible-short': s.stancePossibleShort,
  'watch-long-confirmation': s.stanceWatchLong,
  'watch-short-confirmation': s.stanceWatchShort,
  'avoid-balanced-auction': s.stanceAvoid,
}

export const stanceLabel: Record<LiveReaderStance, string> = {
  'wait': 'Wait',
  'possible-long': 'Possible Long',
  'possible-short': 'Possible Short',
  'watch-long-confirmation': 'Watch Long',
  'watch-short-confirmation': 'Watch Short',
  'avoid-balanced-auction': 'Avoid Balanced',
}

export const planStatusLabel: Record<ReaderTradePlanStatus, string> = {
  'ready': 'Ready',
  'watch': 'Watch',
  'ready-if-reclaim': 'Ready if Reclaim',
  'no-trade': 'No Trade',
}
