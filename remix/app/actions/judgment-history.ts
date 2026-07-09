import { Auth } from 'remix/middleware/auth'
import type { AppContext } from '../router.ts'
import { eq } from 'drizzle-orm'
import { selboInstances } from '../db/schema.ts'
import { getDb } from '../db/client.ts'
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
    const db = await getDb()
    const [instance] = await db
      .select()
      .from(selboInstances)
      .where(eq(selboInstances.userId, auth.identity.id))
      .limit(1)

    if (instance) {
      const [latest, history] = await Promise.all([
        getLatestJudgment(instance.id),
        getJudgmentHistory(instance.id, limit),
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
