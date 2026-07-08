import type { Handle } from 'remix/ui'
import { Document } from '../../document.tsx'
import { LandingView, type LandingViewProps } from '../../components/landing/view.tsx'
import { routes } from '../../routes.ts'

interface LandingPageProps extends LandingViewProps {
  user?: { address: string }
}

export function LandingPage(handle: Handle<LandingPageProps>) {
  return () => {
    const { candles, segments, auction, regime, read, plan, asset, user } = handle.props

    return (
      <Document
        title="Selbo - AI Trading Agent"
        user={user}
        publicRoute
        head={
          <>
            <meta name="color-scheme" content="dark" />
            <link rel="preconnect" href="https://fonts.googleapis.com" />
            <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
            <link
              rel="stylesheet"
              href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap"
            />
            <link rel="stylesheet" href={routes.assets.href({ path: 'app/assets/chart.css' })} />
          </>
        }
      >
        <LandingView
          candles={candles}
          segments={segments}
          auction={auction}
          regime={regime}
          read={read}
          plan={plan}
          asset={asset}
        />
      </Document>
    )
  }
}
