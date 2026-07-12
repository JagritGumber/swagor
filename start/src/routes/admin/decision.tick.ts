import { createFileRoute } from '@tanstack/react-router'
import {
  ensureAdminAgentExists,
  getActiveAgents,
  createDecision,
} from '@/services/decision/decision-service.ts'
import { executeDecision } from '@/services/decision/execution-service.ts'
import { mapReadToEvidence } from '@/services/decision/map-read-to-evidence'
import { loadCandlesForAsset } from '@/services/judgment/candle-loader.ts'
import { runJudgmentPipeline } from '@/services/judgment/judgment-pipeline.ts'
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

        const candles = await loadCandlesForAsset(asset, 200, '1h')
        if (candles.length === 0) {
          return apiError('NO_CANDLES', `No candle data for ${asset}`, 404)
        }

        const result = await runJudgmentPipeline(asset, '1h', candles)
        if (!result.read) {
          return apiError('PIPELINE_FAILED', 'Reader pipeline produced no read', 500)
        }

        const action = result.plan && result.plan.status !== 'no-trade'
          ? (result.plan.side === 'long' ? 'long' as const : 'short' as const)
          : 'no_trade' as const

        const conviction = result.plan && result.plan.status !== 'no-trade'
          ? (result.plan.confidence >= 0.7 ? 'high' as const : result.plan.confidence >= 0.5 ? 'medium' as const : 'low' as const)
          : 'low' as const

        const evidence = mapReadToEvidence(result.read)

        const thesis = result.plan && result.plan.status !== 'no-trade'
          ? result.plan.reasons.join('. ')
          : result.read.narrative

        if (adminOnly) {
          try {
            const adminAgentId = await ensureAdminAgentExists()
            const decision = await createDecision({
              agentId: adminAgentId,
              asset,
              action,
              entry: result.plan && result.plan.status !== 'no-trade'
                ? (result.plan.entryLow + result.plan.entryHigh) / 2
                : null,
              stop: result.plan && result.plan.status !== 'no-trade' ? result.plan.stop : null,
              target: result.plan && result.plan.status !== 'no-trade' ? result.plan.target : null,
              invalidation: result.plan && result.plan.status !== 'no-trade' ? result.plan.invalidation : null,
              conviction,
              thesis,
              evidence,
            })

            let executionId: string | null = null
            if (action !== 'no_trade' && result.plan && result.plan.status !== 'no-trade') {
              const entryPrice = (result.plan.entryLow + result.plan.entryHigh) / 2
              const execution = await executeDecision({
                decisionId: decision.id,
                entryPrice,
                agentMode: 'paper',
              })
              executionId = execution.id
            }

            return apiSuccess({
              ranAt: now.toISOString(),
              agentId: adminAgentId,
              asset,
              decisionId: decision.id,
              executionId,
              action,
              stance: result.read.stance,
              status: 'ok',
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
          activeAgents.map(async (agent) => {
            const decision = await createDecision({
              agentId: agent.id,
              asset,
              action,
              entry: result.plan && result.plan.status !== 'no-trade'
                ? (result.plan.entryLow + result.plan.entryHigh) / 2
                : null,
              stop: result.plan && result.plan.status !== 'no-trade' ? result.plan.stop : null,
              target: result.plan && result.plan.status !== 'no-trade' ? result.plan.target : null,
              invalidation: result.plan && result.plan.status !== 'no-trade' ? result.plan.invalidation : null,
              conviction,
              thesis,
              evidence,
            })

            if (action !== 'no_trade' && result.plan && result.plan.status !== 'no-trade') {
              const entryPrice = (result.plan.entryLow + result.plan.entryHigh) / 2
              await executeDecision({
                decisionId: decision.id,
                entryPrice,
                agentMode: agent.mode,
              })
            }

            return decision
          }),
        )

        return apiSuccess({
          ranAt: now.toISOString(),
          agentCount: activeAgents.length,
          action,
          stance: result.read.stance,
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
