export type AgentStatus = 'active' | 'inactive'
export type RiskLevel = 'low' | 'medium' | 'high'

export interface DashboardData {
  balanceUsd: number
  agentStatus: AgentStatus
  riskLevel: RiskLevel
  statusMessage: string
  statusSubtext: string
}
