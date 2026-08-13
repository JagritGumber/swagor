import { desc } from 'drizzle-orm'
import { getDb } from '@/db/client.ts'
import { outcomes } from '@/db/schema.ts'

export interface SelboEquityData {
  totalEquity: number
  dailyChange: number
  dailyChangePct: number
  equityCurve: { timestamp: number; equity: number }[]
}

const INITIAL_EQUITY = 10_000

export async function getSelboEquity(): Promise<SelboEquityData> {
  const db = await getDb()

  const rows = await db
    .select()
    .from(outcomes)
    .orderBy(desc(outcomes.closedAt))

  if (rows.length === 0) {
    return {
      totalEquity: INITIAL_EQUITY,
      dailyChange: 0,
      dailyChangePct: 0,
      equityCurve: [{ timestamp: Date.now(), equity: INITIAL_EQUITY }],
    }
  }

  // Build equity curve from outcomes (oldest first)
  const sorted = [...rows].reverse()
  let equity = INITIAL_EQUITY
  const curve: { timestamp: number; equity: number }[] = []

  const now = new Date()
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  let dailyChange = 0

  for (const row of sorted) {
    equity += row.pnl ?? 0
    const ts = row.closedAt?.getTime() ?? Date.now()
    curve.push({ timestamp: ts, equity })

    if (ts >= dayStart) {
      dailyChange += row.pnl ?? 0
    }
  }

  return {
    totalEquity: equity,
    dailyChange,
    dailyChangePct: equity > 0 ? (dailyChange / equity) * 100 : 0,
    equityCurve: curve,
  }
}
