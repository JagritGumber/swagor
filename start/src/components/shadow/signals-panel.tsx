import { useState, useEffect } from 'react'

type Signal = {
  timestamp: string
  side: string
  price: number
  score: number
  distToPOC: number
  volConc: number
  distToValueLow: number
}

const API_URL = 'http://localhost:3001/api/signals'

export function SignalsPanel() {
  const [signals, setSignals] = useState<Signal[]>([])
  const [connected, setConnected] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  useEffect(() => {
    let active = true

    async function fetchSignals() {
      try {
        const res = await fetch(API_URL)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        if (active) {
          setSignals(data)
          setConnected(true)
          setLastUpdate(new Date())
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
            Live Signals
          </span>
          <div className="flex items-center gap-2">
            <div className={`h-1.5 w-1.5 rounded-full ${connected ? 'bg-[#00ff85]' : 'bg-[#f87171]'}`} />
            <span className="text-[10px] text-[#6b7280]">
              {connected ? 'LIVE' : 'OFFLINE'}
            </span>
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
          <SignalRow key={i} signal={signal} />
        ))}
      </div>
    </div>
  )
}

function SignalRow({ signal }: { signal: Signal }) {
  const isLong = signal.side === 'long'
  const scoreColor = signal.score > 5 ? 'text-[#00ff85]' : signal.score > 2 ? 'text-[#fbbf24]' : 'text-[#e1e4ea]'

  return (
    <div className="border-b border-border-default px-4 py-2.5 hover:bg-white/[0.02]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className={`text-[10px] font-bold uppercase ${
              isLong ? 'text-[#00ff85]' : 'text-[#f87171]'
            }`}
          >
            {signal.side}
          </span>
          <span className="text-[11px] text-[#6b7280]">
            {signal.timestamp.split(' ')[1]}
          </span>
        </div>
        <span className={`text-[11px] font-medium ${scoreColor}`}>
          {signal.score.toFixed(2)}
        </span>
      </div>

      <div className="mt-1 flex items-center gap-3">
        <span className="font-data text-[12px] text-text-primary">
          ${signal.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </span>
        <span className="text-[10px] text-[#6b7280]">
          POC {signal.distToPOC.toFixed(2)}
        </span>
        <span className="text-[10px] text-[#6b7280]">
          VOL {signal.volConc.toFixed(2)}
        </span>
      </div>
    </div>
  )
}
