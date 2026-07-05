export type AgentStatus = 'active' | 'inactive'
export type RiskLevel = 'low' | 'medium' | 'high'

export interface ActivityEntry {
  time: string
  text: string
  type: 'info' | 'action' | 'warning' | 'success'
}

export interface MarketRead {
  asset: string
  regime: string
  bias: string
  narrative: string
}

export interface Position {
  market: string
  side: 'long' | 'short'
  size: string
  entryPrice: number
  currentPrice: number
  pnl: number
  leverage: string
}

export interface PortfolioPerformance {
  totalReturn: string
  monthlyReturn: string
  sharpeRatio: string
  sortinoRatio: string
  maxDrawdown: string
  calmarRatio: string
}

export interface DashboardData {
  balanceUsd: number
  change24hUsd: number
  agentStatus: AgentStatus
  riskLevel: RiskLevel
  statusMessage: string
  statusSubtext: string
  dailyAvgPnl: number
  totalPnl: number
  sharpeRatio: number
  winRate: number
  totalTrades: number
  maxDrawdown: number
  marketRead: MarketRead
  positions: Position[]
  portfolioPerformance: PortfolioPerformance
  activity: ActivityEntry[]
}
