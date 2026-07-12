import type { Position } from '@/components/dashboard/types'

interface PositionsTableProps {
  positions: Position[]
}

function sideColor(side: 'long' | 'short'): string {
  return side === 'long' ? 'text-[#00d464]' : 'text-[#ff5050]'
}

function pnlColor(pnl: number): string {
  return pnl >= 0 ? 'text-[#00d464]' : 'text-[#ff5050]'
}

export function PositionsTable({ positions }: PositionsTableProps) {
  return (
    <div className="flex min-h-0 flex-col overflow-hidden border-t border-border-default">
      <div className="border-b border-border-default bg-surface-panel px-4 py-2">
        <span className="text-[13px] font-semibold text-white">Positions</span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-auto">
        {positions.length === 0 ? (
          <div className="flex items-center justify-center px-4 py-6 text-[13px] text-[#8892a4]">
            No open positions
          </div>
        ) : (
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-border-default text-[11px] text-[#8892a4]">
                <th className="px-4 py-2 text-left font-medium">Market</th>
                <th className="px-4 py-2 text-left font-medium">Side</th>
                <th className="px-4 py-2 text-right font-medium">Size</th>
                <th className="px-4 py-2 text-right font-medium">Entry</th>
                <th className="px-4 py-2 text-right font-medium">Current</th>
                <th className="px-4 py-2 text-right font-medium">PnL</th>
                <th className="px-4 py-2 text-right font-medium">Lev</th>
              </tr>
            </thead>
            <tbody>
              {positions.map((p, i) => (
                <tr key={`${p.market}-${i}`} className="border-b border-border-default last:border-b-0">
                  <td className="px-4 py-2 font-medium text-white">{p.market}</td>
                  <td className={`px-4 py-2 font-medium ${sideColor(p.side)}`}>{p.side}</td>
                  <td className="px-4 py-2 text-right font-data text-white/80">{p.size}</td>
                  <td className="px-4 py-2 text-right font-data text-white/80">{p.entryPrice}</td>
                  <td className="px-4 py-2 text-right font-data text-white/80">{p.currentPrice}</td>
                  <td className={`px-4 py-2 text-right font-data font-medium ${pnlColor(p.pnl)}`}>
                    {pnl >= 0 ? '+' : ''}{p.pnl}
                  </td>
                  <td className="px-4 py-2 text-right font-data text-[#8892a4]">{p.leverage}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
