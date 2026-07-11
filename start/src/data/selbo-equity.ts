import { getLatestSnapshot, getEquityCurve } from '@/services/portfolio/portfolio-service'

export interface SelboEquityData {
  totalEquity: number
  dailyChange: number
  dailyChangePct: number
  equityCurve: { timestamp: number; equity: number }[]
}

export async function getSelboEquity(): Promise<SelboEquityData> {
  const [snapshot, equityCurve] = await Promise.all([
    getLatestSnapshot(),
    getEquityCurve(100),
  ])

  if (!snapshot) {
    return {
      totalEquity: 0,
      dailyChange: 0,
      dailyChangePct: 0,
      equityCurve: [],
    }
  }

  return {
    totalEquity: snapshot.equity,
    dailyChange: snapshot.dailyPnl,
    dailyChangePct: snapshot.equity > 0 ? (snapshot.dailyPnl / snapshot.equity) * 100 : 0,
    equityCurve,
  }
}
