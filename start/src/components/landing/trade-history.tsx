import type { LandingPortfolio } from './types'

interface TradeHistoryProps {
  positions: LandingPortfolio['positions']
}

function timeAgo(ms: number): string {
  const seconds = Math.floor((Date.now() - ms) / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export function TradeHistory({ positions }: TradeHistoryProps) {
  const closed = positions
    .filter((p) => p.status === 'closed')
    .sort((a, b) => (b.exitTime ?? 0) - (a.exitTime ?? 0))

  if (closed.length === 0) {
    return <div className="px-4 py-6 text-center text-xs text-white/40">No trade history</div>
  }

  return (
    <div className="divide-y divide-white/5">
      {closed.map((pos) => (
        <div key={pos.id} className="flex items-center justify-between px-4 py-2 font-mono text-xs">
          <div className="flex items-center gap-2">
            <span className={pos.side === 'long' ? 'text-emerald-400' : 'text-red-400'}>
              {pos.side.toUpperCase()}
            </span>
            <span className="text-white">{pos.asset}</span>
            <span className="text-white/40">
              ${pos.entryPrice.toFixed(2)} &rarr; ${pos.exitPrice?.toFixed(2)}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className={(pos.pnlPct ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}>
              {(pos.pnlPct ?? 0) >= 0 ? '+' : ''}{(pos.pnlPct ?? 0).toFixed(2)}%
            </span>
            <span className="text-white/40">{pos.exitTime ? timeAgo(pos.exitTime) : ''}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
