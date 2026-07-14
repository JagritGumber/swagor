import { runMarketStoreReaderReplayReport } from '../packages/live-reader/run-market-store-reader-replay-report'
import type { ReaderResultEntry, ReaderResultOutcome } from '../packages/strategy-lab/reader/reader-result/types'

const MARKET_STORE_ROOT = 'D:\\Projects\\agoratest\\.data\\market-store'

type Feature = string
type State = string
type Action = 'enter' | 'skip'

type QTable = Map<string, number>

function entryToState(entry: ReaderResultEntry): State {
  const delta = entry.orderflowDelta ?? 0
  const deltaDirection = delta > 0 ? 'positive' : delta < 0 ? 'negative' : 'zero'

  const parts: Feature[] = [
    entry.orderflowPressure ?? 'balanced',
    entry.orderflowInitiativeSide ?? 'none',
    entry.orderflowInitiativeConviction ?? 'none',
    deltaDirection,
    entry.orderflowAbsorptionEvent ?? 'none',
    entry.side,
    entry.narrative?.intent ?? 'unknown',
    entry.narrative?.direction ?? 'none',
  ]
  return parts.join('|')
}

function qKey(state: State, action: Action): string {
  return `${state}::${action}`
}

function getQ(q: QTable, state: State, action: Action): number {
  return q.get(qKey(state, action)) ?? 0
}

function setQ(q: QTable, state: State, action: Action, value: number): void {
  q.set(qKey(state, action), value)
}

function maxQ(q: QTable, state: State): number {
  return Math.max(getQ(q, state, 'enter'), getQ(q, state, 'skip'))
}

function argmaxAction(q: QTable, state: State): Action {
  return getQ(q, state, 'enter') >= getQ(q, state, 'skip') ? 'enter' : 'skip'
}

type TrainResult = {
  q: QTable
  totalReward: number
  entriesTaken: number
  skipped: number
  winCount: number
  totalR: number
}

function train(
  entries: ReaderResultEntry[],
  outcomes: ReaderResultOutcome[],
  alpha: number,
  gamma: number,
  epsilon: number,
): TrainResult {
  const q: QTable = new Map()
  const outcomeMap = new Map(outcomes.map(o => [`${o.entryAt}:${o.side}`, o]))

  let totalReward = 0
  let entriesTaken = 0
  let skipped = 0
  let winCount = 0
  let totalR = 0

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]
    const state = entryToState(entry)
    const outcome = outcomeMap.get(`${entry.entryAt}:${entry.side}`)

    // Epsilon-greedy action selection
    const explore = Math.random() < epsilon
    let action: Action
    if (explore) {
      action = Math.random() < 0.5 ? 'enter' : 'skip'
    } else {
      action = argmaxAction(q, state)
    }

    // Reward: R-multiple if entered, 0 if skipped
    let reward = 0
    if (action === 'enter' && outcome) {
      reward = outcome.r
      entriesTaken++
      totalR += outcome.r
      if (outcome.r > 0) winCount++
    } else {
      skipped++
    }

    totalReward += reward

    // Q-learning update: Q(s,a) += alpha * (r + gamma * maxQ(s') - Q(s,a))
    // Since entries are sequential, s' is the next entry's state
    const nextState = i < entries.length - 1 ? entryToState(entries[i + 1]) : state
    const currentQ = getQ(q, state, action)
    const nextMax = maxQ(q, nextState)
    const newQ = currentQ + alpha * (reward + gamma * nextMax - currentQ)
    setQ(q, state, action, newQ)
  }

  return { q, totalReward, entriesTaken, skipped, winCount, totalR }
}

function evaluate(
  q: QTable,
  entries: ReaderResultEntry[],
  outcomes: ReaderResultOutcome[],
): { entries: number; outcomes: number; winCount: number; totalR: number; maxDd: number; trades: Array<{ entry: ReaderResultEntry; outcome: ReaderResultOutcome | null; action: Action }> } {
  const outcomeMap = new Map(outcomes.map(o => [`${o.entryAt}:${o.side}`, o]))
  const trades: Array<{ entry: ReaderResultEntry; outcome: ReaderResultOutcome | null; action: Action }> = []

  let entriesTaken = 0
  let outcomesCount = 0
  let winCount = 0
  let totalR = 0
  let peak = 0
  let equity = 0
  let maxDd = 0

  for (const entry of entries) {
    const state = entryToState(entry)
    const action = argmaxAction(q, state)
    const outcome = outcomeMap.get(`${entry.entryAt}:${entry.side}`)

    trades.push({ entry, outcome: outcome ?? null, action })

    if (action === 'enter' && outcome) {
      entriesTaken++
      outcomesCount++
      totalR += outcome.r
      equity += outcome.r
      if (outcome.r > 0) { winCount++; }
      if (equity > peak) peak = equity
      const dd = equity - peak
      if (dd < maxDd) maxDd = dd
    }
  }

  return { entries: entriesTaken, outcomes: outcomesCount, winCount, totalR, maxDd, trades }
}

function printPolicySummary(q: QTable): void {
  // Group by state, show enter vs skip Q values for states where enter > skip
  const states = new Map<string, { enter: number; skip: number }>()
  for (const [key, value] of q) {
    const [state, action] = key.split('::')
    if (!state || !action) continue
    const existing = states.get(state) ?? { enter: 0, skip: 0 }
    if (action === 'enter') existing.enter = value
    else existing.skip = value
    states.set(state, existing)
  }

  const enterStates = [...states.entries()]
    .filter(([, v]) => v.enter > v.skip && v.enter > 0.01)
    .sort((a, b) => b[1].enter - a[1].enter)

  console.log(`\nPolicy: ${enterStates.length} states with positive enter Q-value`)
  console.log('\nTop 10 states to ENTER:')
  for (const [state, qv] of enterStates.slice(0, 10)) {
    const parts = state.split('|')
    console.log(`  regime=${parts[0]} auction=${parts[1]} level=${parts[2]} side=${parts[3]} dir=${parts[4]} intent=${parts[5]} participation=${parts[6]} auctionMode=${parts[7]}`)
    console.log(`    Q(enter)=${qv.enter.toFixed(3)} Q(skip)=${qv.skip.toFixed(3)}`)
  }
}

async function main() {
  console.log('Loading data...')
  const agg = { entries: [] as ReaderResultEntry[], outcomes: [] as ReaderResultOutcome[] }

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
    process.stderr.write(`${m.month + 1} done\n`)
  }

  console.log(`\nTotal: ${agg.entries.length} entries, ${agg.outcomes.length} outcomes`)

  // Split: train (May-Jun), validate (Jul), test (Aug-Oct)
  const valStart = Date.UTC(2025, 6, 1)
  const testStart = Date.UTC(2025, 7, 1)

  const trainEntries = agg.entries.filter(e => e.entryAt < valStart)
  const trainOutcomes = agg.outcomes.filter(o => o.entryAt < valStart)
  const valEntries = agg.entries.filter(e => e.entryAt >= valStart && e.entryAt < testStart)
  const valOutcomes = agg.outcomes.filter(o => o.entryAt >= valStart && o.entryAt < testStart)
  const testEntries = agg.entries.filter(e => e.entryAt >= testStart)
  const testOutcomes = agg.outcomes.filter(o => o.entryAt >= testStart)

  console.log(`\nTrain: ${trainEntries.length} entries (May-Jun)`)
  console.log(`Val:   ${valEntries.length} entries (Jul)`)
  console.log(`Test:  ${testEntries.length} entries (Aug-Oct)`)

  // Baseline: enter all trades on train set
  const trainAllR = trainOutcomes.reduce((s, o) => s + o.r, 0)
  console.log(`\nTrain baseline (enter all): ${trainEntries.length} entries, ${trainOutcomes.length} outcomes, +${trainAllR.toFixed(2)}R`)

  // Train Q-learning with multiple passes, pick best by validation R
  console.log('\nTraining Q-learning agent...')
  let bestQ: QTable = new Map()
  let bestValR = -Infinity
  let bestEpoch = 0

  for (let epoch = 0; epoch < 30; epoch++) {
    const result = train(trainEntries, trainOutcomes, 0.1, 0.99, 0.4 - epoch * 0.01)

    // Evaluate on validation set
    const valResult = evaluate(result.q, valEntries, valOutcomes)

    if (valResult.totalR > bestValR) {
      bestValR = valResult.totalR
      bestQ = new Map(result.q)
      bestEpoch = epoch
    }

    if (epoch % 5 === 0 || epoch === 29) {
      console.log(`  Epoch ${epoch}: val R=${valResult.totalR.toFixed(2)} entries=${valResult.entries} winRate=${valResult.outcomes > 0 ? (valResult.winCount / valResult.outcomes * 100).toFixed(1) : 0}%`)
    }
  }

  console.log(`\nBest epoch: ${bestEpoch} (val R=${bestValR.toFixed(2)})`)

  // Evaluate on train set
  const trainResult = evaluate(bestQ, trainEntries, trainOutcomes)
  console.log(`\nTrain (learned policy): ${trainResult.entries} entries, ${trainResult.outcomes} outcomes`)
  console.log(`  Win rate: ${trainResult.outcomes > 0 ? (trainResult.winCount / trainResult.outcomes * 100).toFixed(1) : 0}%`)
  console.log(`  Total R: ${trainResult.totalR > 0 ? '+' : ''}${trainResult.totalR.toFixed(2)}R  avg: ${trainResult.outcomes > 0 ? (trainResult.totalR / trainResult.outcomes).toFixed(3) : 0}R/trade`)
  console.log(`  Max DD: ${trainResult.maxDd.toFixed(2)}R`)

  // Evaluate on validation set
  const valResult = evaluate(bestQ, valEntries, valOutcomes)
  console.log(`\nValidation (Jul): ${valResult.entries} entries, ${valResult.outcomes} outcomes`)
  console.log(`  Win rate: ${valResult.outcomes > 0 ? (valResult.winCount / valResult.outcomes * 100).toFixed(1) : 0}%`)
  console.log(`  Total R: ${valResult.totalR > 0 ? '+' : ''}${valResult.totalR.toFixed(2)}R  avg: ${valResult.outcomes > 0 ? (valResult.totalR / valResult.outcomes).toFixed(3) : 0}R/trade`)
  console.log(`  Max DD: ${valResult.maxDd.toFixed(2)}R`)

  // Evaluate on test set (out-of-sample)
  const testResult = evaluate(bestQ, testEntries, testOutcomes)
  console.log(`\nTest (Aug-Oct, out-of-sample): ${testResult.entries} entries, ${testResult.outcomes} outcomes`)
  console.log(`  Win rate: ${testResult.outcomes > 0 ? (testResult.winCount / testResult.outcomes * 100).toFixed(1) : 0}%`)
  console.log(`  Total R: ${testResult.totalR > 0 ? '+' : ''}${testResult.totalR.toFixed(2)}R  avg: ${testResult.outcomes > 0 ? (testResult.totalR / testResult.outcomes).toFixed(3) : 0}R/trade`)
  console.log(`  Max DD: ${testResult.maxDd.toFixed(2)}R`)

  // Compare to raw on each set
  const valAllR = valOutcomes.reduce((s, o) => s + o.r, 0)
  const testAllR = testOutcomes.reduce((s, o) => s + o.r, 0)
  console.log(`\nBaselines (enter all):`)
  console.log(`  Train: +${trainAllR.toFixed(2)}R`)
  console.log(`  Val:   +${valAllR.toFixed(2)}R`)
  console.log(`  Test:  +${testAllR.toFixed(2)}R`)

  // Show which months had best/worst performance
  console.log('\nMonthly breakdown (agent policy):')
  for (const m of months) {
    const monthStart = Date.UTC(m.year, m.month, 1)
    const monthEnd = Date.UTC(m.year, m.month + 1, 0, 23, 59, 59, 999)
    const monthEntries = testEntries.filter(e => e.entryAt >= monthStart && e.entryAt <= monthEnd)
    const monthOutcomes = testOutcomes.filter(o => o.entryAt >= monthStart && o.entryAt <= monthEnd)
    if (monthEntries.length === 0) continue
    const r = evaluate(bestQ, monthEntries, monthOutcomes)
    console.log(`  ${m.label}: ${r.entries} entries, ${r.outcomes > 0 ? (r.winCount / r.outcomes * 100).toFixed(0) : 0}% WR, ${r.totalR > 0 ? '+' : ''}${r.totalR.toFixed(2)}R`)
  }

  printPolicySummary(bestQ)

  // Save Q-table
  const qObj: Record<string, number> = {}
  for (const [k, v] of bestQ) qObj[k] = v
  const outPath = 'D:\\Projects\\agoratest\\.data\\rl-q-table.json'
  const fs = await import('fs')
  fs.writeFileSync(outPath, JSON.stringify(qObj, null, 2))
  console.log(`\nQ-table saved to ${outPath} (${bestQ.size} entries)`)
}

main().catch(e => { console.error(e); process.exit(1) })
