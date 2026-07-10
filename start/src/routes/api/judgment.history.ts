import { createFileRoute } from '@tanstack/react-router'
import { eq } from 'drizzle-orm'
import { selboInstances } from '@/db/schema.ts'
import { getDb } from '@/db/client.ts'
import {
  getLatestJudgment,
  getLatestAdminJudgment,
  getJudgmentHistory,
  ADMIN_INSTANCE_ID,
} from '@/services/judgment/judgment.service.ts'
import { apiSuccess } from '@/lib/api/response.ts'
import type { UserIdentity } from '@/data/user.ts'

/**
 * Query judgment history. Supports two modes:
 * - Authed user: returns their instance's latest judgment + history
 * - No auth: returns admin judgment (public dashboard)
 *
 * Auth is loaded lazily so missing SELBO_SESSION_SECRET does not break
 * the public admin path at module import time.
 */
async function tryGetOptionalUser(request: Request): Promise<UserIdentity | null> {
  const cookie = request.headers.get('Cookie')
  if (!cookie || !cookie.includes('selbo_session=')) return null
  try {
    const { getOptionalUser } = await import('@/lib/auth.ts')
    return await getOptionalUser(request)
  } catch {
    return null
  }
}

export const Route = createFileRoute('/api/judgment/history')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const asset = url.searchParams.get('asset') ?? 'ETH'
        const limit = Math.min(Number(url.searchParams.get('limit') ?? '50'), 200)

        const user = await tryGetOptionalUser(request)
        if (user) {
          const db = await getDb()
          const [instance] = await db
            .select()
            .from(selboInstances)
            .where(eq(selboInstances.userId, user.id))
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
          getJudgmentHistory(ADMIN_INSTANCE_ID, limit),
        ])
        return apiSuccess({ latest, history, source: 'admin' })
      },
    },
  },
})
