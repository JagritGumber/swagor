// Dashboard page — single top bar: status · equity+24h · risk · pause
import type { Handle } from 'remix/ui'
import { Document } from '../../document.tsx'
import type { DashboardData } from './types.ts'
import {
  page,
  topBar,
  section,
  sectionCol,
  divider,
  dot,
  statusText,
  statusSub,
  equityValue,
  equityLabel,
  changePill,
  riskColors,
  riskText,
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
          {/* Status */}
          <div mix={section}>
            <span mix={dot} />
            <div mix={sectionCol}>
              <span mix={statusText}>{data.statusMessage}</span>
              <span mix={statusSub}>{data.statusSubtext}</span>
            </div>
          </div>

          <div mix={divider} />

          <div mix={section}>
            <div mix={{ display: 'flex', flexDirection: 'column', gap: '2px' } as any}>
              <div mix={{ display: 'flex', alignItems: 'baseline', gap: '8px' } as any}>
                <span mix={equityValue}>${data.balanceUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                <span mix={changePill(isUp)}>{changeStr}</span>
              </div>
              <span mix={equityLabel}>Total Equity</span>
            </div>
          </div>

          <div mix={divider} />

          <div mix={section}>
            <span mix={riskText}>
              Risk: <span mix={{ color: riskColors[data.riskLevel], fontWeight: 500 } as any}>{data.riskLevel}</span>
            </span>
          </div>

          <button mix={pauseButton} type="button">Pause Trading</button>
        </div>

        <div mix={content} />
      </div>
    </Document>
  )
  }
}
