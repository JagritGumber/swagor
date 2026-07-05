// Dashboard page — compact: status left, equity+change+risk right
import type { Handle } from 'remix/ui'
import { Document } from '../../document.tsx'
import type { DashboardData } from './types.ts'
import {
  page,
  topBar,
  statusSection,
  statusText,
  statusSub,
  rightSection,
  equityRow,
  equityValue,
  changePill,
  riskColors,
  riskValue,
  riskLabel,
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
            href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          />
        </>
      }
    >
      <div mix={page}>
        <div mix={topBar}>
          {/* Left: Status */}
          <div mix={statusSection}>
            <div mix={statusText}>{data.statusMessage}</div>
            <div mix={statusSub}>{data.statusSubtext}</div>
          </div>

          {/* Right: Equity + Change + Risk */}
          <div mix={rightSection}>
            <div mix={equityRow}>
              <span mix={equityValue}>${data.balanceUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
              <span mix={changePill(isUp)}>{changeStr}</span>
            </div>
            <div>
              <span mix={riskLabel}>Risk:</span>
              <span mix={riskValue(data.riskLevel)}>{data.riskLevel}</span>
            </div>
          </div>
        </div>

        <div mix={content} />
      </div>
    </Document>
  )
  }
}
