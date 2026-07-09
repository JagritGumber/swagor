import { Auth } from 'remix/middleware/auth'
import type { AppContext } from '../router.ts'
import { eq } from 'drizzle-orm'
import { getSupabaseDb } from '../db/supabase.ts'
import { selboInstances } from '../../../lib/db/schema/index.ts'
import {
  getLatestJudgment,
  getLatestAdminJudgment,
  getJudgmentHistory,
} from '../services/judgment/judgment.service.ts'
import { apiSuccess } from '../lib/api/response.ts'

/**
 * Query judgment history. Supports two modes:
 * - Authed user: returns their instance's latest judgment + history
 * - No auth: returns admin judgment (public dashboard)
 */
export async function judgmentHistory(context: AppContext) {
  const url = new URL(context.request.url)
  const asset = url.searchParams.get('asset') ?? 'ETH'
  const limit = Math.min(Number(url.searchParams.get('limit') ?? '50'), 200)

  const auth = context.get(Auth)
  if (auth.ok) {
    const db = await getSupabaseDb()
    const [instance] = await db
      .select()
      .from(selboInstances as any)
      .where(eq((selboInstances as any).userId, auth.identity.id))
      .limit(1)

    if (instance) {
      const [latest, history] = await Promise.all([
        getLatestJudgment((instance as any).id),
        getJudgmentHistory((instance as any).id, limit),
      ])
      return apiSuccess({ latest, history, source: 'user' })
    }
  }

  const [latest, history] = await Promise.all([
    getLatestAdminJudgment(asset),
    getJudgmentHistory('admin-judge-zero', limit),
  ])
  return apiSuccess({ latest, history, source: 'admin' })
}
