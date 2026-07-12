import { runMarketStoreReaderReplayReport } from '../packages/live-reader/run-market-store-reader-replay-report'

const MARKET_STORE_ROOT = 'D:\\Projects\\agoratest\\.data\\market-store'

async function main() {
  const agg = { entries: [] as any[], outcomes: [] as any[] }

  const months = [
    { year: 2025, month: 4, label: '2025-05' },
    { year: 2025, month: 5, label: '2025-06' },
    { year: 2025, month: 6, label: '2025-07' },
    { year: 2025, month: 7, label: '2025-08' },
    { year: 2025, month: 8, label: '2025-09' },
    { year: 2025, month: 9, label: '2025-10' },
  ]

  for (const m of months) {
    const report = await runMarketStoreReaderReplayReport({
      rootDir: MARKET_STORE_ROOT,
      venue: 'bybit', market: 'trading', symbol: 'BTCUSDT',
      interval: '1h',
      startMs: Date.UTC(m.year, m.month, 1),
      endMs: Date.UTC(m.year, m.month + 1, 0, 23, 59, 59, 999),
      readIntervalMs: 60_000, orderflowWindowMs: 300_000,
    })
    agg.entries.push(...report.entries)
    agg.outcomes.push(...report.outcomes)
    process.stderr.write(`${m.label} done\n`)
  }

  const outcomes = agg.outcomes
  const rValues = outcomes.map(o => o.r)

  // R distribution
  const buckets = [
    { label: '< -2R', min: -Infinity, max: -2 },
    { label: '-2R to -1R', min: -2, max: -1 },
    { label: '-1R to -0.5R', min: -1, max: -0.5 },
    { label: '-0.5R to 0R', min: -0.5, max: 0 },
    { label: '0R to 0.5R', min: 0, max: 0.5 },
    { label: '0.5R to 1R', min: 0.5, max: 1 },
    { label: '1R to 2R', min: 1, max: 2 },
    { label: '> 2R', min: 2, max: Infinity },
  ]

  console.log('\nR Distribution:')
  for (const b of buckets) {
    const count = rValues.filter(r => r >= b.min && r < b.max).length
    const pct = (count / rValues.length * 100).toFixed(1)
    const bar = '#'.repeat(Math.round(count / 2))
    console.log(`  ${b.label.padEnd(14)} ${String(count).padStart(4)} (${pct}%) ${bar}`)
  }

  // By exit reason
  const byReason = new Map<string, { count: number; totalR: number }>()
  for (const o of outcomes) {
    const existing = byReason.get(o.exitReason) ?? { count: 0, totalR: 0 }
    existing.count++
    existing.totalR += o.r
    byReason.set(o.exitReason, existing)
  }
  console.log('\nBy exit reason:')
  for (const [reason, stats] of byReason) {
    console.log(`  ${reason.padEnd(20)} ${stats.count} trades  ${stats.totalR > 0 ? '+' : ''}${stats.totalR.toFixed(2)}R  avg ${(stats.totalR / stats.count).toFixed(2)}R`)
  }

  // By setup family
  const byFamily = new Map<string, { count: number; totalR: number; wins: number }>()
  for (const o of outcomes) {
    const family = o.setupFamily ?? 'unknown'
    const existing = byFamily.get(family) ?? { count: 0, totalR: 0, wins: 0 }
    existing.count++
    existing.totalR += o.r
    if (o.r > 0) existing.wins++
    byFamily.set(family, existing)
  }
  console.log('\nBy setup family:')
  const sorted = [...byFamily.entries()].sort((a, b) => b[1].totalR - a[1].totalR)
  for (const [family, stats] of sorted) {
    const wr = (stats.wins / stats.count * 100).toFixed(1)
    console.log(`  ${family.padEnd(24)} ${String(stats.count).padStart(4)} trades  WR ${wr}%  ${stats.totalR > 0 ? '+' : ''}${stats.totalR.toFixed(2)}R  avg ${(stats.totalR / stats.count).toFixed(2)}R`)
  }

  // Top 20 trades by R
  const sorted20 = [...outcomes].sort((a, b) => b.r - a.r).slice(0, 20)
  console.log('\nTop 20 trades by R:')
  for (const o of sorted20) {
    const date = new Date(o.entryAt).toISOString().slice(0, 10)
    console.log(`  ${date} ${o.side.padEnd(5)} entry=${o.entryPrice.toFixed(0)} stop=${o.stop.toFixed(0)} target=${o.target.toFixed(0)} exit=${o.exitPrice.toFixed(0)} ${o.exitReason.padEnd(15)} ${o.r > 0 ? '+' : ''}${o.r.toFixed(2)}R  family=${o.setupFamily}`)
  }

  // Bottom 20 trades by R
  const bottom20 = [...outcomes].sort((a, b) => a.r - b.r).slice(0, 20)
  console.log('\nBottom 20 trades by R:')
  for (const o of bottom20) {
    const date = new Date(o.entryAt).toISOString().slice(0, 10)
    console.log(`  ${date} ${o.side.padEnd(5)} entry=${o.entryPrice.toFixed(0)} stop=${o.stop.toFixed(0)} target=${o.target.toFixed(0)} exit=${o.exitPrice.toFixed(0)} ${o.exitReason.padEnd(15)} ${o.r > 0 ? '+' : ''}${o.r.toFixed(2)}R  family=${o.setupFamily}`)
  }
}

main().catch(e => { console.error(e); process.exit(1) })
