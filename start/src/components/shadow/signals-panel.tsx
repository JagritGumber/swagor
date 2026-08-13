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
  positionSize: number
  notionalUsd: number
  leverageUsed: number
  feeUsd: number
  slippageUsd: number
  totalCostUsd: number
  result: 'open' | 'win' | 'loss' | 'breakeven'
  grossPnlUsd: number
  netPnlUsd: number
  exitPrice: number | null
  exitTimestamp: string | null
  exitReason: string | null
  r: number | null
}

type ApiResponse = {
  signals: Signal[]
  price: number
  accountSizeUsd: number
  maxLeverage: number
  riskPct: number
}

const API_URL = 'http://localhost:3001/api/signals'

export function SignalsPanel() {
  const [signals, setSignals] = useState<Signal[]>([])
  const [currentPrice, setCurrentPrice] = useState(0)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    let active = true

    async function fetchSignals() {
      try {
        const res = await fetch(API_URL)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data: ApiResponse = await res.json()
        setSignals(Array.isArray(data) ? data : data.signals ?? [])
        setCurrentPrice(Array.isArray(data) ? 0 : data.price ?? 0)
        setConnected(true)
      } catch {
        setConnected(false)
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
          <span className="text-[13px] font-medium text-text-primary py-1">
            Signals
          </span>
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
          <SignalRow key={i} signal={signal} currentPrice={currentPrice} account={account} />
        ))}
      </div>
    </div>
  )
}

function SignalRow({ signal, currentPrice, account }: { signal: Signal; currentPrice: number; account: number }) {
  const isLong = signal.side === 'long'
  const isOpen = signal.result === 'open'
  const entryPrice = signal.entryPrice ?? (signal as any).price ?? 0

  const hasPrice = currentPrice > 0 && entryPrice > 0

  const grossPnl = isOpen && hasPrice
    ? isLong
      ? signal.positionSize * (currentPrice - entryPrice)
      : signal.positionSize * (entryPrice - currentPrice)
    : signal.grossPnlUsd

  const fees = signal.feeUsd ?? 0
  const slip = signal.slippageUsd ?? 0
  const totalCost = signal.totalCostUsd ?? 0

  const netPnl = isOpen && hasPrice
    ? grossPnl - totalCost
    : signal.netPnlUsd

  const netPct = (netPnl / account) * 100

  const timeAgo = isOpen ? getTimeAgo(signal.timestamp) : getDuration(signal.timestamp, signal.exitTimestamp)

  const exitLabel = isOpen
    ? signal.reason
    : signal.exitReason === 'trailed' ? 'Trailed Out'
    : signal.exitReason === 'target' ? 'Target Hit'
    : 'Stopped Out'

  const netColor = netPnl > 0 ? 'text-[#00ff85]' : netPnl < 0 ? 'text-[#f87171]' : 'text-[#6b7280]'

  return (
    <div className="border-b border-border-default px-4 py-2 hover:bg-white/[0.02]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-bold uppercase ${
            isLong ? 'text-[#00ff85]' : 'text-[#f87171]'
          }`}>
            {signal.side}
          </span>
          <span className="font-data text-[11px] text-text-primary">
            ${entryPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </span>
          {!isOpen && signal.exitPrice != null && (
            <>
              <span className="text-[9px] text-[#6b7280]">{'\u2192'}</span>
              <span className="font-data text-[11px] text-text-primary">
                ${signal.exitPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </>
          )}
        </div>
        <span className={`font-data text-[11px] font-medium ${netColor}`}>
          {netPnl >= 0 ? '+' : ''}{netPct.toFixed(2)}%
        </span>
      </div>

      <div className="mt-1 flex items-center justify-between text-[9px] text-[#6b7280]">
        <span>{timeAgo}</span>
        <span>{exitLabel}</span>
      </div>

      <div className="mt-1 flex items-center gap-3 text-[9px] font-data">
        <span className="text-[#6b7280]">
          {signal.leverageUsed?.toFixed(1)}x
        </span>
        <span className={grossPnl >= 0 ? 'text-[#00ff85]/60' : 'text-[#f87171]/60'}>
          G {grossPnl >= 0 ? '+' : ''}{grossPnl.toFixed(2)}
        </span>
        <span className="text-[#f87171]/60">
          F -{fees.toFixed(2)}
        </span>
        <span className="text-[#f87171]/60">
          S -{slip.toFixed(2)}
        </span>
        <span className={netColor}>
          N {netPnl >= 0 ? '+' : ''}{netPnl.toFixed(2)}
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
