// Dashboard action — auth-gated, returns template data for the dashboard page
import { redirect } from 'remix/response/redirect'
import { Auth } from 'remix/middleware/auth'
import type { AppContext } from '../router.ts'
import { DashboardPage } from '../pages/dashboard/page.tsx'
import type { DashboardData } from '../pages/dashboard/types.ts'

const template: DashboardData = {
  balanceUsd: 12847.32,
  change24hUsd: 342.18,
  agentStatus: 'active',
  riskLevel: 'low',
  statusMessage: 'Selbo is running smoothly',
  statusSubtext: 'AI systems are normal. Markets are being monitored 24/7.',
  dailyAvgPnl: 127.50,
  totalPnl: 1620.18,
  sharpeRatio: 1.85,
  winRate: 68.4,
  totalTrades: 47,
  maxDrawdown: 4.2,
}

export async function dashboard(context: AppContext) {
  const auth = context.get(Auth)
  if (!auth.ok) return redirect('/login')
  const user = { address: auth.identity.wallets[0].address }

  return context.render(<DashboardPage data={template} user={user} />)
}
