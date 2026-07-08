import type { Candle } from '@shared/candle'
import { createJudgmentEngine, DEFAULT_JUDGE_CONFIGS } from '../../../judgment/src'
import type { EngineJudgmentResult } from '../../../judgment/src/engine/engine'
import { createPortfolioEngine } from '../../../portfolio/src'
import type { PortfolioSnapshot } from '../../../portfolio/src/types'

export type JudgmentPipelineResult = {
  judgment: EngineJudgmentResult
  portfolio: PortfolioSnapshot
}

const judgmentStore = new Map<string, EngineJudgmentResult>()
const portfolio = createPortfolioEngine({ initialEquity: 10_000 })

export function runJudgmentPipeline(
  asset: string,
  interval: string,
  candles: Candle[],
): JudgmentPipelineResult {
  const engine = createJudgmentEngine(
    { asset, regimeWindowMs: 24 * 60 * 60 * 1000 },
    DEFAULT_JUDGE_CONFIGS,
  )

  engine.boot(candles)
  const result = engine.onCandle(candles[candles.length - 1])

  judgmentStore.set(asset, result)

  if (result.bestJudgment && result.bestJudgment.action.type === 'enter') {
    portfolio.processJudgment(
      result.bestJudgment.action,
      asset,
      Date.now(),
      result.judgment.id,
    )
  }

  portfolio.tick(asset, candles[candles.length - 1].c)

  return {
    judgment: result,
    portfolio: portfolio.snapshot(),
  }
}
