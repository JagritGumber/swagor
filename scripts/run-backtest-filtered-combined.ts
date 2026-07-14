import { runMarketStoreReaderReplayReport } from '../packages/live-reader/run-market-store-reader-replay-report'

const MARKET_STORE_ROOT = 'D:\\Projects\\agoratest\\.data\\market-store'

const MONTHS = [
  { year: 2025, month: 4, label: '2025-05' },
  { year: 2025, month: 5, label: '2025-06' },
  { year: 2025, month: 6, label: '2025-07' },
  { year: 2025, month: 7, label: '2025-08' },
  { year: 2025, month: 8, label: '2025-09' },
  { year: 2025, month: 9, label: '2025-10' },
]

async function main() {
  const agg = { entries: [] as any[], outcomes: [] as any[] }
  const start = Date.now()

  const entryFilter = {
    requireKnownRegime: true,
    requireExtremeAuction: true,
    maxStopDistancePct: 0.002,
  }

  for (const m of MONTHS) {
    const report = await runMarketStoreReaderReplayReport({
      rootDir: MARKET_STORE_ROOT, venue: 'bybit', market: 'trading', symbol: 'BTCUSDT',
      interval: '1h',
      startMs: Date.UTC(m.year, m.month, 1),
      endMs: Date.UTC(m.year, m.month + 1, 0, 23, 59, 59, 999),
      readIntervalMs: 60_000, orderflowWindowMs: 300_000,
      entryFilter,
      skipResultSnapshots: true,
    })
    agg.entries.push(...report.entries)
    agg.outcomes.push(...report.outcomes)
    process.stderr.write(`${m.label} done\n`)
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1)
  const outcomes = agg.outcomes
  const winCount = outcomes.filter(o => o.r > 0).length
  const totalR = outcomes.reduce((s, o) => s + o.r, 0)
  let peak = 0, equity = 0, maxDd = 0
  for (const o of outcomes) { equity += o.r; if (equity > peak) peak = equity; const dd = equity - peak; if (dd < maxDd) maxDd = dd }

  console.log(`FILTERED (regime + extreme + tight stop) (${elapsed}s)`)
  console.log(`  Entries: ${agg.entries.length}  Outcomes: ${outcomes.length}`)
  console.log(`  Win: ${winCount}  Loss: ${outcomes.length - winCount}`)
  console.log(`  Win rate: ${outcomes.length > 0 ? (winCount / outcomes.length * 100).toFixed(1) : 0}%`)
  console.log(`  Total R: ${totalR > 0 ? '+' : ''}${totalR.toFixed(2)}R  avg: ${outcomes.length > 0 ? (totalR / outcomes.length).toFixed(3) : 0}R/trade`)
  console.log(`  Max DD: ${maxDd.toFixed(2)}R`)
  console.log(`\nBenchmark: 140 entries, 40.71% WR, +229.51R, -11.17R DD`)
  console.log(`Raw:       545 entries, 45.5% WR, +50.51R, -7.08R DD`)
}

main().catch(e => { console.error(e); process.exit(1) })
