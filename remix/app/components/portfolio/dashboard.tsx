import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'

import { FONT_UI, SURFACE_BODY, TEXT_PRIMARY } from '../../constants/theme.ts'
import { routes } from '../../routes.ts'
import { Navbar } from '../navbar.tsx'

export function Dashboard(handle: Handle) {
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
      <canvas
        id="candle-chart-canvas"
        style={{ display: 'block', width: '100%', height: 'calc(100vh - 48px)' }}
      />
      <script
        type="module"
        src={routes.assets.href({ path: 'app/assets/candle-chart-client.ts' })}
      />
    </div>
  )
}
