import { clientEntry, ref, type Handle } from 'remix/ui'
import type { Candle } from '../../types/candles.ts'
import type { OverlaySegment } from '../chart/types.ts'
import { createLWChart } from '../chart/lw-chart.ts'
import { connectLiveCandles } from '../../data/live-candles.ts'

function readPortfolioData(): { candles: Candle[]; segments: OverlaySegment[] } {
  const el = document.getElementById('portfolio-chart-data')
  if (!(el instanceof HTMLElement)) throw new Error('Missing portfolio-chart-data script tag')
  return JSON.parse(el.textContent!)
}

export const PortfolioChartEntry = clientEntry(
  import.meta.url,
  function PortfolioChartEntry(_handle: Handle<{}>) {
    return () => (
      <div
        id="chart-container"
        style={{ position: 'relative', display: 'block', width: '100%', height: 'calc(100vh - 48px)' }}
        mix={ref((node, signal) => {
          if (!(node instanceof HTMLElement)) return
          const { candles, segments } = readPortfolioData()
          const params = new URLSearchParams(window.location.search)
          const asset = params.get('asset') ?? 'ETH'
          const interval = params.get('interval') ?? '1h'

          const chart = createLWChart({
            container: node,
            candles,
            segments,
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
