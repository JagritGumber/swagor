// Dashboard page — status left, equity+risk badges right
import type { Handle } from 'remix/ui'
import { Document } from '../../document.tsx'
import type { DashboardData } from './types.ts'
import {
  page,
  topBar,
  statusSection,
  statusDot,
  statusText,
  statusSub,
  badgesSection,
  equityBadge,
  equityLabel,
  equityValue,
  changePill,
  riskBadge,
  riskLabel,
  riskValue,
  pauseButton,
  content,
} from './style.ts'

interface DashboardPageProps {
  data: DashboardData
  user?: { address: string }
}

export function DashboardPage(handle: Handle<DashboardPageProps>) {
  return () => {
    const { data, user } = handle.props
    const isUp = data.change24hUsd >= 0
    const changeSign = isUp ? '+' : ''
    const changeStr = `${changeSign}$${Math.abs(data.change24hUsd).toFixed(2)} (${isUp ? '+' : ''}${data.change24hPct.toFixed(1)}%)`

    return (
    <Document
      title="Selbo - Dashboard"
      user={user}
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
    >
      <div mix={page}>
        <div mix={topBar}>
          {/* Left: Status */}
          <div mix={statusSection}>
            <div mix={statusDot} />
            <div>
              <div mix={statusText}>{data.statusMessage}</div>
              <div mix={statusSub}>{data.statusSubtext}</div>
            </div>
          </div>

          {/* Right: Badges */}
          <div mix={badgesSection}>
            {/* Equity Badge */}
            <div mix={equityBadge}>
              <div mix={equityLabel}>Total Equity</div>
              <div mix={{ display: 'flex', alignItems: 'baseline', gap: '8px' } as any}>
                <div mix={equityValue}>${data.balanceUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                <div mix={changePill(isUp)}>{changeStr}</div>
              </div>
            </div>

            {/* Risk Badge */}
            <div mix={riskBadge}>
              <div mix={riskLabel}>Risk Level</div>
              <div mix={riskValue(data.riskLevel)}>{data.riskLevel}</div>
            </div>
          </div>

          {/* Pause Button */}
          <button mix={pauseButton} type="button">Pause</button>
        </div>

        <div mix={content} />
      </div>
    </Document>
  )
  }
}
