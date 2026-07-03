import { clientEntry, ref, type Handle } from 'remix/ui'
import type { Candle } from '../../types/candles.ts'
import type { OverlaySegment } from '../chart/types.ts'
import { createLWChart } from '../chart/lw-chart.ts'
import { connectLiveCandles } from '../../data/live-candles.ts'

interface ChartEntryProps {
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

export const AgentChartEntry = clientEntry(
  import.meta.url,
  function AgentChartEntry(handle: Handle<ChartEntryProps>) {
    return () => (
      <div
        style={{ width: '100%', height: '100%' }}
        mix={ref((node, signal) => {
          if (!(node instanceof HTMLElement)) return
          const params = new URLSearchParams(window.location.search)
          const asset = params.get('asset') ?? 'ETH'
          const interval = params.get('interval') ?? '1h'

          const chart = createLWChart({
            container: node,
            candles: handle.props.candles,
            segments: handle.props.segments,
            auction: handle.props.auction,
            plan: handle.props.plan,
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
