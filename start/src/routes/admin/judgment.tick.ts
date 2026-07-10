import { createFileRoute } from '@tanstack/react-router'
import { eq, and } from 'drizzle-orm'
import { selboInstances } from '@/db/schema.ts'
import { getDb } from '@/db/client.ts'
import {
  runJudgmentForInstance,
  runAdminJudgment,
} from '@/services/judgment/judgment.service.ts'
import { apiSuccess, apiError } from '@/lib/api/response.ts'

/**
 * Manual trigger for judgment tick. Used for dev testing and admin force-runs.
 * In production, judgment is triggered via BullMQ queue (candle close events
 * from the ingestion service).
 */
export const Route = createFileRoute('/admin/judgment/tick')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const asset = url.searchParams.get('asset') ?? 'ETH'
        const adminOnly = url.searchParams.get('admin') === 'true'

        const now = new Date()

        if (adminOnly) {
          try {
            const result = await runAdminJudgment(asset)
            return apiSuccess({ ranAt: now.toISOString(), adminJudgment: result })
          } catch (e) {
            return apiError(
              'ADMIN_JUDGMENT_FAILED',
              e instanceof Error ? e.message : String(e),
              500,
            )
          }
        }

        const db = await getDb()
        const activeInstances = await db
          .select()
          .from(selboInstances)
          .where(
            and(
              eq(selboInstances.killSwitchActive, false),
              eq(selboInstances.betaAccessGranted, true),
            ),
          )

        const instanceResults = await Promise.allSettled(
          activeInstances.map((i) => runJudgmentForInstance(i.id)),
        )

        let adminResult:
          | { status: 'fulfilled'; value: unknown }
          | { status: 'rejected'; reason: unknown }
        try {
          const adminJudgment = await runAdminJudgment(asset)
          adminResult = { status: 'fulfilled' as const, value: adminJudgment }
        } catch (e) {
          adminResult = { status: 'rejected' as const, reason: e }
        }

        const summary = activeInstances.map((instance, idx) => {
          const r = instanceResults[idx]
          if (!r) return { instanceId: instance.id, status: 'missing' as const }
          return {
            instanceId: instance.id,
            status: r.status,
            ...(r.status === 'fulfilled'
              ? { judgmentId: r.value }
              : {
                  error:
                    r.reason instanceof Error ? r.reason.message : String(r.reason),
                }),
          }
        })

        return apiSuccess({
          ranAt: now.toISOString(),
          instanceCount: activeInstances.length,
          results: summary,
          adminJudgment: {
            status: adminResult.status,
            ...(adminResult.status === 'fulfilled'
              ? {
                  judgmentId: (adminResult.value as { judgmentId?: string })?.judgmentId,
                  side: (adminResult.value as { side?: string })?.side,
                }
              : {
                  error:
                    adminResult.reason instanceof Error
                      ? adminResult.reason.message
                      : String(adminResult.reason),
                }),
          },
        })
      },
    },
  },
})
