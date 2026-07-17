import { useState, useEffect } from 'react'

type Signal = {
  timestamp: string
  side: string
  entryPrice: number
  score: number
  result: 'open' | 'win' | 'loss' | 'breakeven'
  pnl: number
  exitPrice: number | null
  exitTimestamp: string | null
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

  useEffect(() => {
    let active = true

    async function fetchSignals() {
      try {
        const res = await fetch(API_URL)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data: ApiResponse = await res.json()
        if (active) {
          setSignals(data.signals)
          setCurrentPrice(data.price)
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
      <div className="sticky top-0 border-b border-border-default bg-surface-panel px-4 py-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#8892a4]">
            Signals
          </span>
          <div className="flex items-center gap-3">
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
          <SignalRow key={i} signal={signal} currentPrice={currentPrice} />
        ))}
      </div>
    </div>
  )
}

function SignalRow({ signal, currentPrice }: { signal: Signal; currentPrice: number }) {
  const isLong = signal.side === 'long'
  const isOpen = signal.result === 'open'

  const pnl = isOpen
    ? isLong
      ? currentPrice - signal.entryPrice
      : signal.entryPrice - currentPrice
    : signal.pnl

  const pnlStr = pnl >= 0 ? `+$${pnl.toFixed(2)}` : `-$${Math.abs(pnl).toFixed(2)}`
  const pnlColor = pnl > 0 ? 'text-[#00ff85]' : pnl < 0 ? 'text-[#f87171]' : 'text-[#6b7280]'

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
            ${signal.entryPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </span>
        </div>
        <span className={`font-data text-[11px] font-medium ${pnlColor}`}>
          {pnlStr}
        </span>
      </div>

      <div className="mt-1 flex items-center justify-between">
        <span className="text-[10px] text-[#6b7280]">
          {signal.timestamp.split(' ')[1]}
          {isOpen && ' ago'}
        </span>
        <span className="text-[10px] text-[#6b7280]">
          score {signal.score.toFixed(1)}
        </span>
      </div>
    </div>
  )
}
