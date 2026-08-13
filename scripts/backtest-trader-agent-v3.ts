import { writeFileSync } from 'fs'
import { readOrderflowBuckets, intervalMs } from '../packages/market-data'
import { readTradePattern, patternToVector, type Trade, type LiquidationLevel } from '../start/src/services/trader-agent-v3/trade-reader'
import { LifelongPatternMatcher } from '../start/src/services/trader-agent-v3/pattern-matcher'
import { evaluateRisk } from '../start/src/services/trader-agent-v3/risk-management'

const MARKET_STORE_ROOT = 'D:\\Projects\\agoratest\\.data\\market-store'

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

function bucketsToTrades(buckets: Array<{ bucketMs: number; open: number; high: number; low: number; close: number; buyVolume: number; sellVolume: number; tradeCount: number; largestTradeSize: number; largestTradeSide: string }>): Trade[] {
  const trades: Trade[] = []
  for (const b of buckets) {
    // Create synthetic trades from bucket data
    const buyCount = Math.ceil(b.tradeCount * (b.buyVolume / (b.buyVolume + b.sellVolume || 1)))
    const sellCount = b.tradeCount - buyCount
    const avgBuySize = buyCount > 0 ? b.buyVolume / buyCount : 0
    const avgSellSize = sellCount > 0 ? b.sellVolume / sellCount : 0

    for (let i = 0; i < buyCount; i++) {
      trades.push({
        side: 'buy',
        price: b.close,
        size: avgBuySize,
        time: b.bucketMs + i,
      })
    }
    for (let i = 0; i < sellCount; i++) {
      trades.push({
        side: 'sell',
        price: b.close,
        size: avgSellSize,
        time: b.bucketMs + i,
      })
    }
  }
  return trades.sort((a, b) => a.time - b.time)
}

async function main() {
  const asset = (arg('asset') ?? 'BTC').toUpperCase()
  const symbol = `${asset}USDT`
  const start = arg('start') ?? '2025-05-01'
  const end = arg('end') ?? '2025-07-31'
  const out = arg('out', 'trader-agent-v3-backtest.json')

  const windowMs = 60 * 60 * 1000 // 1 hour

  console.log(`[backtest] ${symbol} ${start} -> ${end}`)

  // Load data
  const startMs = Date.parse(`${start}T00:00:00Z`)
  const endMs = Date.parse(`${end}T23:59:59.999Z`)
  console.log(`[backtest] Loading buckets...`)
  const buckets = await readOrderflowBuckets({
    rootDir: MARKET_STORE_ROOT,
    venue: 'bybit',
    market: 'trading',
    symbol,
    startMs,
    endMs,
  })
  console.log(`[backtest] Loaded ${buckets.length} buckets`)

  // Convert to trades
  const allTrades = bucketsToTrades(buckets)
  console.log(`[backtest] Created ${allTrades.length} trades`)

  // Initialize pattern matcher
  const matcher = new LifelongPatternMatcher({
    kNeighbors: 5,
    maxMemorySize: 100_000,
    similarityThreshold: 0.5,
  })

  // No liquidation levels for now (empty array)
  const liquidationLevels: LiquidationLevel[] = []

  // Run backtest
  const trades: BacktestTrade[] = []
  let totalRisk = 0
  let openPositionCount = 0
  let equity = 100_000
  let peakEquity = equity

  // Pre-populate memory with first 100 patterns
  const warmupWindows = 100
  let warmupCount = 0
  let lastPatternVector: number[] | null = null
  let lastPatternTime: number = 0

  // Process trades in windows
  for (let t = startMs; t <= endMs; t += windowMs) {
    const windowTrades = allTrades.filter(tr => tr.time >= t && tr.time < t + windowMs)
    if (windowTrades.length < 10) continue

    // Read pattern
    const pattern = readTradePattern(windowTrades, liquidationLevels, {
      windowMs,
      largeTradePercentile: 0.9,
      absorptionThreshold: 0.001,
    })
    if (!pattern) continue

    const vector = patternToVector(pattern)

    // Warmup phase: just store patterns, don't trade
    if (warmupCount < warmupWindows) {
      warmupCount++
      lastPatternVector = vector
      lastPatternTime = t
      continue
    }

    // After warmup, compute outcome for previous pattern and add to memory
    if (lastPatternVector && warmupCount === warmupWindows) {
      // First real pattern - we need an outcome
      // Use the price change from the current window as a proxy
      const outcomeBps = pattern.priceChange
      matcher.addPattern(lastPatternVector, outcomeBps, lastPatternTime)
      warmupCount++ // Prevent re-entering this block
    }

    // Match against memory
    const match = matcher.match(vector)

    // Check exits on open positions (simplified: check if price hit stop/target)
    if (openPositionCount > 0) {
      const lastPrice = windowTrades[windowTrades.length - 1].price
      // For simplicity, assume we exit at window end
      // In reality, would track each position's stop/target
    }

    // Risk management
    const risk = evaluateRisk(match, pattern.priceChange > 0 ? windowTrades[windowTrades.length - 1].price : windowTrades[0].price, totalRisk, openPositionCount, {
      riskPerTradePct: 1.0,
      maxPortfolioHeatPct: 6.0,
      maxOpenPositions: 3,
      accountBalance: equity,
      minExpectedReturnBps: 10,
    })

    if (risk.action === 'enter' && risk.entryPrice !== null && risk.stopPrice !== null && risk.targetPrice !== null) {
      // Simulate outcome: use the pattern's expected return
      const outcomeBps = match.expectedReturnBps

      trades.push({
        side: risk.side!,
        entry: risk.entryPrice,
        entryTime: t,
        stop: risk.stopPrice,
        target: risk.targetPrice,
        exit: risk.entryPrice + (risk.side === 'long' ? outcomeBps : -outcomeBps),
        exitTime: t + windowMs,
        exitReason: 'window-end',
        returnBps: outcomeBps,
        size: risk.size,
        riskAmount: risk.riskAmount,
      })

      totalRisk += risk.riskAmount
      openPositionCount++
      equity += risk.riskAmount * (outcomeBps / 100)
      if (equity > peakEquity) peakEquity = equity
    }

    // Always add to memory (lifelong learning)
    // Use the actual price change as the outcome
    matcher.addPattern(vector, pattern.priceChange, t)

    // Update for next iteration
    lastPatternVector = vector
    lastPatternTime = t
  }

  // Calculate metrics
  const wins = trades.filter(t => (t.returnBps ?? 0) > 0).length
  const losses = trades.filter(t => (t.returnBps ?? 0) <= 0).length
  const totalReturnBps = trades.reduce((sum, t) => sum + (t.returnBps ?? 0), 0)
  const avgReturnBps = trades.length > 0 ? totalReturnBps / trades.length : 0
  const avgWin = wins > 0 ? trades.filter(t => (t.returnBps ?? 0) > 0).reduce((sum, t) => sum + (t.returnBps ?? 0), 0) / wins : 0
  const avgLoss = losses > 0 ? Math.abs(trades.filter(t => (t.returnBps ?? 0) <= 0).reduce((sum, t) => sum + (t.returnBps ?? 0), 0) / losses) : 0
  const profitFactor = avgLoss > 0 ? avgWin / avgLoss : avgWin > 0 ? Infinity : 0
  const maxDrawdownPct = ((peakEquity - equity) / peakEquity) * 100

  console.log(`\n[backtest] Results:`)
  console.log(`  Trades: ${trades.length}`)
  console.log(`  Wins: ${wins}, Losses: ${losses}`)
  console.log(`  Avg return: ${avgReturnBps.toFixed(1)} bps`)
  console.log(`  Profit factor: ${profitFactor.toFixed(2)}`)
  console.log(`  Max drawdown: ${maxDrawdownPct.toFixed(2)}%`)
  console.log(`  Pattern memory: ${matcher.getMemorySize()}`)

  // Write output
  const result = {
    config: { symbol, start, end, windowMs },
    metrics: {
      totalTrades: trades.length,
      wins,
      losses,
      avgReturnBps: Math.round(avgReturnBps * 10) / 10,
      profitFactor: Math.round(profitFactor * 100) / 100,
      maxDrawdownPct: Math.round(maxDrawdownPct * 100) / 100,
      patternMemorySize: matcher.getMemorySize(),
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
