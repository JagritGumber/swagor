import type { Candle } from '@shared/candle'
import { resolveVersion } from '../../../judgment/src'
import type { EngineJudgmentResult } from '../../../judgment/src/v1/engine'
import { createPortfolioEngine } from '../../../portfolio/src'
import type { PortfolioSnapshot } from '../../../portfolio/src/types'

export type JudgmentPipelineResult = {
  judgment: EngineJudgmentResult
  portfolio: PortfolioSnapshot
}

export async function runJudgmentPipeline(
  asset: string,
  interval: string,
  candles: Candle[],
  versionId: string = 'v1',
): Promise<JudgmentPipelineResult> {
  const version = await resolveVersion(versionId)

  const engine = version.createJudgmentEngine(
    { asset, regimeWindowMs: 24 * 60 * 60 * 1000 },
    version.DEFAULT_JUDGE_CONFIGS,
  )

  engine.boot(candles)
  const result = engine.onCandle(candles[candles.length - 1])

  const portfolio = createPortfolioEngine({ initialEquity: 10_000 })

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
