import { useState, useEffect } from 'react'

type Signal = {
  timestamp: string
  side: string
  entryPrice: number
  score: number
  reason: string
  stop: number
  target: number
  initialRisk: number
  result: 'open' | 'win' | 'loss' | 'breakeven'
  pnl: number
  exitPrice: number | null
  exitTimestamp: string | null
  exitReason: string | null
  r: number | null
}

type ApiResponse = {
  signals: Signal[]
  price: number
}

const API_URL = 'http://localhost:3001/api/signals'

export function SignalsPanel() {
  const [signals, setSignals] = useState<Signal[]>([])
  const [currentPrice, setCurrentPrice] = useState(0)
  const [connected, setConnected] = useState(false)
  const [riskPct, setRiskPct] = useState(1)

  useEffect(() => {
    let active = true

    async function fetchSignals() {
      try {
        const res = await fetch(API_URL)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data: ApiResponse = await res.json()
        if (active) {
          setSignals(Array.isArray(data) ? data : data.signals ?? [])
          setCurrentPrice(Array.isArray(data) ? 0 : data.price ?? 0)
          setConnected(true)
        }
      } catch {
        if (active) setConnected(false)
      }
    }

    fetchSignals()
    const id = setInterval(fetchSignals, 5000)
    return () => { active = false; clearInterval(id) }
  }, [])

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="sticky top-0 border-b border-border-default bg-surface-panel px-4 py-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#8892a4]">
            Signals
          </span>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-[#6b7280]">Risk</span>
              <input
                type="number"
                value={riskPct}
                onChange={(e) => setRiskPct(Number(e.target.value) || 1)}
                className="w-12 bg-white/5 border border-border-default rounded px-1.5 py-0.5 text-[10px] text-text-primary text-center"
                min="0.1"
                step="0.5"
              />
              <span className="text-[10px] text-[#6b7280]">%</span>
            </div>
            {currentPrice > 0 && (
              <span className="font-data text-[11px] text-text-primary">
                ${currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            )}
            <div className={`h-1.5 w-1.5 rounded-full ${connected ? 'bg-[#00ff85]' : 'bg-[#f87171]'}`} />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {signals.length === 0 && connected && (
          <div className="flex h-32 items-center justify-center text-[11px] text-[#6b7280]">
            Waiting for first signal...
          </div>
        )}

        {!connected && (
          <div className="flex h-32 items-center justify-center text-[11px] text-[#f87171]">
            Shadow trader not running
          </div>
        )}

        {signals.map((signal, i) => (
          <SignalRow key={i} signal={signal} currentPrice={currentPrice} riskPct={riskPct} />
        ))}
      </div>
    </div>
  )
}

function SignalRow({ signal, currentPrice, riskPct }: { signal: Signal; currentPrice: number; riskPct: number }) {
  const isLong = signal.side === 'long'
  const isOpen = signal.result === 'open'
  const entryPrice = signal.entryPrice ?? (signal as any).price ?? 0

  const hasPrice = currentPrice > 0 && entryPrice > 0
  const pnlPct = hasPrice && isOpen
    ? isLong
      ? ((currentPrice - entryPrice) / entryPrice) * 100
      : ((entryPrice - currentPrice) / entryPrice) * 100
    : null

  const timeAgo = isOpen ? getTimeAgo(signal.timestamp) : getDuration(signal.timestamp, signal.exitTimestamp)

  const exitLabel = isOpen
    ? signal.reason
    : signal.exitReason === 'trailed' ? 'Trailed Out'
    : signal.exitReason === 'target' ? 'Target Hit'
    : 'Stopped Out'

  const resultColor = isOpen
    ? pnlPct === null ? 'text-[#6b7280]' : pnlPct > 0 ? 'text-[#00ff85]' : pnlPct < 0 ? 'text-[#f87171]' : 'text-[#6b7280]'
    : signal.exitReason === 'trailed' ? 'text-[#00ff85]'
    : signal.exitReason === 'target' ? 'text-[#00ff85]'
    : 'text-[#f87171]'

  const displayValue = isOpen
    ? pnlPct !== null ? `${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(3)}%` : '--'
    : signal.r != null ? `${(signal.r * riskPct) >= 0 ? '+' : ''}${(signal.r * riskPct).toFixed(1)}%` : '--'

  return (
    <div className="border-b border-border-default px-4 py-2.5 hover:bg-white/[0.02]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`text-[11px] font-bold uppercase ${
            isLong ? 'text-[#00ff85]' : 'text-[#f87171]'
          }`}>
            {signal.side}
          </span>
          <span className="font-data text-[12px] text-text-primary">
            ${entryPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </span>
          {!isOpen && signal.exitPrice != null && (
            <>
              <span className="text-[10px] text-[#6b7280]">→</span>
              <span className="font-data text-[12px] text-text-primary">
                ${signal.exitPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </>
          )}
        </div>
        <span className={`font-data text-[11px] font-medium ${resultColor}`}>
          {displayValue}
        </span>
      </div>

      <div className="mt-1 flex items-center justify-between">
        <span className="text-[10px] text-[#6b7280]">
          {timeAgo}
        </span>
        <span className="text-[10px] text-[#6b7280]">
          {exitLabel}
        </span>
      </div>
    </div>
  )
}

function getTimeAgo(timestamp: string): string {
  const signalTime = new Date(timestamp.replace(' ', 'T') + 'Z').getTime()
  const now = Date.now()
  const diffMs = now - signalTime
  const diffMin = Math.floor(diffMs / 60000)

  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin} min ago`
  const diffHours = Math.floor(diffMin / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  return `${Math.floor(diffHours / 24)}d ago`
}

function getDuration(entryTimestamp: string, exitTimestamp: string | null): string {
  if (!exitTimestamp) return ''
  const entry = new Date(entryTimestamp.replace(' ', 'T') + 'Z').getTime()
  const exit = new Date(exitTimestamp.replace(' ', 'T') + 'Z').getTime()
  const diffMs = exit - entry
  const diffMin = Math.floor(diffMs / 60000)

  if (diffMin < 1) return '<1 min'
  if (diffMin < 60) return `${diffMin} min`
  const diffHours = Math.floor(diffMin / 60)
  return `${diffHours}h ${diffMin % 60}m`
}
