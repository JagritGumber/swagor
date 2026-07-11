import type { LandingPortfolio } from './types'

interface PortfolioPulseProps {
  portfolio: LandingPortfolio | null
}

export function PortfolioPulse({ portfolio }: PortfolioPulseProps) {
  if (!portfolio) return null

  const pnlSign = portfolio.totalPnl >= 0 ? '+' : ''
  const dailySign = portfolio.dailyPnl >= 0 ? '+' : ''
  const winRate = portfolio.tradeCount > 0
    ? Math.round((portfolio.winCount / portfolio.tradeCount) * 100)
    : 0

  return (
    <div className="flex items-center gap-4 border-b border-white/10 px-4 py-2 text-xs font-mono">
      <div className="flex items-center gap-1.5">
        <span className="text-white/50">Equity</span>
        <span className="text-white">${portfolio.equity.toFixed(2)}</span>
        <span className={portfolio.totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}>
          ({pnlSign}{portfolio.totalPnl.toFixed(2)}%)
        </span>
      </div>

      <div className="h-3 w-px bg-white/10" />

      <div className="flex items-center gap-1.5">
        <span className="text-white/50">Open</span>
        <span className="text-white">{portfolio.openPositionCount}</span>
      </div>

      <div className="h-3 w-px bg-white/10" />

      <div className="flex items-center gap-1.5">
        <span className="text-white/50">Win Rate</span>
        <span className="text-white">{winRate}%</span>
        <span className="text-white/40">({portfolio.winCount}/{portfolio.tradeCount})</span>
      </div>

      <div className="h-3 w-px bg-white/10" />

      <div className="flex items-center gap-1.5">
        <span className="text-white/50">Today</span>
        <span className={portfolio.dailyPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}>
          {dailySign}${Math.abs(portfolio.dailyPnl).toFixed(2)}
        </span>
      </div>
    </div>
  )
}
