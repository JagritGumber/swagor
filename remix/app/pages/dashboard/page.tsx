// Dashboard page — 6fr 2fr 2fr 2fr grid with pause/stop buttons
import type { Handle } from 'remix/ui'
import { Document } from '../../document.tsx'
import type { DashboardData } from './types.ts'
import {
  page,
  topBar,
  statusSection,
  statusText,
  statusSub,
  equityBlock,
  riskBlock,
  emptyBlock,
  dataLabel,
  dataValue,
  riskValue,
  pauseButton,
  stopButton,
  content,
} from './style.ts'

interface DashboardPageProps {
  data: DashboardData
  user?: { address: string }
}

export function DashboardPage(handle: Handle<DashboardPageProps>) {
  return () => {
    const { data, user } = handle.props

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
          <div mix={statusSection}>
            <div mix={statusText}>{data.statusMessage}</div>
            <div mix={statusSub}>{data.statusSubtext}</div>
          </div>

          <div mix={equityBlock}>
            <div mix={dataLabel}>Total Equity</div>
            <div mix={dataValue}>${data.balanceUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
          </div>

          <div mix={riskBlock}>
            <div mix={dataLabel}>Risk</div>
            <div mix={riskValue(data.riskLevel)}>{data.riskLevel}</div>
          </div>

          <div mix={emptyBlock}>
            <button mix={pauseButton} type="button">Pause Trading</button>
            <button mix={stopButton} type="button">Stop Trading</button>
          </div>
        </div>

        <div mix={content} />
      </div>
    </Document>
  )
  }
}
