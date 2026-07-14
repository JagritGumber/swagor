import { writeFileSync } from 'fs'
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

function train(
  entries: ReaderResultEntry[],
  outcomes: ReaderResultOutcome[],
  alpha: number,
  gamma: number,
  epsilon: number,
): QTable {
  const q: QTable = new Map()
  const outcomeMap = new Map(outcomes.map(o => [`${o.entryAt}:${o.side}`, o]))

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]
    const state = entryToState(entry)
    const outcome = outcomeMap.get(`${entry.entryAt}:${entry.side}`)

    const explore = Math.random() < epsilon
    let action: Action
    if (explore) {
      action = Math.random() < 0.5 ? 'enter' : 'skip'
    } else {
      action = argmaxAction(q, state)
    }

    let reward = 0
    if (action === 'enter' && outcome) {
      reward = outcome.r
    }

    const nextState = i < entries.length - 1 ? entryToState(entries[i + 1]) : state
    const currentQ = getQ(q, state, action)
    const nextMax = maxQ(q, nextState)
    const newQ = currentQ + alpha * (reward + gamma * nextMax - currentQ)
    setQ(q, state, action, newQ)
  }

  return q
}

function evaluate(
  q: QTable,
  entries: ReaderResultEntry[],
  outcomes: ReaderResultOutcome[],
): { entries: number; outcomes: number; winCount: number; totalR: number } {
  const outcomeMap = new Map(outcomes.map(o => [`${o.entryAt}:${o.side}`, o]))

  let entriesTaken = 0
  let outcomesCount = 0
  let winCount = 0
  let totalR = 0

  for (const entry of entries) {
    const state = entryToState(entry)
    const action = argmaxAction(q, state)
    const outcome = outcomeMap.get(`${entry.entryAt}:${entry.side}`)

    if (action === 'enter' && outcome) {
      entriesTaken++
      outcomesCount++
      totalR += outcome.r
      if (outcome.r > 0) winCount++
    }
  }

  return { entries: entriesTaken, outcomes: outcomesCount, winCount, totalR }
}

async function main() {
  console.log('Loading data (3 months)...')
  const agg = { entries: [] as ReaderResultEntry[], outcomes: [] as ReaderResultOutcome[] }

  const months = [
    { year: 2025, month: 5 },
    { year: 2025, month: 6 },
    { year: 2025, month: 7 },
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

  console.log(`Total: ${agg.entries.length} entries, ${agg.outcomes.length} outcomes`)

  // Split: train (May-Jun), validate (Jul)
  const valStart = Date.UTC(2025, 7, 1)
  const trainEntries = agg.entries.filter(e => e.entryAt < valStart)
  const trainOutcomes = agg.outcomes.filter(o => o.entryAt < valStart)
  const valEntries = agg.entries.filter(e => e.entryAt >= valStart)
  const valOutcomes = agg.outcomes.filter(o => o.entryAt >= valStart)

  console.log(`Train: ${trainEntries.length} entries`)
  console.log(`Val: ${valEntries.length} entries`)

  // Train Q-learning
  console.log('\nTraining...')
  let bestQ: QTable = new Map()
  let bestValR = -Infinity

  for (let epoch = 0; epoch < 20; epoch++) {
    const q = train(trainEntries, trainOutcomes, 0.1, 0.99, 0.4 - epoch * 0.015)
    const valResult = evaluate(q, valEntries, valOutcomes)

    if (valResult.totalR > bestValR) {
      bestValR = valResult.totalR
      bestQ = new Map(q)
    }

    if (epoch % 5 === 0 || epoch === 19) {
      console.log(`  Epoch ${epoch}: val R=${valResult.totalR.toFixed(2)} entries=${valResult.entries}`)
    }
  }

  // Evaluate on train
  const trainResult = evaluate(bestQ, trainEntries, trainOutcomes)
  console.log(`\nTrain: ${trainResult.entries} entries, ${trainResult.outcomes} outcomes, ${trainResult.winCount > 0 ? (trainResult.winCount / trainResult.outcomes * 100).toFixed(1) : 0}% WR, ${trainResult.totalR > 0 ? '+' : ''}${trainResult.totalR.toFixed(2)}R`)

  // Evaluate on validation
  const valResult = evaluate(bestQ, valEntries, valOutcomes)
  console.log(`Val: ${valResult.entries} entries, ${valResult.outcomes} outcomes, ${valResult.winCount > 0 ? (valResult.winCount / valResult.outcomes * 100).toFixed(1) : 0}% WR, ${valResult.totalR > 0 ? '+' : ''}${valResult.totalR.toFixed(2)}R`)

  // Show policy
  const states = new Map<string, { enter: number; skip: number }>()
  for (const [key, value] of bestQ) {
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
    console.log(`  pressure=${parts[0]} initiative=${parts[1]} conviction=${parts[2]} delta=${parts[3]} absorption=${parts[4]} side=${parts[5]} intent=${parts[6]} dir=${parts[7]}`)
    console.log(`    Q(enter)=${qv.enter.toFixed(3)} Q(skip)=${qv.skip.toFixed(3)}`)
  }

  // Save Q-table
  const qObj: Record<string, number> = {}
  for (const [k, v] of bestQ) qObj[k] = v
  const outPath = 'D:\\Projects\\agoratest\\.data\\rl-q-table.json'
  writeFileSync(outPath, JSON.stringify(qObj, null, 2))
  console.log(`\nQ-table saved to ${outPath} (${bestQ.size} entries)`)
}

main().catch(e => { console.error(e); process.exit(1) })
