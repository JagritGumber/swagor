import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'

import type { ReaderReadSuccess } from '../../types/reader.ts'
import { FONT_UI } from '../../constants/theme.ts'
import { WidgetHolder } from '../widget-holder.tsx'
import { Header } from './header.tsx'
import { RegimeWidget } from '../widgets/regime.tsx'
import { AuctionWidget } from '../widgets/auction.tsx'
import { PositionWidget } from '../widgets/position.tsx'

interface DashboardProps {
  read: ReaderReadSuccess
}

export function Dashboard(handle: Handle<DashboardProps>) {
  const { read } = handle.props

  const widgets = [
    { key: 'regime', render: () => <RegimeWidget read={read} /> },
    { key: 'auction', render: () => <AuctionWidget read={read} /> },
    { key: 'position', render: () => <PositionWidget read={read} /> },
  ]

  return () => (
    <div
      mix={css({
        minHeight: '100vh',
        background: 'oklch(0.12 0.006 260)',
        color: 'oklch(0.88 0.01 260)',
        fontFamily: FONT_UI,
        fontSize: '13px',
        lineHeight: 1.5,
        WebkitFontSmoothing: 'antialiased',
        MozOsxFontSmoothing: 'grayscale',
        '& *, & *::before, & *::after': { boxSizing: 'border-box' },
      })}
    >
      <Header read={read} />
      <WidgetHolder widgets={widgets} />
    </div>
  )
}
