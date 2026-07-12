import { useEffect, useState } from 'react'
import { LastRead } from './last-read'

export interface MindLogEntry {
  timestamp: number
  regime: string | null
  narrative: string | null
  stance: string | null
}

interface JudgmentPanelProps {
  log: MindLogEntry[]
  updatedAt: number | null
  asset: string
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

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden border-l border-border-default bg-surface-panel">
      <div className="border-b border-border-default bg-surface-panel px-4 py-2">
        <span className="text-[13px] font-semibold text-white">Selbo&apos;s Mind</span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-0 overflow-y-auto px-4 py-2">
        {reversed.length === 0 ? (
          <div className="text-[13px] leading-[1.6] text-[#8892a4]">Watching...</div>
        ) : (
          reversed.map((entry, i) => (
            <div key={entry.timestamp + '-' + i}>
              <div className="text-[13px] leading-[1.6] text-white/80">{buildSentence(entry)}</div>
            </div>
          ))
        )}
      </div>

      {updatedAt ? (
        <div className="border-t border-border-default px-4">
          <LastRead updatedAt={updatedAt} />
        </div>
      ) : null}
    </div>
  )
}
