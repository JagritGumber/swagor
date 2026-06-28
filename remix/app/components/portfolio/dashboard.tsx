import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'

import { FONT_UI, SURFACE_BODY, TEXT_PRIMARY } from '../../constants/theme.ts'
import { routes } from '../../routes.ts'
import { Navbar } from '../navbar.tsx'
import type { Candle } from '../../types/candles.ts'
import type { OverlaySegment } from '../chart/types.ts'

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
        minHeight: '100vh',
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
      <Navbar />
      <div
        id="chart-container"
        style={{ position: 'relative', display: 'block', width: '100%', height: 'calc(100vh - 48px)' }}
      />
      <script id="chart-data" type="application/json">{chartData}</script>
      <script
        type="module"
        src={routes.assets.href({ path: 'app/assets/candle-chart-client.ts' })}
      />
    </div>
  )
}
