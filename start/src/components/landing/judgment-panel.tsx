import { useEffect, useState } from 'react'
import { LastRead } from './last-read'

export interface MindLogEntry {
  timestamp: number
  regime: string | null
  narrative: string | null
  stance: string | null
}

interface StanceBarProps {
  stance: string | null
  prominent?: boolean
}

interface JudgmentPanelProps {
  log: MindLogEntry[]
  updatedAt: number | null
  asset: string
}

function parseStance(stance: string | null): { direction: 'long' | 'short' | 'neutral'; fill: number } {
  if (!stance) return { direction: 'neutral', fill: 0 }
  if (stance === 'long' || stance === 'hold') return { direction: 'long', fill: 1 }
  if (stance === 'short') return { direction: 'short', fill: 1 }
  if (stance === 'possible-long') return { direction: 'long', fill: 0.6 }
  if (stance === 'possible-short') return { direction: 'short', fill: 0.6 }
  if (stance === 'watch-long') return { direction: 'long', fill: 0.3 }
  if (stance === 'watch-short') return { direction: 'short', fill: 0.3 }
  return { direction: 'neutral', fill: 0 }
}

function StanceBar({ stance, prominent = false }: StanceBarProps) {
  const { direction, fill } = parseStance(stance)
  const barColor = direction === 'long' ? '#00d464' : direction === 'short' ? '#ff5050' : 'transparent'
  const height = prominent ? 'h-3' : 'h-1.5'

  return (
    <div className={`relative ${height} w-full overflow-hidden rounded-sm bg-white/5`}>
      {direction === 'long' && (
        <div
          className="absolute left-1/2 top-0 h-full transition-all duration-300"
          style={{ width: `${fill * 50}%`, backgroundColor: barColor }}
        />
      )}
      {direction === 'short' && (
        <div
          className="absolute right-1/2 top-0 h-full transition-all duration-300"
          style={{ width: `${fill * 50}%`, backgroundColor: barColor }}
        />
      )}
    </div>
  )
}

interface JudgmentPanelProps {
  log: MindLogEntry[]
  updatedAt: number | null
  asset: string
}

function timeAgo(ms: number): string {
  const seconds = Math.floor((Date.now() - ms) / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ago`
}

function cleanPart(s: string): string {
  return s.replace(/\.+$/, '').trim()
}

function buildSentence(entry: MindLogEntry): string {
  const parts: string[] = []

  if (entry.regime) {
    parts.push(cleanPart(entry.regime))
  }

  if (entry.narrative) {
    parts.push(cleanPart(entry.narrative))
  }

  if (entry.stance) {
    parts.push(cleanPart(entry.stance))
  }

  if (parts.length === 0) return 'Watching the market.'

  return parts[0] + (parts.length > 1 ? '. ' + parts.slice(1).join('. ') : '') + '.'
}

export function JudgmentPanel({ log, updatedAt, asset }: JudgmentPanelProps) {
  const [history, setHistory] = useState<MindLogEntry[]>([])

  useEffect(() => {
    fetch(`/api/decisions?asset=${asset}&limit=20`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok && data.data?.history) {
          const entries: MindLogEntry[] = data.data.history.map((h: {
            action: string
            thesis: string | null
            decidedAt: string
          }) => ({
            timestamp: new Date(h.decidedAt).getTime(),
            regime: null,
            narrative: h.thesis ?? null,
            stance: h.action === 'no_trade' ? 'no-trade' : h.action,
          }))
          setHistory(entries)
        }
      })
      .catch(() => {})
  }, [asset])

  const merged = [...history, ...log]
  const seen = new Set<number>()
  const deduped = merged.filter((e) => {
    if (seen.has(e.timestamp)) return false
    seen.add(e.timestamp)
    return true
  })
  const reversed = deduped.reverse()
  const latestStance = reversed.length > 0 ? reversed[0].stance : null

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden border-l border-border-default bg-surface-panel">
      <div className="sticky top-0 z-10 border-b border-border-default bg-surface-panel px-4 py-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8892a4]">Selbo&apos;s Mind</span>
      </div>

      {latestStance && (
        <div className="border-b border-border-default px-4 py-3">
          <StanceBar stance={latestStance} prominent />
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col gap-0 overflow-y-auto p-4">
        {reversed.length === 0 ? (
          <div className="text-[13px] leading-[1.6] text-[#8892a4]">Watching...</div>
        ) : (
          reversed.map((entry, i) => (
            <div key={entry.timestamp + '-' + i} className="flex flex-col gap-1 border-b border-border-default py-3">
              <div className="text-[11px] text-[#8892a4]">{timeAgo(entry.timestamp)}</div>
              <StanceBar stance={entry.stance} />
              <div className="text-[13px] leading-[1.6] text-white/80">{buildSentence(entry)}</div>
            </div>
          ))
        )}
      </div>

      {updatedAt ? (
        <div className="border-t border-border-default px-4 py-3">
          <LastRead updatedAt={updatedAt} />
        </div>
      ) : null}
    </div>
  )
}
