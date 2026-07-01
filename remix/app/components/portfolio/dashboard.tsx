import type { Handle } from 'remix/ui'
import { css, ref } from 'remix/ui'

import { FONT_UI, SURFACE_BODY, TEXT_PRIMARY } from '../../constants/theme.ts'
import { routes } from '../../routes.ts'
import type { Candle } from '../../types/candles.ts'
import type { OverlaySegment } from '../chart/types.ts'
import { createChart } from '../chart/create-chart.ts'

interface DashboardProps {
  candles: Candle[]
  segments: OverlaySegment[]
}

export function Dashboard(handle: Handle<DashboardProps>) {
  const { candles, segments } = handle.props
  const chartData = JSON.stringify({ candles, segments })

  return () => (
    <div
      mix={css({
        background: SURFACE_BODY,
        color: TEXT_PRIMARY,
        fontFamily: FONT_UI,
        fontSize: '14px',
        lineHeight: 1.5,
        WebkitFontSmoothing: 'antialiased',
        MozOsxFontSmoothing: 'grayscale',
        '& *, & *::before, & *::after': { boxSizing: 'border-box' },
      })}
    >
      <link rel="stylesheet" href={routes.assets.href({ path: 'app/assets/chart.css' })} />
      <div
        id="chart-container"
        style={{ position: 'relative', display: 'block', width: '100%', height: 'calc(100vh - 48px)' }}
        mix={ref((node, signal) => {
          if (!(node instanceof HTMLElement)) return
          const dataEl = document.getElementById('chart-data')
          if (!dataEl) throw new Error('chart-data element not found')
          const data = JSON.parse(dataEl.textContent ?? '{}')
          if (!data.candles) throw new Error('chart-data missing candles')
          const chart = createChart({
            container: node,
            candles: data.candles,
            segments: data.segments,
          })
          chart.render()
          signal.addEventListener('abort', () => chart.destroy())
        })}
      />
      <script id="chart-data" type="application/json">{chartData}</script>
    </div>
  )
}
