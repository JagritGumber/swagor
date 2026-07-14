import { runMarketStoreReaderReplayReport } from '../packages/live-reader/run-market-store-reader-replay-report'

const MARKET_STORE_ROOT = 'D:\\Projects\\agoratest\\.data\\market-store'

async function main() {
  console.log('Running backtest: BTCUSDT 2025-05 only...')
  const start = Date.now()

  const report = await runMarketStoreReaderReplayReport({
    rootDir: MARKET_STORE_ROOT,
    venue: 'bybit',
    market: 'trading',
    symbol: 'BTCUSDT',
    interval: '1h',
    startMs: Date.UTC(2025, 4, 1),
    endMs: Date.UTC(2025, 4, 31, 23, 59, 59, 999),
    readIntervalMs: 60_000,
    orderflowWindowMs: 300_000,
    skipResultSnapshots: true,
  })

  const elapsed = ((Date.now() - start) / 1000).toFixed(1)
  const outcomes = report.outcomes
  const winCount = outcomes.filter(o => o.r > 0).length
  const totalR = outcomes.reduce((s, o) => s + o.r, 0)

  console.log(`Completed in ${elapsed}s`)
  console.log(`Buckets: ${report.diagnostics.bucketCount}`)
  console.log(`Candles: ${report.diagnostics.candleCount}`)
  console.log(`Events: ${report.diagnostics.syntheticOrderflowEventCount}`)
  console.log(`Entries: ${report.entries.length}`)
  console.log(`Outcomes: ${outcomes.length}`)
  console.log(`Win: ${winCount}  Loss: ${outcomes.length - winCount}`)
  console.log(`Win rate: ${outcomes.length > 0 ? (winCount / outcomes.length * 100).toFixed(1) : 0}%`)
  console.log(`Total R: ${totalR > 0 ? '+' : ''}${totalR.toFixed(2)}R`)
}

main().catch((e) => {
  console.error('Failed:', e)
  process.exit(1)
})
