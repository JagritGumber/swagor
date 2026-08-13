import { runMarketStoreReaderReplayReport } from '../packages/live-reader/run-market-store-reader-replay-report'

const MARKET_STORE_ROOT = 'D:\\Projects\\agoratest\\.data\\market-store'

async function main() {
  const agg = { entries: [] as any[], outcomes: [] as any[], historySteps: [] as any[] }

  const months = [
    { year: 2025, month: 4 }, { year: 2025, month: 5 }, { year: 2025, month: 6 },
    { year: 2025, month: 7 }, { year: 2025, month: 8 }, { year: 2025, month: 9 },
  ]

  for (const m of months) {
    const report = await runMarketStoreReaderReplayReport({
      rootDir: MARKET_STORE_ROOT, venue: 'bybit', market: 'trading', symbol: 'BTCUSDT',
      interval: '1h',
      startMs: Date.UTC(m.year, m.month, 1),
      endMs: Date.UTC(m.year, m.month + 1, 0, 23, 59, 59, 999),
      readIntervalMs: 60_000, orderflowWindowMs: 300_000,
    })
    agg.entries.push(...report.entries)
    agg.outcomes.push(...report.outcomes)
    agg.historySteps.push(...report.historySteps)
    process.stderr.write(`${m.label ?? m.month} done\n`)
  }

  const outcomes = agg.outcomes

  // Split into winners (>0.5R) and losers (<-0.3R or reader-failure with small R)
  const winners = outcomes.filter(o => o.r >= 0.5)
  const losers = outcomes.filter(o => o.r < 0.1 && o.exitReason === 'reader-failure')

  console.log(`\nWinners (>=0.5R): ${winners.length} trades`)
  console.log(`Losers (<0.1R reader-failure): ${losers.length} trades`)

  // Compare entry conditions
  function analyzeGroup(name: string, group: any[]) {
    console.log(`\n--- ${name} ---`)
    const byLocation = new Map<string, number>()
    const byLevelKind = new Map<string, number>()
    const byDirection = new Map<string, number>()
    const byRegime = new Map<string, number>()
    const bySide = new Map<string, number>()
    const avgRisk: number[] = []
    const avgHolding: number[] = []

    for (const o of group) {
      byLocation.set(o.entryAuctionLocation ?? 'unknown', (byLocation.get(o.entryAuctionLocation ?? 'unknown') ?? 0) + 1)
      byLevelKind.set(o.entryAuctionLevelKind ?? 'unknown', (byLevelKind.get(o.entryAuctionLevelKind ?? 'unknown') ?? 0) + 1)
      byDirection.set(o.narrative?.direction ?? 'unknown', (byDirection.get(o.narrative?.direction ?? 'unknown') ?? 0) + 1)
      byRegime.set(o.regime?.mode ?? 'unknown', (byRegime.get(o.regime?.mode ?? 'unknown') ?? 0) + 1)
      bySide.set(o.side, (bySide.get(o.side) ?? 0) + 1)
      avgRisk.push(Math.abs(o.entryPrice - o.stop))
      avgHolding.push((o.exitAt - o.entryAt) / 3600000)
    }

    console.log(`  Side: ${[...bySide.entries()].map(([k, v]) => `${k}:${v}`).join(' ')}`)
    console.log(`  Auction location: ${[...byLocation.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join(' ')}`)
    console.log(`  Level kind: ${[...byLevelKind.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join(' ')}`)
    console.log(`  Narrative dir: ${[...byDirection.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join(' ')}`)
    console.log(`  Regime: ${[...byRegime.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join(' ')}`)
    console.log(`  Avg risk (points): ${(avgRisk.reduce((s, v) => s + v, 0) / avgRisk.length).toFixed(0)}`)
    console.log(`  Avg holding (hours): ${(avgHolding.reduce((s, v) => s + v, 0) / avgHolding.length).toFixed(1)}`)
  }

  analyzeGroup('WINNERS', winners)
  analyzeGroup('LOSERS (reader-failure <0.1R)', losers)

  // Look at narrative stability for winners vs losers
  console.log('\n--- Narrative intent at entry ---')
  const winIntents = new Map<string, number>()
  const loseIntents = new Map<string, number>()
  for (const o of winners) winIntents.set(o.narrative?.intent ?? 'unknown', (winIntents.get(o.narrative?.intent ?? 'unknown') ?? 0) + 1)
  for (const o of losers) loseIntents.set(o.narrative?.intent ?? 'unknown', (loseIntents.get(o.narrative?.intent ?? 'unknown') ?? 0) + 1)
  console.log(`  Winners: ${[...winIntents.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join(' ')}`)
  console.log(`  Losers:  ${[...loseIntents.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join(' ')}`)

  // Check setup key diversity
  console.log('\n--- Setup key diversity ---')
  const winKeys = new Set(winners.map(o => o.setupKey))
  const loseKeys = new Set(losers.map(o => o.setupKey))
  console.log(`  Winners: ${winKeys.size} unique setup keys from ${winners.length} trades`)
  console.log(`  Losers: ${loseKeys.size} unique setup keys from ${losers.length} trades`)
}

main().catch(e => { console.error(e); process.exit(1) })
