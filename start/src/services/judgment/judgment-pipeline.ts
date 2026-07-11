import type { Candle } from '@judgment/src/shared/types'
import { getOrCreateEngine } from './judgment-engine-manager.ts'

const PIPELINE_INSTANCE_ID = '00000000-0000-0000-0000-000000000000'

export type JudgmentPipelineResult = {
  judgment: {
    regime: { mode: string; highVol: boolean; rangePct: number; driftPct: number; directionalEfficiency: number } | null
    auction: string | null
    stance: string
    confidence: number
    narrative: string
    updatedAt: number
  } | null
}

export async function runJudgmentPipeline(
  asset: string,
  interval: string,
  candles: Candle[],
): Promise<JudgmentPipelineResult> {
  if (candles.length === 0) {
    return { judgment: null }
  }

  const engine = await getOrCreateEngine(PIPELINE_INSTANCE_ID, asset, candles)
  const result = engine.onCandle(candles[candles.length - 1])

  if (!result.bestJudgment || !result.judgment) {
    return { judgment: null }
  }

  const regime = result.judgment.metrics.regime
  const stance = result.judgment.action.type === 'enter'
    ? result.judgment.action.side
    : result.judgment.action.type
  const confidence = result.bestJudgment.confidence
  const narrative = result.judgment.reason

  return {
    judgment: {
      regime,
      auction: null,
      stance,
      confidence,
      narrative,
      updatedAt: Date.now(),
    },
  }
}
