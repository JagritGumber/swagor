import { createFileRoute } from '@tanstack/react-router'
import { eq } from 'drizzle-orm'
import { getDb } from '@/db/client.ts'
import { agents } from '@/db/schema.ts'
import {
  getLatestDecision,
  getDecisionHistory,
  getLatestAdminDecision,
  ADMIN_AGENT_ID,
} from '@/services/decision/decision-service.ts'
import { apiSuccess } from '@/lib/api/response.ts'

async function tryGetOptionalUser(request: Request) {
  const cookie = request.headers.get('Cookie')
  if (!cookie || !cookie.includes('selbo_session=')) return null
  try {
    const { getOptionalUser } = await import('@/lib/auth.ts')
    return await getOptionalUser(request)
  } catch {
    return null
  }
}

export const Route = createFileRoute('/api/decisions')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const asset = url.searchParams.get('asset') ?? 'ETH'
        const limit = Math.min(Number(url.searchParams.get('limit') ?? '50'), 200)

        const user = await tryGetOptionalUser(request)
        if (user) {
          const db = await getDb()
          const [agent] = await db
            .select()
            .from(agents)
            .where(eq(agents.userId, user.id))
            .limit(1)

          if (agent) {
            const [latest, history] = await Promise.all([
              getLatestDecision(agent.id),
              getDecisionHistory(agent.id, limit),
            ])
            return apiSuccess({ latest, history, source: 'user' })
          }
        }

        const [latest, history] = await Promise.all([
          getLatestAdminDecision(asset),
          getDecisionHistory(ADMIN_AGENT_ID, limit),
        ])
        return apiSuccess({ latest, history, source: 'admin' })
      },
    },
  },
})
