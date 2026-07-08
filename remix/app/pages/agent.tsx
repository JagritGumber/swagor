import type { Handle } from 'remix/ui'
import { Document } from '../document.tsx'
import type { Candle } from '../types/candles.ts'
import type { OverlaySegment } from '../components/chart/types.ts'
import { AgentView, type AgentViewProps } from '../components/agent/view.tsx'
import { routes } from '../routes.ts'

interface AgentPageProps extends AgentViewProps {
  user?: { address: string }
  publicRoute?: boolean
}

export function AgentPage(handle: Handle<AgentPageProps>) {
  return () => {
    const { candles, segments, auction, regime, read, plan, asset, user, publicRoute } = handle.props

    return (
      <Document
        title="Selbo"
        currentPath="/agent"
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
        user={user}
        publicRoute={publicRoute}
      >
        <AgentView
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
