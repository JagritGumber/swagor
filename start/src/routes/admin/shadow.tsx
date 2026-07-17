import { createFileRoute } from '@tanstack/react-router'
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

export const Route = createFileRoute('/admin/shadow')({
  component: ShadowPage,
})

function ShadowPage() {
  const [signals, setSignals] = useState<Signal[]>([])
  const [error, setError] = useState<string | null>(null)
  const [lastFetch, setLastFetch] = useState<Date | null>(null)

  useEffect(() => {
    let active = true

    async function fetchSignals() {
      try {
        const res = await fetch('http://localhost:3001/api/signals')
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        if (active) {
          setSignals(data)
          setError(null)
          setLastFetch(new Date())
        }
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : 'Fetch failed')
      }
    }

    fetchSignals()
    const id = setInterval(fetchSignals, 5000)
    return () => { active = false; clearInterval(id) }
  }, [])

  return (
    <div style={{ fontFamily: 'monospace', background: '#000', color: '#fff', minHeight: '100vh', padding: '24px' }}>
      <div style={{ marginBottom: '16px', borderBottom: '1px solid #333', paddingBottom: '8px' }}>
        <h1 style={{ fontSize: '14px', margin: 0, fontWeight: 'normal' }}>
          SHADOW TRADER <span style={{ color: '#666' }}>|</span> Live Signals
        </h1>
        <div style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>
          {error ? (
            <span style={{ color: '#f44' }}>DISCONNECTED: {error}</span>
          ) : (
            <span>
              Connected <span style={{ color: '#666' }}>|</span> Polling localhost:3001 <span style={{ color: '#666' }}>|</span> {signals.length} signals
              {lastFetch && <span> <span style={{ color: '#666' }}>|</span> Updated {lastFetch.toLocaleTimeString()}</span>}
            </span>
          )}
        </div>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
        <thead>
          <tr style={{ color: '#666', textAlign: 'left', borderBottom: '1px solid #333' }}>
            <th style={{ padding: '4px 8px' }}>Time</th>
            <th style={{ padding: '4px 8px' }}>Side</th>
            <th style={{ padding: '4px 8px' }}>Price</th>
            <th style={{ padding: '4px 8px' }}>Score</th>
            <th style={{ padding: '4px 8px' }}>POC Dist</th>
            <th style={{ padding: '4px 8px' }}>Vol Conc</th>
            <th style={{ padding: '4px 8px' }}>Val Low</th>
          </tr>
        </thead>
        <tbody>
          {signals.length === 0 && !error && (
            <tr>
              <td colSpan={7} style={{ padding: '24px 8px', color: '#666', textAlign: 'center' }}>
                Waiting for signals... (first signal in ~15 min)
              </td>
            </tr>
          )}
          {signals.map((s, i) => (
            <tr key={i} style={{ borderBottom: '1px solid #111' }}>
              <td style={{ padding: '4px 8px', color: '#999' }}>{s.timestamp}</td>
              <td style={{
                padding: '4px 8px',
                color: s.side === 'long' ? '#0f0' : '#f00',
                fontWeight: 'bold',
              }}>
                {s.side.toUpperCase()}
              </td>
              <td style={{ padding: '4px 8px' }}>${s.price.toFixed(2)}</td>
              <td style={{
                padding: '4px 8px',
                color: s.score > 5 ? '#0f0' : s.score > 2 ? '#ff0' : '#fff',
              }}>
                {s.score.toFixed(2)}
              </td>
              <td style={{ padding: '4px 8px' }}>{s.distToPOC.toFixed(2)}</td>
              <td style={{ padding: '4px 8px' }}>{s.volConc.toFixed(2)}</td>
              <td style={{ padding: '4px 8px' }}>{s.distToValueLow.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
