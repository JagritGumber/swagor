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
  activity: [
    { time: '2m ago', text: 'Opened ETH-USD long position at $1,788.40 with 2x leverage', type: 'action' },
    { time: '5m ago', text: 'Risk check passed: all positions within safety limits', type: 'success' },
    { time: '8m ago', text: 'Analyzing BTC market regime — detecting ranging conditions', type: 'info' },
    { time: '12m ago', text: 'Stop-loss adjusted on SOL-USD position to $142.50', type: 'action' },
    { time: '15m ago', text: 'Funding rate opportunity detected across venues', type: 'warning' },
    { time: '18m ago', text: 'Portfolio rebalanced: reduced ETH exposure by 5%', type: 'action' },
    { time: '22m ago', text: 'Volatility spike detected — reducing position sizes', type: 'warning' },
    { time: '25m ago', text: 'Market correlation analysis complete — no anomalies', type: 'info' },
    { time: '30m ago', text: 'Daily P&L target achieved — maintaining current strategy', type: 'success' },
    { time: '35m ago', text: 'New candle formed on 1h timeframe — updating read', type: 'info' },
  ],
}

export async function dashboard(context: AppContext) {
  const auth = context.get(Auth)
  if (!auth.ok) return redirect('/login')
  const user = { address: auth.identity.wallets[0].address }

  return context.render(<DashboardPage data={template} user={user} />)
}
