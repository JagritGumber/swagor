import { clientEntry, ref, type Handle, type SerializableProps } from 'remix/ui'
import type { Candle } from '../../types/candles.ts'
import type { OverlaySegment } from '../chart/types.ts'
import { createChart } from '../chart/create-chart.ts'

interface ChartEntryProps extends SerializableProps {
  candles: Candle[]
  segments: OverlaySegment[]
}

export const PortfolioChartEntry = clientEntry(
  import.meta.url,
  function PortfolioChartEntry(handle: Handle<ChartEntryProps>) {
    return () => (
      <div
        id="chart-container"
        style={{ position: 'relative', display: 'block', width: '100%', height: 'calc(100vh - 48px)' }}
        mix={ref((node, signal) => {
          if (!(node instanceof HTMLElement)) return
          const chart = createChart({
            container: node,
            candles: handle.props.candles,
            segments: handle.props.segments,
          })
          chart.render()
          signal.addEventListener('abort', () => chart.destroy())
        })}
      />
    )
  },
)
