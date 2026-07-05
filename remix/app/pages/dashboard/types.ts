export type AgentStatus = 'active' | 'inactive'
export type RiskLevel = 'low' | 'medium' | 'high'

export interface DashboardData {
  balanceUsd: number
  change24hUsd: number
  change24hPct: number
  agentStatus: AgentStatus
  riskLevel: RiskLevel
  statusMessage: string
  statusSubtext: string
}
