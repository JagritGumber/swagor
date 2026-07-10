import { createFileRoute, redirect } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { DashboardPage } from '@/components/dashboard/page'
import type { DashboardData } from '@/components/dashboard/types'

async function fetchBalanceUsd(userId: string): Promise<number> {
  try {
    const { getCircleWalletForUser } = await import('@/data/circle-wallet.ts')
    const { getWalletBalance } = await import('@/data/balance.ts')
    const wallet = await getCircleWalletForUser(userId)
    if (!wallet) return 0
    return await getWalletBalance(wallet.circle_wallet_address)
  } catch {
    return 0
  }
}

async function fetchWalletAddress(userId: string): Promise<string> {
  try {
    const { getCircleWalletForUser } = await import('@/data/circle-wallet.ts')
    const wallet = await getCircleWalletForUser(userId)
    if (!wallet) return ''
    return wallet.circle_wallet_address
  } catch {
    return ''
  }
}

const template: Omit<DashboardData, 'balanceUsd' | 'walletAddress'> = {
  agentStatus: 'active',
  riskLevel: 'low',
  statusMessage: 'Selbo is running smoothly',
  statusSubtext: 'AI systems are normal. Markets are being monitored 24/7.',
  dailyAvgPnl: 127.5,
  totalPnl: 1620.18,
  sharpeRatio: 1.85,
  winRate: 68.4,
  totalTrades: 47,
  maxDrawdown: 4.2,
  marketRead: {
    asset: 'ETH-USD',
    regime: 'Ranging',
    bias: 'Neutral',
    narrative:
      'ETH consolidating within $1,750-$1,820 range. Low volatility, waiting for breakout.',
  },
  positions: [
    {
      market: 'ETH-USD',
      side: 'long',
      size: '0.5 contracts',
      entryPrice: 1788.4,
      currentPrice: 1792.1,
      pnl: 185.5,
      leverage: '2x',
    },
    {
      market: 'BTC-USD',
      side: 'short',
      size: '0.1 contracts',
      entryPrice: 43250.0,
      currentPrice: 43180.0,
      pnl: 70.0,
      leverage: '3x',
    },
  ],
  portfolioPerformance: {
    totalReturn: '+14.3%',
    monthlyReturn: '+8.7%',
    sharpeRatio: '1.85',
    sortinoRatio: '2.42',
    maxDrawdown: '4.2%',
    calmarRatio: '3.40',
  },
  activity: [
    {
      time: '2m ago',
      text: 'Opened ETH-USD long position at $1,788.40 with 2x leverage',
      type: 'action',
    },
    {
      time: '5m ago',
      text: 'Risk check passed: all positions within safety limits',
      type: 'success',
    },
    {
      time: '8m ago',
      text: 'Analyzing BTC market regime - detecting ranging conditions',
      type: 'info',
    },
    {
      time: '12m ago',
      text: 'Stop-loss adjusted on SOL-USD position to $142.50',
      type: 'action',
    },
    {
      time: '15m ago',
      text: 'Funding rate opportunity detected across venues',
      type: 'warning',
    },
    {
      time: '18m ago',
      text: 'Portfolio rebalanced: reduced ETH exposure by 5%',
      type: 'action',
    },
    {
      time: '22m ago',
      text: 'Volatility spike detected - reducing position sizes',
      type: 'warning',
    },
    {
      time: '25m ago',
      text: 'Market correlation analysis complete - no anomalies',
      type: 'info',
    },
    {
      time: '30m ago',
      text: 'Daily P&L target achieved - maintaining current strategy',
      type: 'success',
    },
    {
      time: '35m ago',
      text: 'New candle formed on 1h timeframe - updating read',
      type: 'info',
    },
  ],
}

type AuthLoadResult =
  | { ok: true; data: DashboardData }
  | { ok: false }

const loadDashboard = createServerFn({ method: 'GET' }).handler(
  async (): Promise<AuthLoadResult> => {
    const request = getRequest()
    const { getOptionalUser } = await import('@/lib/auth.ts')
    const user = await getOptionalUser(request)
    if (!user) return { ok: false }

    const [balanceUsd, walletAddress] = await Promise.all([
      fetchBalanceUsd(user.id),
      fetchWalletAddress(user.id),
    ])

    return { ok: true, data: { ...template, balanceUsd, walletAddress } }
  },
)

export const Route = createFileRoute('/dashboard')({
  head: () => ({
    meta: [
      { title: 'Selbo - Dashboard' },
      { name: 'color-scheme', content: 'dark' },
    ],
    links: [
      { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
      { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' },
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
      },
    ],
  }),
  loader: async () => {
    const result = await loadDashboard()
    if (!result.ok) {
      throw redirect({ to: '/login' })
    }
    return result.data
  },
  component: DashboardRoute,
})

function DashboardRoute() {
  const data = Route.useLoaderData()
  return <DashboardPage data={data} />
}
