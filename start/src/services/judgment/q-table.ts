import { readFile } from 'fs/promises'
import { join } from 'path'

type QTable = Map<string, number>

let cachedTable: QTable | null = null
let loadPromise: Promise<QTable> | null = null

export type QTableLookupResult = {
  action: 'enter' | 'skip'
  enterQ: number
  skipQ: number
  margin: number
  found: boolean
}

export type QTableFeatures = {
  pressure: string
  largestTradeSide: string
  absorptionEvent: string
  side: string
  narrativeIntent: string
  narrativeDirection: string
}

function stateToKey(features: QTableFeatures): string {
  return [
    features.pressure,
    features.largestTradeSide,
    features.absorptionEvent,
    features.side,
    features.narrativeIntent,
    features.narrativeDirection,
  ].join('|')
}

function qKey(state: string, action: 'enter' | 'skip'): string {
  return `${state}::${action}`
}

export async function loadQTable(): Promise<QTable> {
  if (cachedTable) return cachedTable
  if (loadPromise) return loadPromise

  loadPromise = (async () => {
    const tablePath = join(process.cwd(), '.data', 'rl-q-table.json')
    const raw = await readFile(tablePath, 'utf-8')
    const obj = JSON.parse(raw) as Record<string, number>
    const table: QTable = new Map(Object.entries(obj))
    cachedTable = table
    return table
  })()

  return loadPromise
}

export function lookupQTable(
  table: QTable,
  features: QTableFeatures,
): QTableLookupResult {
  const state = stateToKey(features)
  const enterQ = table.get(qKey(state, 'enter')) ?? 0
  const skipQ = table.get(qKey(state, 'skip')) ?? 0
  const found = table.has(qKey(state, 'enter')) || table.has(qKey(state, 'skip'))

  return {
    action: enterQ >= skipQ ? 'enter' : 'skip',
    enterQ,
    skipQ,
    margin: enterQ - skipQ,
    found,
  }
}

export function readToQFeatures(
  read: {
    orderflow?: {
      pressure?: string
      events?: string[]
      largestTrade?: { side?: string } | null
    } | null
    narrativeRead?: { direction?: string; intent?: string } | null
  },
  planSide: string,
): QTableFeatures {
  const of = read.orderflow
  const events = of?.events ?? []
  const eventsStr = events.join(' ')
  const absorptionEvent = eventsStr.includes('buy-absorption') ? 'buy-absorption'
    : eventsStr.includes('sell-absorption') ? 'sell-absorption'
    : 'none'

  return {
    pressure: of?.pressure ?? 'balanced',
    largestTradeSide: of?.largestTrade?.side ?? 'none',
    absorptionEvent,
    side: planSide,
    narrativeIntent: read.narrativeRead?.intent ?? 'unknown',
    narrativeDirection: read.narrativeRead?.direction ?? 'none',
  }
}
