import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'

import { FONT_UI, SURFACE_BODY, TEXT_PRIMARY } from '../../constants/theme.ts'
import { routes } from '../../routes.ts'
import { PortfolioChartEntry } from './chart-entry.tsx'

export function Dashboard(handle: Handle<{}>) {
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
      <PortfolioChartEntry />
    </div>
  )
}
