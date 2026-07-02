import { clientEntry, ref, type Handle, type SerializableProps } from 'remix/ui'
import type { Candle } from '../../types/candles.ts'
import type { OverlaySegment } from '../chart/types.ts'
import { createAgentChart } from './chart-panel.ts'

interface ChartEntryProps extends SerializableProps {
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
          const chart = createAgentChart({
            container: node,
            candles: handle.props.candles,
            segments: handle.props.segments,
            auction: handle.props.auction,
            plan: handle.props.plan,
          })
          signal.addEventListener('abort', () => chart.destroy())
        })}
      />
    )
  },
)
