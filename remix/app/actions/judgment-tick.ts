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
 * Cron heartbeat endpoint for judgment engine. Called by external scheduler
 * on candle close. Evaluates all active Selbo instances plus the shared
 * admin judgment engine.
 *
 * Auth: shared secret in Authorization: Bearer ${CRON_SECRET} header.
 */
export async function judgmentTick(context: AppContext) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      return apiError('CRON_SECRET_MISSING', 'CRON_SECRET not configured', 503)
    }
  } else {
    const auth = context.request.headers.get('authorization') ?? ''
    if (auth !== `Bearer ${secret}`) {
      return apiError('UNAUTHORIZED', 'Unauthorized', 401)
    }
  }

  const now = new Date()
  const db = await getSupabaseDb()

  const activeInstances = await db
    .select()
    .from(selboInstances as any)
    .where(
      and(
        eq((selboInstances as any).killSwitchActive, false),
        eq((selboInstances as any).betaAccessGranted, true),
      ),
    )

  const instanceResults = await Promise.allSettled(
    activeInstances.map((i) => runJudgmentForInstance((i as any).id)),
  )

  let adminResult: { status: 'fulfilled'; value: string } | { status: 'rejected'; reason: unknown }
  try {
    const judgmentId = await runAdminJudgment('ETH')
    adminResult = { status: 'fulfilled' as const, value: judgmentId }
  } catch (e) {
    adminResult = { status: 'rejected' as const, reason: e }
  }

  const summary = activeInstances.map((instance, idx) => {
    const r = instanceResults[idx]
    if (!r) return { instanceId: (instance as any).id, status: 'missing' as const }
    return {
      instanceId: (instance as any).id,
      status: r.status,
      ...(r.status === 'fulfilled'
        ? { judgmentId: r.value }
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
        ? { judgmentId: adminResult.value }
        : { error: adminResult.reason instanceof Error ? adminResult.reason.message : String(adminResult.reason) }),
    },
  })
}
