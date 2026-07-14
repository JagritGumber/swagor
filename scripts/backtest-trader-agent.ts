import { writeFileSync } from 'fs'
import { buildReaderHistoryReads } from '../packages/strategy-lab/reader/reader-history/build-reader-history-reads'
import { buildReaderTradePlan } from '../packages/strategy-lab/backtest/trade-plan/build-reader-trade-plan'
import { loadQTable, lookupQTable, readToQFeatures } from '../start/src/services/judgment/q-table'
import { sizePosition, type PositionSizingConfig } from '../start/src/services/judgment/position-sizing'
import { createExitState, evaluateExit, type ExitConfig, type ExitState } from '../start/src/services/judgment/exit-manager'
import { readOrderflowBuckets } from '../packages/market-data'
import { intervalMs } from '../packages/market-data'
import type { OrderflowBucket } from '../packages/market-data'
import type { OrderflowEvent, OrderflowSide } from '../packages/strategy-lab/read-core/orderflow/types'
import type { Candle } from '../packages/strategy-lab/types'

// ─── Config ────────────────────────────────────────────

const POSITION_CONFIG: PositionSizingConfig = {
  riskPerTradePct: 1.0,
  maxPortfolioHeatPct: 6.0,
  maxOpenPositions: 3,
  accountBalance: 100_000,
}

const EXIT_CONFIG: ExitConfig = {
  trailingStopActivationR: 1.5,
  trailingStopDistanceR: 0.5,
  timeExitCandles: 12,
  regimeShiftExits: true,
}

// ─── Types ─────────────────────────────────────────────

type BacktestTrade = {
  asset: string
  side: 'long' | 'short'
  entry: number
  entryTime: number
  stop: number
  target: number
  exit: number | null
  exitTime: number | null
  exitReason: string | null
  rMultiple: number | null
  size: number
  riskAmount: number
}

type BacktestSummary = {
  totalTrades: number
  wins: number
  losses: number
  winRate: number
  totalR: number
  avgR: number
  maxDrawdownR: number
  trades: BacktestTrade[]
}

// ─── Args ──────────────────────────────────────────────

function arg(name: string, def?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def
}

// ─── Bucket conversion (from runMarketStoreReaderReplayReport) ──

const MARKET_STORE_ROOT = 'D:\\Projects\\agoratest\\.data\\market-store'

function candlesFromBuckets(buckets: OrderflowBucket[], candleIntervalMs: number): Candle[] {
  const candles: Candle[] = []
  let current: Candle | null = null
  let currentStart = 0

  for (const bucket of buckets) {
    const start = Math.floor(bucket.bucketMs / candleIntervalMs) * candleIntervalMs
    if (!current || start !== currentStart) {
      if (current) candles.push(current)
      currentStart = start
      current = {
        t: start,
        o: bucket.open,
        h: bucket.high,
        l: bucket.low,
        c: bucket.close,
        v: bucket.buyVolume + bucket.sellVolume,
      }
      continue
    }

    current.h = Math.max(current.h, bucket.high)
    current.l = Math.min(current.l, bucket.low)
    current.c = bucket.close
    current.v += bucket.buyVolume + bucket.sellVolume
  }

  if (current) candles.push(current)
  return candles
}

function orderflowEventsFromBuckets(asset: string, buckets: OrderflowBucket[]): OrderflowEvent[] {
  const events: OrderflowEvent[] = []
  for (const bucket of buckets) {
    const largestSide = bucket.largestTradeSide
    const largestSize = Math.max(0, bucket.largestTradeSize)
    if (largestSize > 0) {
      events.push({
        type: 'trade',
        receivedAt: bucket.bucketMs,
        trade: {
          asset,
          side: largestSide as OrderflowSide,
          price: Number.isFinite(bucket.largestTradePrice) && bucket.largestTradePrice > 0
            ? bucket.largestTradePrice
            : bucket.close,
          size: largestSize,
          time: bucket.bucketMs,
          id: `${bucket.bucketMs}:largest:${largestSide}`,
        },
      })
    }

    const buyResidual = Math.max(0, bucket.buyVolume - (largestSide === 'buy' ? largestSize : 0))
    const sellResidual = Math.max(0, bucket.sellVolume - (largestSide === 'sell' ? largestSize : 0))
    if (buyResidual > 0) {
      events.push({
        type: 'trade',
        receivedAt: bucket.bucketMs + 1,
        trade: {
          asset,
          side: 'buy' as OrderflowSide,
          price: bucket.close,
          size: buyResidual,
          time: bucket.bucketMs + 1,
          id: `${bucket.bucketMs}:buy-residual`,
        },
      })
    }
    if (sellResidual > 0) {
      events.push({
        type: 'trade',
        receivedAt: bucket.bucketMs + 2,
        trade: {
          asset,
          side: 'sell' as OrderflowSide,
          price: bucket.close,
          size: sellResidual,
          time: bucket.bucketMs + 2,
          id: `${bucket.bucketMs}:sell-residual`,
        },
      })
    }
  }
  return events
}

// ─── Main ──────────────────────────────────────────────

async function main() {
  const asset = (arg('asset') ?? 'BTC').toUpperCase()
  const symbol = `${asset}USDT`
  const start = arg('start')
  const end = arg('end')
  const out = arg('out', 'trader-agent-backtest.json')

  if (!start || !end) {
    console.error('usage: bun run backtest-trader-agent.ts --start YYYY-MM-DD --end YYYY-MM-DD [--asset BTC] [--out file.json]')
    process.exit(1)
  }

  const startMs = Date.parse(`${start}T00:00:00Z`)
  const endMs = Date.parse(`${end}T23:59:59.999Z`)
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
    console.error('invalid date range')
    process.exit(1)
  }

  const candleIntervalMs = intervalMs('1h')
  console.log(`[backtest] loading market-store data for ${symbol} ${start} -> ${end}`)

  // Load orderflow buckets from market-store (includes extra warmup)
  const warmupMs = 200 * candleIntervalMs
  const buckets = await readOrderflowBuckets({
    rootDir: MARKET_STORE_ROOT,
    venue: 'bybit',
    market: 'trading',
    symbol,
    startMs: startMs - warmupMs,
    endMs: endMs + candleIntervalMs,
  })
  console.log(`[backtest] loaded ${buckets.length} orderflow buckets`)

  if (buckets.length === 0) {
    console.error(`[backtest] no market-store data for ${symbol}. Only BTCUSDT is available.`)
    process.exit(1)
  }

  const candles = candlesFromBuckets(buckets, candleIntervalMs)
  const orderflowEvents = orderflowEventsFromBuckets(asset, buckets)
  console.log(`[backtest] derived ${candles.length} candles, ${orderflowEvents.length} orderflow events`)

  // Load Q-table
  const qTable = await loadQTable()
  console.log(`[backtest] loaded Q-table with ${qTable.size} entries`)

  // Build reader reads for the entire period
  console.log(`[backtest] building reader reads...`)
  const steps = buildReaderHistoryReads({
    asset,
    interval: '1h',
    candleIntervalMs,
    candles,
    orderflowEvents,
    readIntervalMs: candleIntervalMs,
    orderflowWindowMs: 60_000,
    startAt: startMs,
    endAt: endMs,
  })
  console.log(`[backtest] produced ${steps.length} reads`)

  // ─── Simulation loop ────────────────────────────────

  const trades: BacktestTrade[] = []
  const openPositions: Map<string, {
    trade: BacktestTrade
    exitState: ExitState
  }> = new Map()

  let totalRisk = 0
  let peakEquity = POSITION_CONFIG.accountBalance
  let equity = POSITION_CONFIG.accountBalance
  let maxDrawdownR = 0
  let planReadyCount = 0
  let qTableApproveCount = 0
  const blockReasons = new Map<string, number>()

  for (const step of steps) {
    const read = step.read
    const candle = read.lastClosedCandle
    if (!candle) continue

    // ── Check exits on open positions ─────────────────
    for (const [id, pos] of openPositions) {
      const exitDecision = evaluateExit(
        pos.exitState,
        candle.c,
        candle.h,
        candle.l,
        read,
        EXIT_CONFIG,
      )

      Object.assign(pos.exitState, exitDecision.updatedState)

      if (exitDecision.shouldExit && exitDecision.exitPrice !== undefined && exitDecision.exitType !== undefined) {
        const risk = Math.abs(pos.trade.entry - pos.trade.stop)
        const move = pos.trade.side === 'long'
          ? exitDecision.exitPrice - pos.trade.entry
          : pos.trade.entry - exitDecision.exitPrice
        const rMultiple = risk > 0 ? move / risk : 0

        pos.trade.exit = exitDecision.exitPrice
        pos.trade.exitTime = step.now
        pos.trade.exitReason = exitDecision.exitType
        pos.trade.rMultiple = Math.round(rMultiple * 100) / 100

        totalRisk -= pos.trade.riskAmount
        equity += pos.trade.riskAmount * rMultiple
        if (equity > peakEquity) peakEquity = equity
        const dd = (peakEquity - equity) / POSITION_CONFIG.accountBalance * 100
        if (dd > maxDrawdownR) maxDrawdownR = dd

        trades.push(pos.trade)
        openPositions.delete(id)
      }
    }

    // ── Build trade plan ──────────────────────────────
    const plan = buildReaderTradePlan(read)
    const planReady = plan.status !== 'no-trade'
    if (planReady) {
      planReadyCount++
    } else if (plan.status === 'no-trade' && plan.reasons.length > 0) {
      const reason = plan.reasons[0]
      blockReasons.set(reason, (blockReasons.get(reason) ?? 0) + 1)
    }
    if (!planReady) continue

    // ── Q-table lookup ────────────────────────────────
    const qFeatures = readToQFeatures(read, plan.side)
    const qResult = lookupQTable(qTable, qFeatures)
    const qTableApproves = qResult.action === 'enter' && qResult.margin > 0
    if (!qTableApproves) continue

    // Debug: print first few matches
    if (qTableApproveCount < 5) {
      console.log(`[debug] Q-table match: pressure=${qFeatures.pressure} initiative=${qFeatures.initiativeSide} conviction=${qFeatures.initiativeConviction} delta=${qFeatures.deltaDirection} absorption=${qFeatures.absorptionEvent} side=${qFeatures.side} intent=${qFeatures.narrativeIntent} dir=${qFeatures.narrativeDirection}`)
      console.log(`[debug] Q(enter)=${qResult.enterQ.toFixed(3)} Q(skip)=${qResult.skipQ.toFixed(3)} margin=${qResult.margin.toFixed(3)}`)
    }
    qTableApproveCount++

    // ── Duplicate check ───────────────────────────────
    const hasOpen = [...openPositions.values()].some(p => p.trade.asset === asset)
    if (hasOpen) continue

    // ── Position sizing ───────────────────────────────
    const entryPrice = (plan.entryLow + plan.entryHigh) / 2
    const sizing = sizePosition({
      config: POSITION_CONFIG,
      entryPrice,
      stopPrice: plan.stop,
      side: plan.side,
      currentOpenRisk: totalRisk,
      openPositionCount: openPositions.size,
    })
    if (!sizing.allowed) continue

    // ── Enter trade ───────────────────────────────────
    const trade: BacktestTrade = {
      asset,
      side: plan.side,
      entry: entryPrice,
      entryTime: step.now,
      stop: plan.stop,
      target: plan.target,
      exit: null,
      exitTime: null,
      exitReason: null,
      rMultiple: null,
      size: sizing.size,
      riskAmount: sizing.riskAmount,
    }

    const exitState = createExitState(
      `bt-${trades.length + openPositions.size}`,
      entryPrice,
      plan.stop,
      plan.side,
      read.regime?.mode ?? null,
    )

    openPositions.set(trade.entryTime.toString(), { trade, exitState })
    totalRisk += sizing.riskAmount
  }

  // ── Close remaining positions at last price ──────────
  const lastStep = steps[steps.length - 1]
  if (lastStep?.read.lastClosedCandle) {
    const lastPrice = lastStep.read.lastClosedCandle.c
    for (const [id, pos] of openPositions) {
      const risk = Math.abs(pos.trade.entry - pos.trade.stop)
      const move = pos.trade.side === 'long'
        ? lastPrice - pos.trade.entry
        : pos.trade.entry - lastPrice
      const rMultiple = risk > 0 ? move / risk : 0

      pos.trade.exit = lastPrice
      pos.trade.exitTime = lastStep.now
      pos.trade.exitReason = 'end-of-data'
      pos.trade.rMultiple = Math.round(rMultiple * 100) / 100
      trades.push(pos.trade)
    }
  }

  // ── Summary ─────────────────────────────────────────

  console.log(`\n[backtest] ${asset} ${start} -> ${end}`)
  console.log(`  Reads: ${steps.length}`)
  console.log(`  Plans ready: ${planReadyCount}`)
  console.log(`  Q-table approves: ${qTableApproveCount}`)
  console.log(`  Top block reasons:`)
  const sorted = [...blockReasons.entries()].sort((a, b) => b[1] - a[1])
  for (const [reason, count] of sorted.slice(0, 5)) {
    console.log(`    ${count}x ${reason}`)
  }

  const wins = trades.filter(t => (t.rMultiple ?? 0) > 0).length
  const losses = trades.filter(t => (t.rMultiple ?? 0) <= 0).length
  const totalR = trades.reduce((s, t) => s + (t.rMultiple ?? 0), 0)

  const summary: BacktestSummary = {
    totalTrades: trades.length,
    wins,
    losses,
    winRate: trades.length > 0 ? Math.round((wins / trades.length) * 1000) / 10 : 0,
    totalR: Math.round(totalR * 100) / 100,
    avgR: trades.length > 0 ? Math.round((totalR / trades.length) * 1000) / 1000 : 0,
    maxDrawdownR: Math.round(maxDrawdownR * 100) / 100,
    trades,
  }

  console.log(`\n[backtest] ${asset} ${start} -> ${end}`)
  console.log(`  Trades: ${summary.totalTrades}`)
  console.log(`  Win rate: ${summary.winRate}%`)
  console.log(`  Total R: ${summary.totalR > 0 ? '+' : ''}${summary.totalR}R`)
  console.log(`  Avg R/trade: ${summary.avgR}R`)
  console.log(`  Max drawdown: ${summary.maxDrawdownR}%`)

  // Write output
  const result = {
    config: {
      asset,
      start,
      end,
      positionConfig: POSITION_CONFIG,
      exitConfig: EXIT_CONFIG,
      qTableEntries: qTable.size,
    },
    summary: {
      totalTrades: summary.totalTrades,
      wins: summary.wins,
      losses: summary.losses,
      winRate: summary.winRate,
      totalR: summary.totalR,
      avgR: summary.avgR,
      maxDrawdownR: summary.maxDrawdownR,
    },
    trades: summary.trades.map(t => ({
      ...t,
      entryTime: new Date(t.entryTime).toISOString(),
      exitTime: t.exitTime ? new Date(t.exitTime).toISOString() : null,
    })),
  }

  await writeFileSync(out, JSON.stringify(result, null, 2))
  console.log(`\n[backtest] wrote ${out}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
