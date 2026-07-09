import { eq, desc, and } from 'drizzle-orm'
import { judgmentTicks, selboInstances } from '../../db/schema.ts'
import { getDb } from '../../db/client.ts'
import {
  getOrCreateEngine,
  getEngineEntry,
  updateLastJudgment,
} from './judgment-engine-manager.ts'
import { loadCandlesForAsset } from './candle-loader.ts'

const ADMIN_INSTANCE_ID = 'admin-judge-zero'
const DEFAULT_LOOKBACK = 200
const DEFAULT_INTERVAL = '1h'

export async function runJudgmentForInstance(
  instanceId: string,
): Promise<string> {
  const db = await getDb()

  const rows = await db
    .select()
    .from(selboInstances)
    .where(eq(selboInstances.id, instanceId))
    .limit(1)

  if (rows.length === 0) {
    throw new Error(`Selbo instance ${instanceId} not found`)
  }

  const asset = 'ETH'

  const candles = await loadCandlesForAsset(asset, DEFAULT_LOOKBACK, DEFAULT_INTERVAL)
  const engine = await getOrCreateEngine(instanceId, asset, candles)

  const result = engine.onCandle(candles[candles.length - 1])

  const entry = getEngineEntry(instanceId)
  const previousJudgmentId = entry?.previousJudgmentId ?? null

  const insertResult = await db
    .insert(judgmentTicks)
    .values({
      selboInstanceId: instanceId,
      asset,
      version: 'v1',
      side: result.judgment.action.type === 'enter' ? result.judgment.action.side : null,
      confidence: result.bestJudgment?.confidence ?? null,
      reason: result.judgment.reason,
      entryPrice:
        result.judgment.action.type === 'enter'
          ? String(result.judgment.action.entry)
          : null,
      stopPrice:
        result.judgment.action.type === 'enter'
          ? String(result.judgment.action.stop)
          : null,
      targetPrice:
        result.judgment.action.type === 'enter'
          ? String(result.judgment.action.target)
          : null,
      invalidation: result.judgment.invalidation,
      previousJudgmentId,
      adminJudgment: false,
      allJudgments: result.allJudgments,
      metricsSnapshot: result.judgment.metrics,
    })
    .returning()

  const judgmentId: string = insertResult[0].id
  updateLastJudgment(instanceId, judgmentId)

  return judgmentId
}

export async function runAdminJudgment(asset: string): Promise<string> {
  const db = await getDb()

  const candles = await loadCandlesForAsset(asset, DEFAULT_LOOKBACK, DEFAULT_INTERVAL)
  const engine = await getOrCreateEngine(ADMIN_INSTANCE_ID, asset, candles)

  const result = engine.onCandle(candles[candles.length - 1])

  const entry = getEngineEntry(ADMIN_INSTANCE_ID)
  const previousJudgmentId = entry?.previousJudgmentId ?? null

  const insertResult = await db
    .insert(judgmentTicks)
    .values({
      selboInstanceId: ADMIN_INSTANCE_ID,
      asset,
      version: 'v1',
      side: result.judgment.action.type === 'enter' ? result.judgment.action.side : null,
      confidence: result.bestJudgment?.confidence ?? null,
      reason: result.judgment.reason,
      entryPrice:
        result.judgment.action.type === 'enter'
          ? String(result.judgment.action.entry)
          : null,
      stopPrice:
        result.judgment.action.type === 'enter'
          ? String(result.judgment.action.stop)
          : null,
      targetPrice:
        result.judgment.action.type === 'enter'
          ? String(result.judgment.action.target)
          : null,
      invalidation: result.judgment.invalidation,
      previousJudgmentId,
      adminJudgment: true,
      allJudgments: result.allJudgments,
      metricsSnapshot: result.judgment.metrics,
    })
    .returning()

  const judgmentId: string = insertResult[0].id
  updateLastJudgment(ADMIN_INSTANCE_ID, judgmentId)

  return judgmentId
}

export async function getLatestJudgment(instanceId: string) {
  const db = await getDb()

  const rows = await db
    .select()
    .from(judgmentTicks)
    .where(eq(judgmentTicks.selboInstanceId, instanceId))
    .orderBy(desc(judgmentTicks.createdAt))
    .limit(1)

  return rows[0] ?? null
}

export async function getLatestAdminJudgment(asset: string) {
  const db = await getDb()

  const rows = await db
    .select()
    .from(judgmentTicks)
    .where(
      and(
        eq(judgmentTicks.selboInstanceId, ADMIN_INSTANCE_ID),
        eq(judgmentTicks.asset, asset),
      ),
    )
    .orderBy(desc(judgmentTicks.createdAt))
    .limit(1)

  return rows[0] ?? null
}

export async function getJudgmentHistory(
  instanceId: string,
  limit = 20,
) {
  const db = await getDb()

  return db
    .select()
    .from(judgmentTicks)
    .where(eq(judgmentTicks.selboInstanceId, instanceId))
    .orderBy(desc(judgmentTicks.createdAt))
    .limit(limit)
}
