import { writeFileSync } from 'fs'
import { readFileSync } from 'fs'
import { join } from 'path'

const ARTIFACTS_DIR = 'D:\\Projects\\agoratest\\artifacts'

type Feature = string
type State = string
type Action = 'enter' | 'skip'
type QTable = Map<string, number>

type CandidateEntry = {
  index: number
  asset: string
  observedAt: number
  family: string
  side: string | null
  entryPrice: number
  target: number | null
  invalidation: string | null
  reader: {
    auctionLocation: string
    auctionLevelKind: string
    auctionMode: string
    regime: string
    narrativeIntent: string
    narrativeDirection: string
  }
  orderflow: {
    pressure: string
    events: string | string[]
    tradeCount: number
    largestTradeSide: string
  }
  outcome: {
    verdict: string
    resultR: number | null
    maxFavorableR: number | null
    maxAdverseR: number | null
  }
}

function entryToState(entry: CandidateEntry): State {
  const events = Array.isArray(entry.orderflow.events)
    ? entry.orderflow.events.join(' ')
    : entry.orderflow.events
  const absorptionEvent = events.includes('buy-absorption') ? 'buy-absorption'
    : events.includes('sell-absorption') ? 'sell-absorption'
    : 'none'

  const parts: Feature[] = [
    entry.orderflow.pressure,
    entry.orderflow.largestTradeSide,
    absorptionEvent,
    entry.side ?? 'none',
    entry.reader.narrativeIntent,
    entry.reader.narrativeDirection,
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

function loadCandidateTape(filename: string): CandidateEntry[] {
  const raw = readFileSync(join(ARTIFACTS_DIR, filename), 'utf-8')
  const json = JSON.parse(raw)
  const asset = json.assets?.[0]
  if (!asset?.tape?.candidates) return []
  return asset.tape.candidates
}

function train(
  entries: CandidateEntry[],
  alpha: number,
  gamma: number,
  epsilon: number,
): QTable {
  const q: QTable = new Map()

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]
    const state = entryToState(entry)

    const explore = Math.random() < epsilon
    let action: Action
    if (explore) {
      action = Math.random() < 0.5 ? 'enter' : 'skip'
    } else {
      action = argmaxAction(q, state)
    }

    let reward = 0
    if (action === 'enter' && entry.outcome.resultR !== null) {
      reward = entry.outcome.resultR
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
  entries: CandidateEntry[],
): { entries: number; outcomes: number; winCount: number; totalR: number } {
  let entriesTaken = 0
  let outcomesCount = 0
  let winCount = 0
  let totalR = 0

  for (const entry of entries) {
    const state = entryToState(entry)
    const action = argmaxAction(q, state)

    if (action === 'enter' && entry.outcome.resultR !== null) {
      entriesTaken++
      outcomesCount++
      totalR += entry.outcome.resultR
      if (entry.outcome.resultR > 0) winCount++
    }
  }

  return { entries: entriesTaken, outcomes: outcomesCount, winCount, totalR }
}

async function main() {
  console.log('Loading candidate tapes...')

  // Load all available tapes
  const tapeFiles = [
    'reader-candidates-first-reaction-r-2025-05.json',
    'reader-candidates-first-reaction-r-2025-06.json',
    'reader-candidates-after-vp-pullback-narrative-2025-07.json',
    'reader-candidates-after-vp-pullback-narrative-2025-08.json',
  ]

  const allEntries: CandidateEntry[] = []
  for (const file of tapeFiles) {
    try {
      const entries = loadCandidateTape(file)
      console.log(`  ${file}: ${entries.length} entries`)
      allEntries.push(...entries)
    } catch (e) {
      console.log(`  ${file}: not found, skipping`)
    }
  }

  // Filter to entries with outcomes
  const withOutcomes = allEntries.filter(e => e.outcome.resultR !== null)
  console.log(`\nTotal: ${allEntries.length} entries, ${withOutcomes.length} with outcomes`)

  // Split: train (first 60%), validate (last 40%)
  const splitIdx = Math.floor(withOutcomes.length * 0.6)
  const trainEntries = withOutcomes.slice(0, splitIdx)
  const valEntries = withOutcomes.slice(splitIdx)

  console.log(`Train: ${trainEntries.length} entries`)
  console.log(`Val: ${valEntries.length} entries`)

  // Train Q-learning
  console.log('\nTraining...')
  let bestQ: QTable = new Map()
  let bestValR = -Infinity

  for (let epoch = 0; epoch < 30; epoch++) {
    const q = train(trainEntries, 0.1, 0.99, 0.4 - epoch * 0.01)
    const valResult = evaluate(q, valEntries)

    if (valResult.totalR > bestValR) {
      bestValR = valResult.totalR
      bestQ = new Map(q)
    }

    if (epoch % 5 === 0 || epoch === 29) {
      console.log(`  Epoch ${epoch}: val R=${valResult.totalR.toFixed(2)} entries=${valResult.entries} outcomes=${valResult.outcomes}`)
    }
  }

  // Evaluate on train
  const trainResult = evaluate(bestQ, trainEntries)
  console.log(`\nTrain: ${trainResult.entries} entries, ${trainResult.outcomes} outcomes, ${trainResult.winCount > 0 ? (trainResult.winCount / trainResult.outcomes * 100).toFixed(1) : 0}% WR, ${trainResult.totalR > 0 ? '+' : ''}${trainResult.totalR.toFixed(2)}R`)

  // Evaluate on validation
  const valResult = evaluate(bestQ, valEntries)
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
    console.log(`  pressure=${parts[0]} largestSide=${parts[1]} absorption=${parts[2]} side=${parts[3]} intent=${parts[4]} dir=${parts[5]}`)
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
