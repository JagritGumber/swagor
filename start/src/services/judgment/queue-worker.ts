import { Worker, Job } from 'bullmq'
import { runJudgmentPipeline } from './judgment-pipeline.ts'
import { loadCandlesForAsset } from './candle-loader.ts'
import { getSSEManager } from '@/services/sse/sse-manager'
import { ensureAdminAgentExists, createDecision } from '@/services/decision/decision-service.ts'
import { executeDecision, getActiveExecutions } from '@/services/decision/execution-service.ts'
import { mapReadToEvidence } from '@/services/decision/map-read-to-evidence'
import { loadQTable, lookupQTable, readToQFeatures } from './q-table'
import { sizePosition, computeOpenRisk, type PositionSizingConfig } from './position-sizing'

type CandleCloseMessage = {
  asset: string
  interval: string
  candle: {
    t: number
    o: number
    h: number
    l: number
    c: number
    v: number
  }
}

const POSITION_SIZING_CONFIG: PositionSizingConfig = {
  riskPerTradePct: 1.0,
  maxPortfolioHeatPct: 6.0,
  maxOpenPositions: 3,
  accountBalance: 10_000,
}

let worker: Worker<CandleCloseMessage> | null = null

export function startJudgmentWorker(redisUrl: string): void {
  if (worker) return

  worker = new Worker<CandleCloseMessage>(
    'judgment-tick',
    async (job: Job<CandleCloseMessage>) => {
      const { asset } = job.data
      console.log(`[judgment-worker] processing candle close for ${asset}`)

      try {
        const sseManager = getSSEManager()
        const candles = await loadCandlesForAsset(asset, 200, '1h')
        if (candles.length === 0) return { processed: true, asset }

        const result = await runJudgmentPipeline(asset, '1h', candles)
        if (!result.read) return { processed: true, asset }

        // Broadcast read to subscribers
        if (sseManager.getSubscriberCount(asset) > 0) {
          sseManager.broadcast(asset, 'judgment-update', {
            asset,
            regime: result.read.regime ?? null,
            auction: {
              location: result.read.auction.location,
              bias: result.read.auction.bias,
              narrative: result.read.auction.narrative,
            },
            stance: result.read.stance,
            confidence: result.plan?.status !== 'no-trade' ? result.plan.confidence : 0,
            narrative: result.read.narrative,
            updatedAt: result.updatedAt,
          })
        }

        // Q-table lookup + decision creation
        let qTable
        try {
          qTable = await loadQTable()
        } catch {
          // Q-table not available, skip decision creation
          return { processed: true, asset }
        }

        const activeExecutions = await getActiveExecutions(asset)
        const hasOpenPosition = activeExecutions.length > 0

        const planReady = result.plan && result.plan.status !== 'no-trade'
        const qFeatures = readToQFeatures(result.read, planReady ? result.plan!.side : 'none')
        const qResult = lookupQTable(qTable, qFeatures)

        const qTableApproves = qResult.action === 'enter' && qResult.margin > 0

        let action: 'long' | 'short' | 'no_trade' = 'no_trade'
        if (planReady && qTableApproves && !hasOpenPosition) {
          action = result.plan!.side === 'long' ? 'long' : 'short'
        }

        let conviction: 'low' | 'medium' | 'high' = 'low'
        if (planReady && action !== 'no_trade') {
          if (qResult.margin >= 0.5) conviction = 'high'
          else if (qResult.margin >= 0.2) conviction = 'medium'
          else conviction = 'low'
        }

        let positionSize: number | null = null
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
          }
        }

        if (action !== 'no_trade' && planReady) {
          const adminAgentId = await ensureAdminAgentExists()
          const evidence = mapReadToEvidence(result.read)
          const entryPrice = (result.plan!.entryLow + result.plan!.entryHigh) / 2

          const decision = await createDecision({
            agentId: adminAgentId,
            asset,
            action,
            entry: entryPrice,
            stop: result.plan!.stop,
            target: result.plan!.target,
            invalidation: result.plan!.invalidation,
            conviction,
            thesis: result.plan!.reasons.join('. '),
            evidence,
          })

          await executeDecision({
            decisionId: decision.id,
            entryPrice,
            agentMode: 'paper',
          })

          console.log(`[judgment-worker] created decision: ${action} ${asset} @ ${entryPrice} (size: ${positionSize})`)
        }
      } catch (err) {
        console.error(`[judgment-worker] judgment pipeline failed for ${asset}:`, err)
      }

      return { processed: true, asset }
    },
    {
      connection: {
        host: new URL(redisUrl).hostname,
        port: Number(new URL(redisUrl).port) || 6379,
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
      },
      concurrency: 1,
      limiter: {
        max: 10,
        duration: 60_000,
      },
    },
  )

  worker.on('completed', (job) => {
    console.log(`[judgment-worker] completed: ${job.data.asset}:${job.data.interval}`)
  })

  worker.on('failed', (job, err) => {
    console.error(`[judgment-worker] failed: ${job?.data.asset}:${job?.data.interval}`, err.message)
  })

  console.log('[judgment-worker] started, listening on queue "judgment-tick"')
}

export async function stopJudgmentWorker(): Promise<void> {
  if (worker) {
    await worker.close()
    worker = null
  }
}
