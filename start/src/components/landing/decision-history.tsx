import { useEffect, useState } from 'react'

interface DecisionEntry {
  id: string
  asset: string
  action: string
  conviction: string
  thesis: string | null
  decidedAt: string
}

interface DecisionHistoryProps {
  asset: string
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

const CONVICTION_BADGE: Record<string, string> = {
  high: 'text-[#00d464]',
  medium: 'text-[#f0b429]',
  low: 'text-[#8892a4]',
}

export function DecisionHistory({ asset }: DecisionHistoryProps) {
  const [decisions, setDecisions] = useState<DecisionEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/decisions?asset=${asset}&limit=20`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok && data.data?.history) {
          setDecisions(data.data.history)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [asset])

  if (loading) {
    return <div className="px-4 py-6 text-center text-[11px] text-[#8892a4]">Loading...</div>
  }

  if (decisions.length === 0) {
    return <div className="px-4 py-6 text-center text-[11px] text-[#8892a4]">No decisions yet</div>
  }

  return (
    <div className="divide-y divide-border-default">
      {decisions.map((d) => (
        <div key={d.id} className="flex items-start justify-between px-4 py-2.5">
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-semibold uppercase tracking-[0.5px] ${
                d.action === 'long' ? 'text-[#00d464]'
                  : d.action === 'short' ? 'text-[#ff5050]'
                  : 'text-[#8892a4]'
              }`}>
                {d.action === 'no_trade' ? 'no trade' : d.action}
              </span>
              <span className={`text-[10px] font-medium ${CONVICTION_BADGE[d.conviction] ?? 'text-[#8892a4]'}`}>
                {d.conviction}
              </span>
            </div>
            {d.thesis ? (
              <div className="text-[12px] leading-[1.5] text-white/60 max-w-[200px] truncate">{d.thesis}</div>
            ) : null}
          </div>
          <div className="text-[10px] text-[#8892a4]">{timeAgo(d.decidedAt)}</div>
        </div>
      ))}
    </div>
  )
}
