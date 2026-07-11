import { createFileRoute } from '@tanstack/react-router'
import {
  ensureAdminAgentExists,
  getActiveAgents,
  createDecision,
} from '@/services/decision/decision-service.ts'
import { apiSuccess, apiError } from '@/lib/api/response.ts'

/**
 * Manual trigger for decision tick. Used for dev testing and admin force-runs.
 * In production, decisions are triggered via the judgment pipeline on candle close.
 */
export const Route = createFileRoute('/admin/decision/tick')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const asset = url.searchParams.get('asset') ?? 'ETH'
        const adminOnly = url.searchParams.get('admin') === 'true'

        const now = new Date()

        if (adminOnly) {
          try {
            const adminAgentId = await ensureAdminAgentExists()
            // TODO: run judgment pipeline and create decision
            // For now, return a placeholder
            return apiSuccess({
              ranAt: now.toISOString(),
              agentId: adminAgentId,
              asset,
              status: 'pipeline_not_wired',
            })
          } catch (e) {
            return apiError(
              'ADMIN_DECISION_FAILED',
              e instanceof Error ? e.message : String(e),
              500,
            )
          }
        }

        const activeAgents = await getActiveAgents()
        const results = await Promise.allSettled(
          activeAgents.map((agent) =>
            createDecision({
              agentId: agent.id,
              asset,
              action: 'no_trade',
              conviction: 'low',
              evidence: [],
            }),
          ),
        )

        return apiSuccess({
          ranAt: now.toISOString(),
          agentCount: activeAgents.length,
          results: results.map((r, i) => ({
            agentId: activeAgents[i]!.id,
            status: r.status,
            ...(r.status === 'fulfilled'
              ? { decisionId: r.value.id }
              : { error: r.reason instanceof Error ? r.reason.message : String(r.reason) }),
          })),
        })
      },
    },
  },
})
