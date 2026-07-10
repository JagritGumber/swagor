import type { JudgmentEngine } from '@judgment/src/v1/engine'
import type { EngineConfig } from '@judgment/src/v1/engine-state'
import type { Candle } from '@judgment/src/shared/types'
import { resolveVersion } from '@judgment/src/index'
import { DEFAULT_JUDGE_CONFIGS } from '@judgment/src/v1/defaults'

type EngineEntry = {
  engine: JudgmentEngine
  asset: string
  instanceId: string
  lastEvaluatedAt: number
  previousJudgmentId: string | null
}

const engines = new Map<string, EngineEntry>()

export async function getOrCreateEngine(
  instanceId: string,
  asset: string,
  candles: Candle[],
): Promise<JudgmentEngine> {
  const existing = engines.get(instanceId)
  if (existing && existing.asset === asset) {
    return existing.engine
  }

  const version = await resolveVersion('v1')
  const engineConfig: EngineConfig = {
    asset,
    regimeWindowMs: 24 * 60 * 60 * 1000,
  }
  const engine = version.createJudgmentEngine(engineConfig, DEFAULT_JUDGE_CONFIGS)
  engine.boot(candles)

  engines.set(instanceId, {
    engine,
    asset,
    instanceId,
    lastEvaluatedAt: Date.now(),
    previousJudgmentId: null,
  })

  return engine
}

export function removeEngine(instanceId: string): void {
  engines.delete(instanceId)
}

export function getEngineEntry(instanceId: string): EngineEntry | undefined {
  return engines.get(instanceId)
}

export function updateLastJudgment(
  instanceId: string,
  judgmentId: string,
): void {
  const entry = engines.get(instanceId)
  if (entry) {
    entry.previousJudgmentId = judgmentId
    entry.lastEvaluatedAt = Date.now()
  }
}

export function listEngines(): Array<{
  instanceId: string
  asset: string
  lastEvaluatedAt: number
  previousJudgmentId: string | null
}> {
  return Array.from(engines.values()).map((e) => ({
    instanceId: e.instanceId,
    asset: e.asset,
    lastEvaluatedAt: e.lastEvaluatedAt,
    previousJudgmentId: e.previousJudgmentId,
  }))
}