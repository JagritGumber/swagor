import { clientEntry, ref, type Handle } from 'remix/ui'
import type { Candle } from '../../types/candles.ts'
import type { OverlaySegment } from '../chart/types.ts'
import { createLWChart } from '../chart/lw-chart.ts'
import { connectLiveCandles } from '../../data/live-candles.ts'

interface AgentChartData {
  candles: Candle[]
  segments: OverlaySegment[]
  auction: {
    profile: {
      poc: number
      valueAreaLow: number
      valueAreaHigh: number
      bins: { low: number; high: number; volume: number }[]
    } | null
  } | null
  plan: {
    status: string
    side?: string
    entryLow?: number
    entryHigh?: number
    stop?: number
    target?: number
  } | null
}

function readAgentData(): AgentChartData {
  const el = document.getElementById('agent-chart-data')
  if (!(el instanceof HTMLElement)) throw new Error('Missing agent-chart-data script tag')
  return JSON.parse(el.textContent!)
}

export const AgentChartEntry = clientEntry(
  import.meta.url,
  function AgentChartEntry(_handle: Handle<{}>) {
    return () => (
      <div
        style={{ width: '100%', height: '100%' }}
        mix={ref((node, signal) => {
          if (!(node instanceof HTMLElement)) return
          const { candles, segments, auction, plan } = readAgentData()
          const params = new URLSearchParams(window.location.search)
          const asset = params.get('asset') ?? 'ETH'
          const interval = params.get('interval') ?? '1h'

          const chart = createLWChart({
            container: node,
            candles,
            segments,
            auction,
            plan,
          })

          connectLiveCandles(asset, interval, {
            onUpdate: (candle) => chart.updateCandle(candle),
            onClose: (candle) => chart.appendCandle(candle),
          }, signal)

          signal.addEventListener('abort', () => chart.destroy())
        })}
      />
    )
  },
)
