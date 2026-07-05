export type AgentStatus = 'active' | 'inactive'
export type RiskLevel = 'low' | 'medium' | 'high'

export interface ActivityEntry {
  time: string
  text: string
  type: 'info' | 'action' | 'warning' | 'success'
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
  activity: ActivityEntry[]
}
