import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'

import { FONT_UI, SURFACE_BODY, TEXT_PRIMARY } from '../../constants/theme.ts'
import { routes } from '../../routes.ts'
import type { Candle } from '../../types/candles.ts'
import type { OverlaySegment } from '../chart/types.ts'
import { PortfolioChartEntry } from './chart-entry.tsx'

interface DashboardProps {
  candles: Candle[]
  segments: OverlaySegment[]
}

export function Dashboard(handle: Handle<DashboardProps>) {
  const { candles, segments } = handle.props

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
      <PortfolioChartEntry candles={candles} segments={segments} />
    </div>
  )
}
