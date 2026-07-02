import { clientEntry, ref, type Handle } from 'remix/ui'
import type { Candle } from '../../types/candles.ts'
import type { OverlaySegment } from '../chart/types.ts'
import { createChart } from '../chart/create-chart.ts'
import { connectLiveCandles } from '../../data/live-candles.ts'

interface ChartEntryProps {
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
          const params = new URLSearchParams(window.location.search)
          const asset = params.get('asset') ?? 'ETH'
          const interval = params.get('interval') ?? '1h'

          const chart = createChart({
            container: node,
            candles: handle.props.candles,
            segments: handle.props.segments,
          })
          chart.render()

          connectLiveCandles(asset, interval, {
            onInit: () => {},
            onUpdate: (candle) => chart.updateCandle(candle),
            onClose: (candle) => chart.appendCandle(candle),
          }, signal)

          signal.addEventListener('abort', () => chart.destroy())
        })}
      />
    )
  },
)
