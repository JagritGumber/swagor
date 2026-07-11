import type { LandingPortfolio } from './types'

interface OpenPositionsProps {
  positions: LandingPortfolio['positions']
}

export function OpenPositions({ positions }: OpenPositionsProps) {
  const open = positions.filter((p) => p.status === 'open')

  if (open.length === 0) {
    return <div className="px-4 py-6 text-center text-xs text-white/40">No open positions</div>
  }

  return (
    <div className="divide-y divide-white/5">
      {open.map((pos) => (
        <div key={pos.id} className="flex items-center justify-between px-4 py-2 font-mono text-xs">
          <div className="flex items-center gap-2">
            <span className={pos.side === 'long' ? 'text-emerald-400' : 'text-red-400'}>
              {pos.side.toUpperCase()}
            </span>
            <span className="text-white">{pos.asset}</span>
          </div>
          <div className="flex items-center gap-3 text-white/60">
            <span>Entry: ${pos.entryPrice.toFixed(2)}</span>
            <span>Size: ${pos.size.toFixed(2)}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
