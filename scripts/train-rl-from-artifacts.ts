import { readFile } from 'fs/promises'

type Candidate = {
  index: number
  asset: string
  observedAt: string
  family: string
  side: string | null
  entryPrice: number
  target: number | null
  invalidation: number | null
  reader: {
    auctionLocation: string
    auctionLevelKind: string | null
    auctionMode: string
    auctionPhase: string
    vpAuction: string
    vpPoc: string
    vpValue: string
    regime: string
    narrativeIntent: string
    narrativeDirection: string
  }
  orderflow: {
    pressure: string
    events: string[]
    tradeCount: number
    largestTradeSide: string | null
  }
  outcome: {
    verdict: string
    resultR: number | null
    maxFavorableR: number | null
    maxAdverseR: number | null
  } | null
}

type QTable = Map<string, number>

function candidateToState(c: Candidate): string {
  const r = c.reader
  return [
    r.regime,
    r.auctionLocation,
    r.auctionLevelKind ?? 'none',
    r.auctionMode,
    c.side ?? 'none',
    r.narrativeDirection,
    r.narrativeIntent,
    r.vpAuction,
    c.orderflow.pressure,
  ].join('|')
}

function qKey(state: string, action: string): string { return `${state}::${action}` }
function getQ(q: QTable, state: string, action: string): number { return q.get(qKey(state, action)) ?? 0 }
function setQ(q: QTable, state: string, action: string, v: number): void { q.set(qKey(state, action), v) }
function maxQ(q: QTable, state: string): number { return Math.max(getQ(q, state, 'enter'), getQ(q, state, 'skip')) }
function bestAction(q: QTable, state: string): string { return getQ(q, state, 'enter') >= getQ(q, state, 'skip') ? 'enter' : 'skip' }

async function loadCandidates(path: string): Promise<Candidate[]> {
  const raw = await readFile(path, 'utf8')
  const data = JSON.parse(raw)
  return data.assets?.[0]?.tape?.candidates ?? []
}

async function main() {
  const files = [
    'D:\\Projects\\agoratest\\artifacts\\reader-candidates-first-reaction-r-2025-05.json',
    'D:\\Projects\\agoratest\\artifacts\\reader-candidates-first-reaction-r-2025-06.json',
    'D:\\Projects\\agoratest\\artifacts\\reader-candidates-after-vp-pullback-narrative-2025-07.json',
    'D:\\Projects\\agoratest\\artifacts\\reader-candidates-after-vp-pullback-narrative-2025-08.json',
  ]

  const allCandidates: Candidate[] = []
  for (const f of files) {
    const candidates = await loadCandidates(f)
    console.log(`${f.split('-').slice(-2).join('-')}: ${candidates.length} candidates`)
    allCandidates.push(...candidates)
  }

  // Sort by time
  allCandidates.sort((a, b) => new Date(a.observedAt).getTime() - new Date(b.observedAt).getTime())

  // Filter to judgeable candidates (has side and outcome)
  const judgeable = allCandidates.filter(c => c.side && c.outcome && c.outcome.verdict !== 'unjudgeable')
  console.log(`\nTotal: ${allCandidates.length} candidates, ${judgeable.length} judgeable`)

  // Split: first 60% train, next 20% val, last 20% test
  const trainEnd = Math.floor(judgeable.length * 0.6)
  const valEnd = Math.floor(judgeable.length * 0.8)
  const train = judgeable.slice(0, trainEnd)
  const val = judgeable.slice(trainEnd, valEnd)
  const test = judgeable.slice(valEnd)

  console.log(`Train: ${train.length}  Val: ${val.length}  Test: ${test.length}`)

  // Evaluate baseline (enter all)
  function evalBaseline(group: Candidate[]) {
    const entered = group.filter(c => c.outcome?.resultR != null)
    const totalR = entered.reduce((s, c) => s + (c.outcome!.resultR ?? 0), 0)
    const wins = entered.filter(c => (c.outcome!.resultR ?? 0) > 0).length
    return { count: entered.length, totalR, winRate: entered.length > 0 ? wins / entered.length : 0 }
  }

  const trainBase = evalBaseline(train)
  const valBase = evalBaseline(val)
  const testBase = evalBaseline(test)
  console.log(`\nBaseline (enter all):`)
  console.log(`  Train: ${trainBase.count} trades, ${(trainBase.winRate*100).toFixed(1)}% WR, +${trainBase.totalR.toFixed(2)}R`)
  console.log(`  Val:   ${valBase.count} trades, ${(valBase.winRate*100).toFixed(1)}% WR, +${valBase.totalR.toFixed(2)}R`)
  console.log(`  Test:  ${testBase.count} trades, ${(testBase.winRate*100).toFixed(1)}% WR, +${testBase.totalR.toFixed(2)}R`)

  // Train Q-learning
  console.log('\nTraining...')
  let bestQ: QTable = new Map()
  let bestValR = -Infinity

  for (let epoch = 0; epoch < 50; epoch++) {
    const q: QTable = new Map()
    const epsilon = Math.max(0.05, 0.5 - epoch * 0.01)

    for (const c of train) {
      const state = candidateToState(c)
      const explore = Math.random() < epsilon
      const action = explore ? (Math.random() < 0.5 ? 'enter' : 'skip') : bestAction(q, state)
      const reward = action === 'enter' ? (c.outcome?.resultR ?? 0) : 0

      // Q update
      const nextIdx = train.indexOf(c) + 1
      const nextState = nextIdx < train.length ? candidateToState(train[nextIdx]) : state
      const current = getQ(q, state, action)
      setQ(q, state, action, current + 0.1 * (reward + 0.99 * maxQ(q, nextState) - current))
    }

    // Evaluate on val
    let valR = 0, valEntered = 0
    for (const c of val) {
      const state = candidateToState(c)
      if (bestAction(q, state) === 'enter' && c.outcome?.resultR != null) {
        valR += c.outcome.resultR
        valEntered++
      }
    }

    if (valR > bestValR) {
      bestValR = valR
      bestQ = new Map(q)
    }

    if (epoch % 10 === 0 || epoch === 49) {
      console.log(`  Epoch ${epoch}: val R=${valR.toFixed(2)} entries=${valEntered} best=${bestValR.toFixed(2)}`)
    }
  }

  // Evaluate on all sets with best Q
  function evalWithQ(q: QTable, group: Candidate[]) {
    let totalR = 0, entered = 0, wins = 0
    for (const c of group) {
      const state = candidateToState(c)
      if (bestAction(q, state) === 'enter' && c.outcome?.resultR != null) {
        totalR += c.outcome.resultR
        entered++
        if (c.outcome.resultR > 0) wins++
      }
    }
    return { count: entered, totalR, winRate: entered > 0 ? wins / entered : 0 }
  }

  const trainQ = evalWithQ(bestQ, train)
  const valQ = evalWithQ(bestQ, val)
  const testQ = evalWithQ(bestQ, test)

  console.log(`\nLearned policy:`)
  console.log(`  Train: ${trainQ.count} trades, ${(trainQ.winRate*100).toFixed(1)}% WR, ${trainQ.totalR > 0 ? '+' : ''}${trainQ.totalR.toFixed(2)}R  avg ${(trainQ.count > 0 ? trainQ.totalR/trainQ.count : 0).toFixed(3)}R/trade`)
  console.log(`  Val:   ${valQ.count} trades, ${(valQ.winRate*100).toFixed(1)}% WR, ${valQ.totalR > 0 ? '+' : ''}${valQ.totalR.toFixed(2)}R  avg ${(valQ.count > 0 ? valQ.totalR/valQ.count : 0).toFixed(3)}R/trade`)
  console.log(`  Test:  ${testQ.count} trades, ${(testQ.winRate*100).toFixed(1)}% WR, ${testQ.totalR > 0 ? '+' : ''}${testQ.totalR.toFixed(2)}R  avg ${(testQ.count > 0 ? testQ.totalR/testQ.count : 0).toFixed(3)}R/trade`)

  // Show top enter states
  const states = new Map<string, { enter: number; skip: number }>()
  for (const [key, value] of bestQ) {
    const [state, action] = key.split('::')
    if (!state || !action) continue
    const existing = states.get(state) ?? { enter: 0, skip: 0 }
    if (action === 'enter') { existing.enter = value } else { existing.skip = value }
    states.set(state, existing)
  }
  const enterStates = [...states.entries()].filter(([,v]) => v.enter > v.skip && v.enter > 0.01).sort((a,b) => b[1].enter - a[1].enter)

  console.log(`\nPolicy: ${enterStates.length} states with positive enter Q`)
  console.log('Top 10 enter states:')
  for (const [state, qv] of enterStates.slice(0, 10)) {
    const p = state.split('|')
    console.log(`  regime=${p[0]} auction=${p[1]} level=${p[2]} mode=${p[3]} side=${p[4]} dir=${p[5]} intent=${p[6]} vp=${p[7]} pressure=${p[8]}`)
    console.log(`    Q(enter)=${qv.enter.toFixed(3)} Q(skip)=${qv.skip.toFixed(3)}`)
  }

  // Save Q-table
  const qObj: Record<string, number> = {}
  for (const [k, v] of bestQ) qObj[k] = v
  const { writeFileSync } = await import('fs')
  writeFileSync('D:\\Projects\\agoratest\\.data\\rl-q-table.json', JSON.stringify(qObj, null, 2))
  console.log(`\nQ-table saved (${bestQ.size} entries)`)
}

main().catch(e => { console.error(e); process.exit(1) })
