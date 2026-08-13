import { createFileRoute } from '@tanstack/react-router'
import {
  ensureAdminAgentExists,
  getActiveAgents,
  createDecision,
} from '@/services/decision/decision-service.ts'
import { executeDecision, getActiveExecutions } from '@/services/decision/execution-service.ts'
import { mapReadToEvidence } from '@/services/decision/map-read-to-evidence'
import { loadCandlesForAsset } from '@/services/judgment/candle-loader.ts'
import { runJudgmentPipeline } from '@/services/judgment/judgment-pipeline.ts'
import { loadQTable, lookupQTable, readToQFeatures } from '@/services/judgment/q-table'
import { sizePosition, computeOpenRisk, type PositionSizingConfig } from '@/services/judgment/position-sizing'
import { apiSuccess, apiError } from '@/lib/api/response.ts'

const POSITION_SIZING_CONFIG: PositionSizingConfig = {
  riskPerTradePct: 1.0,
  maxPortfolioHeatPct: 6.0,
  maxOpenPositions: 3,
  accountBalance: 10_000,
}

export const Route = createFileRoute('/admin/decision/tick')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const asset = url.searchParams.get('asset') ?? 'ETH'
        const adminOnly = url.searchParams.get('admin') === 'true'

        const now = new Date()

        // Load Q-table
        let qTable
        try {
          qTable = await loadQTable()
        } catch {
          return apiError('QTABLE_MISSING', 'Q-table not found. Run training script first.', 500)
        }

        // Check for duplicate decision (prevent stacking)
        const activeExecutions = await getActiveExecutions(asset)
        const hasOpenPosition = activeExecutions.length > 0

        const candles = await loadCandlesForAsset(asset, 200, '1h')
        if (candles.length === 0) {
          return apiError('NO_CANDLES', `No candle data for ${asset}`, 404)
        }

        const result = await runJudgmentPipeline(asset, '1h', candles)
        if (!result.read) {
          return apiError('PIPELINE_FAILED', 'Reader pipeline produced no read', 500)
        }

        // Q-table lookup
        const planReady = result.plan && result.plan.status !== 'no-trade'
        const planSide = planReady ? result.plan!.side : 'none'
        const qFeatures = readToQFeatures(result.read, planSide)
        const qResult = lookupQTable(qTable, qFeatures)

        // Determine action from plan + Q-table
        const qTableApproves = qResult.action === 'enter' && qResult.margin > 0

        let action: 'long' | 'short' | 'no_trade' = 'no_trade'
        if (planReady && qTableApproves && !hasOpenPosition) {
          action = result.plan!.side === 'long' ? 'long' : 'short'
        }

        // Conviction based on Q-table margin
        let conviction: 'low' | 'medium' | 'high' = 'low'
        if (planReady && action !== 'no_trade') {
          if (qResult.margin >= 0.5) conviction = 'high'
          else if (qResult.margin >= 0.2) conviction = 'medium'
          else conviction = 'low'
        }

        // Position sizing
        let positionSize: number | null = null
        let riskAmount: number | null = null
        if (planReady && action !== 'no_trade' && result.plan!.stop !== null) {
          const entryPrice = (result.plan!.entryLow + result.plan!.entryHigh) / 2
          const sizing = sizePosition({
            config: POSITION_SIZING_CONFIG,
            entryPrice,
            stopPrice: result.plan!.stop!,
            side: action as 'long' | 'short',
            currentOpenRisk: computeOpenRisk(activeExecutions),
            openPositionCount: activeExecutions.length,
          })

          if (!sizing.allowed) {
            action = 'no_trade'
          } else {
            positionSize = sizing.size
            riskAmount = sizing.riskAmount
          }
        }

        const evidence = mapReadToEvidence(result.read)

        const thesis = planReady && action !== 'no_trade'
          ? result.plan!.reasons.join('. ')
          : result.read.narrative

        const entryPrice = planReady && action !== 'no_trade'
          ? (result.plan!.entryLow + result.plan!.entryHigh) / 2
          : null

        if (adminOnly) {
          try {
            const adminAgentId = await ensureAdminAgentExists()
            const decision = await createDecision({
              agentId: adminAgentId,
              asset,
              action,
              entry: entryPrice,
              stop: planReady && result.plan!.stop !== null ? result.plan!.stop : null,
              target: planReady && result.plan!.target !== null ? result.plan!.target : null,
              invalidation: planReady && result.plan!.invalidation !== null ? result.plan!.invalidation : null,
              conviction,
              thesis,
              evidence,
            })

            let executionId: string | null = null
            if (action !== 'no_trade' && entryPrice !== null) {
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
              qTable: {
                action: qResult.action,
                margin: qResult.margin,
                enterQ: qResult.enterQ,
                skipQ: qResult.skipQ,
                found: qResult.found,
              },
              positionSize,
              riskAmount,
              hasOpenPosition,
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
              entry: entryPrice,
              stop: planReady && result.plan!.stop !== null ? result.plan!.stop : null,
              target: planReady && result.plan!.target !== null ? result.plan!.target : null,
              invalidation: planReady && result.plan!.invalidation !== null ? result.plan!.invalidation : null,
              conviction,
              thesis,
              evidence,
            })

            if (action !== 'no_trade' && entryPrice !== null) {
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
          qTable: {
            action: qResult.action,
            margin: qResult.margin,
            found: qResult.found,
          },
          positionSize,
          riskAmount,
          hasOpenPosition,
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
