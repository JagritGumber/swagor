import { runMarketStoreReaderReplayReport } from '../packages/live-reader/run-market-store-reader-replay-report'
import type { ReaderResultEntry, ReaderResultOutcome } from '../packages/strategy-lab/reader/reader-result/types'

const MARKET_STORE_ROOT = 'D:\\Projects\\agoratest\\.data\\market-store'

const MONTHS = [
  { year: 2025, month: 4, label: '2025-05' },
  { year: 2025, month: 5, label: '2025-06' },
  { year: 2025, month: 6, label: '2025-07' },
  { year: 2025, month: 7, label: '2025-08' },
  { year: 2025, month: 8, label: '2025-09' },
  { year: 2025, month: 9, label: '2025-10' },
]

type Aggregated = {
  entries: ReaderResultEntry[]
  outcomes: ReaderResultOutcome[]
  open: ReaderResultEntry | null
  totalBuckets: number
  totalCandles: number
  totalEvents: number
}

async function main() {
  const agg: Aggregated = { entries: [], outcomes: [], open: null, totalBuckets: 0, totalCandles: 0, totalEvents: 0 }
  const overallStart = Date.now()

  for (const m of MONTHS) {
    const startMs = Date.UTC(m.year, m.month, 1)
    const endMs = Date.UTC(m.year, m.month + 1, 0, 23, 59, 59, 999)

    console.log(`\n--- ${m.label} ---`)
    const monthStart = Date.now()

    const report = await runMarketStoreReaderReplayReport({
      rootDir: MARKET_STORE_ROOT,
      venue: 'bybit',
      market: 'trading',
      symbol: 'BTCUSDT',
      interval: '1h',
      startMs,
      endMs,
      readIntervalMs: 60_000,
      orderflowWindowMs: 300_000,
      skipResultSnapshots: true,
    })

    const elapsed = ((Date.now() - monthStart) / 1000).toFixed(1)
    const outcomes = report.outcomes
    const winCount = outcomes.filter(o => o.r > 0).length
    const totalR = outcomes.reduce((s, o) => s + o.r, 0)

    console.log(`  ${elapsed}s | Entries: ${report.entries.length} | Outcomes: ${outcomes.length} | Win: ${winCount} | R: ${totalR > 0 ? '+' : ''}${totalR.toFixed(2)}`)

    agg.entries.push(...report.entries)
    agg.outcomes.push(...report.outcomes)
    agg.open = report.open ?? agg.open
    agg.totalBuckets += report.diagnostics.bucketCount
    agg.totalCandles += report.diagnostics.candleCount
    agg.totalEvents += report.diagnostics.syntheticOrderflowEventCount
  }

  const elapsed = ((Date.now() - overallStart) / 1000).toFixed(1)
  const winCount = agg.outcomes.filter(o => o.r > 0).length
  const lossCount = agg.outcomes.filter(o => o.r < 0).length
  const totalR = agg.outcomes.reduce((s, o) => s + o.r, 0)

  let peak = 0
  let equity = 0
  let maxDd = 0
  for (const o of agg.outcomes) {
    equity += o.r
    if (equity > peak) peak = equity
    const dd = equity - peak
    if (dd < maxDd) maxDd = dd
  }

  console.log(`\n========== FULL RESULTS (${elapsed}s) ==========`)
  console.log(`Buckets: ${agg.totalBuckets} | Candles: ${agg.totalCandles} | Events: ${agg.totalEvents}`)
  console.log(`Entries: ${agg.entries.length}`)
  console.log(`Outcomes: ${agg.outcomes.length}`)
  console.log(`Win: ${winCount}  Loss: ${lossCount}`)
  console.log(`Win rate: ${agg.outcomes.length > 0 ? (winCount / agg.outcomes.length * 100).toFixed(2) : 0}%`)
  console.log(`Total R: ${totalR > 0 ? '+' : ''}${totalR.toFixed(2)}R`)
  console.log(`Max drawdown: ${maxDd.toFixed(2)}R`)
  console.log(`\nBenchmark (vp-trend-down-active-price-follow-025):`)
  console.log(`  Entries: 140  |  This run: ${agg.entries.length}`)
  console.log(`  Win rate: 40.71%  |  This run: ${agg.outcomes.length > 0 ? (winCount / agg.outcomes.length * 100).toFixed(2) : 0}%`)
  console.log(`  Total R: +229.51R  |  This run: ${totalR > 0 ? '+' : ''}${totalR.toFixed(2)}R`)
  console.log(`  Max DD: -11.17R  |  This run: ${maxDd.toFixed(2)}R`)
}

main().catch((e) => {
  console.error('Failed:', e)
  process.exit(1)
})
