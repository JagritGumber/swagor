import type { Candle } from '@packages/strategy-lab/types'
import type { LiveReaderRead } from '@packages/strategy-lab/reader/reader-live/types'
import type { ReaderTradePlan, ReaderTradePlanStatus } from '@packages/strategy-lab/backtest/trade-plan/types'
import { buildReaderHistoryReads } from '@packages/strategy-lab/reader/reader-history/build-reader-history-reads'
import { buildReaderTradePlan } from '@packages/strategy-lab/backtest/trade-plan/build-reader-trade-plan'
import { getReaderState } from '@/server/reader-state'

const INTERVAL_MS = 3_600_000

export type JudgmentPipelineResult = {
  read: LiveReaderRead | null
  plan: ReaderTradePlan | null
  updatedAt: number
}

export async function runJudgmentPipeline(
  asset: string,
  interval: string,
  candles: Candle[],
): Promise<JudgmentPipelineResult> {
  if (candles.length === 0) {
    return { read: null, plan: null, updatedAt: Date.now() }
  }

  const { auctionModeState, vpStateMemory } = getReaderState(asset)

  const steps = buildReaderHistoryReads({
    asset,
    interval,
    candleIntervalMs: INTERVAL_MS,
    candles,
    orderflowEvents: [],
    readIntervalMs: INTERVAL_MS,
    orderflowWindowMs: 60_000,
    startAt: candles.length >= 2 ? candles[candles.length - 2].t : Date.now() - INTERVAL_MS,
    endAt: candles[candles.length - 1]?.t ?? Date.now(),
    auctionModeState,
    vpStateMemory,
  })

  const latestStep = steps[steps.length - 1]
  if (!latestStep) {
    return { read: null, plan: null, updatedAt: Date.now() }
  }

  const read = latestStep.read
  const plan = buildReaderTradePlan(read)

  return { read, plan, updatedAt: Date.now() }
}
