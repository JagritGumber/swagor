import { writeFileSync } from 'fs'
import { readOrderflowBuckets, intervalMs } from '../packages/market-data'
import { measurementsFromBuckets } from '../start/src/services/trader-agent-v2/measurement'
import { engineerFeatures } from '../start/src/services/trader-agent-v2/feature-engineering'
import { createTrainingSamples, splitTrainingData } from '../start/src/services/trader-agent-v2/training'
import { trainAssessmentEngine, assessState } from '../start/src/services/trader-agent-v2/state-assessment'
import { evaluateRisk } from '../start/src/services/trader-agent-v2/risk-management'
import { createPosition, evaluateExit, type Position, type ExitConfig } from '../start/src/services/trader-agent-v2/execution'

const MARKET_STORE_ROOT = 'D:\\Projects\\agoratest\\.data\\market-store'

const EXIT_CONFIG: ExitConfig = {
  trailingStopActivationR: 1.5,
  trailingStopDistanceR: 0.5,
  timeExitCandles: 12,
}

function arg(name: string, def?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def
}

type BacktestTrade = {
  side: 'long' | 'short'
  entry: number
  entryTime: number
  stop: number
  target: number
  exit: number | null
  exitTime: number | null
  exitReason: string | null
  returnBps: number | null
  size: number
  riskAmount: number
}

async function main() {
  const asset = (arg('asset') ?? 'BTC').toUpperCase()
  const symbol = `${asset}USDT`
  const trainStart = arg('train-start') ?? '2025-05-01'
  const trainEnd = arg('train-end') ?? '2025-07-31'
  const testStart = arg('test-start') ?? '2025-08-01'
  const testEnd = arg('test-end') ?? '2025-10-31'
  const out = arg('out', 'trader-agent-v2-backtest.json')

  const candleIntervalMs = intervalMs('1h')
  const windowMs = 60 * 60 * 1000 // 1 hour instead of 5 minutes

  console.log(`[backtest] Training on ${trainStart} -> ${trainEnd}`)
  console.log(`[backtest] Testing on ${testStart} -> ${testEnd}`)

  // Load training data
  const trainStartMs = Date.parse(`${trainStart}T00:00:00Z`)
  const trainEndMs = Date.parse(`${trainEnd}T23:59:59.999Z`)
  console.log(`[backtest] Loading training buckets...`)
  const trainBuckets = await readOrderflowBuckets({
    rootDir: MARKET_STORE_ROOT,
    venue: 'bybit',
    market: 'trading',
    symbol,
    startMs: trainStartMs,
    endMs: trainEndMs,
  })
  console.log(`[backtest] Loaded ${trainBuckets.length} training buckets`)

  // Create measurements and features
  const trainMeasurements = measurementsFromBuckets(trainBuckets, { windowMs, symbol })
  const trainFeatures = engineerFeatures(trainMeasurements)
  const trainSamples = createTrainingSamples(trainFeatures)
  console.log(`[backtest] Created ${trainSamples.length} training samples`)

  // Train model
  console.log(`[backtest] Training state assessment engine...`)
  const model = trainAssessmentEngine(trainSamples, {
    learningRate: 0.01,
    epochs: 100,
    thresholdBps: 1,
  })
  console.log(`[backtest] Model trained`)

  // Load test data
  const testStartMs = Date.parse(`${testStart}T00:00:00Z`)
  const testEndMs = Date.parse(`${testEnd}T23:59:59.999Z`)
  console.log(`[backtest] Loading test buckets...`)
  const testBuckets = await readOrderflowBuckets({
    rootDir: MARKET_STORE_ROOT,
    venue: 'bybit',
    market: 'trading',
    symbol,
    startMs: testStartMs,
    endMs: testEndMs,
  })
  console.log(`[backtest] Loaded ${testBuckets.length} test buckets`)

  const testMeasurements = measurementsFromBuckets(testBuckets, { windowMs, symbol })
  const testFeatures = engineerFeatures(testMeasurements)
  console.log(`[backtest] Created ${testFeatures.length} test measurements`)

  // Run backtest
  const trades: BacktestTrade[] = []
  const openPositions: Map<string, Position> = new Map()
  let totalRisk = 0
  let equity = 100_000
  let peakEquity = equity

  for (const features of testFeatures) {
    // Check exits on open positions
    for (const [id, pos] of openPositions) {
      const m = features.measurement
      const exitDecision = evaluateExit(pos, m.close, m.high, m.low, EXIT_CONFIG)

      if (exitDecision.shouldExit && exitDecision.exitPrice !== undefined) {
        const returnBps = pos.side === 'long'
          ? (exitDecision.exitPrice - pos.entryPrice) / pos.entryPrice * 10000
          : (pos.entryPrice - exitDecision.exitPrice) / pos.entryPrice * 10000

        trades.push({
          side: pos.side,
          entry: pos.entryPrice,
          entryTime: pos.entryTime,
          stop: pos.stopPrice,
          target: pos.targetPrice,
          exit: exitDecision.exitPrice,
          exitTime: features.timestamp,
          exitReason: exitDecision.exitReason ?? null,
          returnBps,
          size: pos.size,
          riskAmount: pos.riskAmount,
        })

        totalRisk -= pos.riskAmount
        equity += pos.riskAmount * (returnBps / 100)
        if (equity > peakEquity) peakEquity = equity

        openPositions.delete(id)
      }
    }

    // Assess state
    const assessment = assessState(model, features)

    // Risk management
    const riskDecision = evaluateRisk(
      assessment,
      features.measurement.close,
      totalRisk,
      openPositions.size,
      {
        riskPerTradePct: 1.0,
        maxPortfolioHeatPct: 6.0,
        maxOpenPositions: 3,
        accountBalance: equity,
        scoreThreshold: 0.55,
      },
    )

    if (riskDecision.action === 'enter' && riskDecision.entryPrice !== null && riskDecision.stopPrice !== null && riskDecision.targetPrice !== null) {
      const position = createPosition(
        `pos-${trades.length + openPositions.size}`,
        riskDecision.side!,
        riskDecision.entryPrice,
        features.timestamp,
        riskDecision.stopPrice,
        riskDecision.targetPrice,
        riskDecision.size,
        riskDecision.riskAmount,
      )
      openPositions.set(position.id, position)
      totalRisk += riskDecision.riskAmount
    }
  }

  // Close remaining positions
  const lastFeature = testFeatures[testFeatures.length - 1]
  if (lastFeature) {
    for (const [id, pos] of openPositions) {
      const returnBps = pos.side === 'long'
        ? (lastFeature.measurement.close - pos.entryPrice) / pos.entryPrice * 10000
        : (pos.entryPrice - lastFeature.measurement.close) / pos.entryPrice * 10000

      trades.push({
        side: pos.side,
        entry: pos.entryPrice,
        entryTime: pos.entryTime,
        stop: pos.stopPrice,
        target: pos.targetPrice,
        exit: lastFeature.measurement.close,
        exitTime: lastFeature.timestamp,
        exitReason: 'end-of-data',
        returnBps,
        size: pos.size,
        riskAmount: pos.riskAmount,
      })
    }
  }

  // Calculate metrics
  const wins = trades.filter(t => (t.returnBps ?? 0) > 0).length
  const losses = trades.filter(t => (t.returnBps ?? 0) <= 0).length
  const totalReturnBps = trades.reduce((sum, t) => sum + (t.returnBps ?? 0), 0)
  const avgReturnBps = trades.length > 0 ? totalReturnBps / trades.length : 0
  const avgWin = wins > 0 ? trades.filter(t => (t.returnBps ?? 0) > 0).reduce((sum, t) => sum + (t.returnBps ?? 0), 0) / wins : 0
  const avgLoss = losses > 0 ? Math.abs(trades.filter(t => (t.returnBps ?? 0) <= 0).reduce((sum, t) => sum + (t.returnBps ?? 0), 0) / losses) : 0
  const positiveExpectancy = avgWin > avgLoss
  const profitFactor = avgLoss > 0 ? avgWin / avgLoss : avgWin > 0 ? Infinity : 0
  const maxDrawdownPct = ((peakEquity - equity) / peakEquity) * 100

  console.log(`\n[backtest] ${symbol} ${testStart} -> ${testEnd}`)
  console.log(`  Trades: ${trades.length}`)
  console.log(`  Wins: ${wins}, Losses: ${losses}`)
  console.log(`  Avg return: ${avgReturnBps.toFixed(1)} bps`)
  console.log(`  Positive expectancy: ${positiveExpectancy}`)
  console.log(`  Profit factor: ${profitFactor.toFixed(2)}`)
  console.log(`  Max drawdown: ${maxDrawdownPct.toFixed(2)}%`)

  // Write output
  const result = {
    config: {
      symbol,
      trainStart,
      trainEnd,
      testStart,
      testEnd,
      windowMs,
      thresholdBps: 50,
    },
    metrics: {
      totalTrades: trades.length,
      wins,
      losses,
      avgReturnBps: Math.round(avgReturnBps * 10) / 10,
      positiveExpectancy,
      profitFactor: Math.round(profitFactor * 100) / 100,
      maxDrawdownPct: Math.round(maxDrawdownPct * 100) / 100,
    },
    trades: trades.map(t => ({
      ...t,
      entryTime: new Date(t.entryTime).toISOString(),
      exitTime: t.exitTime ? new Date(t.exitTime).toISOString() : null,
    })),
  }

  writeFileSync(out, JSON.stringify(result, null, 2))
  console.log(`\n[backtest] wrote ${out}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
