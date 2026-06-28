import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'

import type { ReaderReadSuccess } from '../../types/reader.ts'
import type { Candle } from '../../types/candles.ts'
import type { OverlayData } from '../chart/types.ts'
import { FONT_UI, SURFACE_BODY, TEXT_PRIMARY } from '../../constants/theme.ts'
import { Navbar } from '../navbar.tsx'
import { CandleChart } from '../chart/candle-chart.tsx'

interface DashboardProps {
  read: ReaderReadSuccess
  candles: Candle[]
}

export function Dashboard(handle: Handle<DashboardProps>) {
  const { read, candles } = handle.props

  const overlays: OverlayData = {
    valueAreaLow: read.auction.profile?.valueAreaLow,
    valueAreaHigh: read.auction.profile?.valueAreaHigh,
    poc: read.auction.profile?.poc,
    regimeMode: read.regime.mode,
    currentPrice: read.lastPrice,
  }

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
      <CandleChart candles={candles} overlays={overlays} />
    </div>
  )
}
