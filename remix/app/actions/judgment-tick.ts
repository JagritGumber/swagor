import type { AppContext } from '../router.ts'
import { eq, and } from 'drizzle-orm'
import { getSupabaseDb } from '../db/supabase.ts'
import { selboInstances } from '../../../lib/db/schema/index.ts'
import {
  runJudgmentForInstance,
  runAdminJudgment,
} from '../services/judgment/judgment.service.ts'
import { apiSuccess, apiError } from '../lib/api/response.ts'

/**
 * Manual trigger for judgment tick. Used for dev testing and admin force-runs.
 * In production, judgment is triggered via BullMQ queue (candle close events
 * from the ingestion service).
 */
export async function judgmentTick(context: AppContext) {
  const url = new URL(context.request.url)
  const asset = url.searchParams.get('asset') ?? 'ETH'
  const adminOnly = url.searchParams.get('admin') === 'true'

  const now = new Date()

  if (adminOnly) {
    try {
      const result = await runAdminJudgment(asset)
      return apiSuccess({ ranAt: now.toISOString(), adminJudgment: result })
    } catch (e) {
      return apiError('ADMIN_JUDGMENT_FAILED', e instanceof Error ? e.message : String(e), 500)
    }
  }

  // Root schema types are incompatible with Remix's Drizzle - cast to any
  const db = await getSupabaseDb()
  const activeInstances = await (db as any)
    .select()
    .from(selboInstances)
    .where(and(
      eq((selboInstances as any).killSwitchActive, false),
      eq((selboInstances as any).betaAccessGranted, true),
    ))

  const instanceResults = await Promise.allSettled(
    activeInstances.map((i: any) => runJudgmentForInstance(i.id)),
  )

  let adminResult: { status: 'fulfilled'; value: unknown } | { status: 'rejected'; reason: unknown }
  try {
    const adminJudgment = await runAdminJudgment(asset)
    adminResult = { status: 'fulfilled' as const, value: adminJudgment }
  } catch (e) {
    adminResult = { status: 'rejected' as const, reason: e }
  }

  const summary = activeInstances.map((instance: any, idx: number) => {
    const r = instanceResults[idx]
    if (!r) return { instanceId: instance.id, status: 'missing' as const }
    return {
      instanceId: instance.id,
      status: r.status,
      ...(r.status === 'fulfilled'
        ? { judgmentId: r.value.judgmentId, side: r.value.side, confidence: r.value.confidence }
        : { error: r.reason instanceof Error ? r.reason.message : String(r.reason) }),
    }
  })

  return apiSuccess({
    ranAt: now.toISOString(),
    instanceCount: activeInstances.length,
    results: summary,
    adminJudgment: {
      status: adminResult.status,
      ...(adminResult.status === 'fulfilled'
        ? { judgmentId: (adminResult.value as any).judgmentId, side: (adminResult.value as any).side }
        : { error: adminResult.reason instanceof Error ? adminResult.reason.message : String(adminResult.reason) }),
    },
  })
}
