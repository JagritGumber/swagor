import type { Handle } from 'remix/ui'

import type { ReaderReadResult } from '../types/reader.ts'
import type { Candle } from '../types/candles.ts'
import type { OverlaySegment } from '../components/chart/types.ts'
import { Document } from '../document.tsx'
import { ErrorState } from '../components/portfolio/error-state.tsx'
import { Dashboard } from '../components/portfolio/dashboard.tsx'

interface PortfolioPageProps {
  read: ReaderReadResult
  candles: Candle[]
  segments: OverlaySegment[]
  user?: { address: string }
}

export function PortfolioPage(handle: Handle<PortfolioPageProps>) {
  const { read, candles, segments, user } = handle.props

  return () => (
    <Document
      title={read.ok ? `Selbo - ${read.data.asset} ${read.data.interval}` : 'Read Error'}
      head={
        <>
          <meta name="color-scheme" content="dark" />
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          <link
            rel="stylesheet"
            href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap"
          />
        </>
      }
      user={user}
    >
      {read.ok ? <><script id="portfolio-chart-data" type="application/json">{JSON.stringify({ candles, segments })}</script><Dashboard /></> : <ErrorState message={read.error} />}
    </Document>
  )
}
