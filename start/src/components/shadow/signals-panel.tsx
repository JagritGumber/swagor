import { useState, useEffect, useCallback } from 'react'

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
  const [account, setAccount] = useState(10000)
  const [leverage, setLeverage] = useState(20)
  const [risk, setRisk] = useState(1)

  const fetchSignals = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        account: String(account),
        leverage: String(leverage),
        risk: String(risk),
      })
      const res = await fetch(`${API_URL}?${params}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: ApiResponse = await res.json()
      setSignals(Array.isArray(data) ? data : data.signals ?? [])
      setCurrentPrice(Array.isArray(data) ? 0 : data.price ?? 0)
      setConnected(true)
    } catch {
      setConnected(false)
    }
  }, [account, leverage, risk])

  useEffect(() => {
    fetchSignals()
    const id = setInterval(fetchSignals, 5000)
    return () => clearInterval(id)
  }, [fetchSignals])

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="sticky top-0 border-b border-border-default bg-surface-panel px-4 py-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#8892a4]">
            Signals
          </span>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] text-[#6b7280]">$</span>
              <input
                type="number"
                value={account}
                onChange={(e) => setAccount(Number(e.target.value) || 10000)}
                className="w-16 bg-white/5 border border-border-default rounded px-1.5 py-0.5 text-[9px] text-text-primary text-right font-data"
                min="100"
                step="1000"
              />
              <span className="text-[9px] text-[#6b7280]">{leverage}x</span>
              <input
                type="number"
                value={leverage}
                onChange={(e) => setLeverage(Number(e.target.value) || 20)}
                className="w-8 bg-white/5 border border-border-default rounded px-1 py-0.5 text-[9px] text-text-primary text-right font-data"
                min="1"
                max="125"
              />
              <span className="text-[9px] text-[#6b7280]">{risk}%</span>
              <input
                type="number"
                value={risk}
                onChange={(e) => setRisk(Number(e.target.value) || 1)}
                className="w-8 bg-white/5 border border-border-default rounded px-1 py-0.5 text-[9px] text-text-primary text-right font-data"
                min="0.1"
                step="0.5"
              />
            </div>
            {currentPrice > 0 && (
              <span className="font-data text-[10px] text-text-primary">
                ${currentPrice.toLocaleString()}
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
