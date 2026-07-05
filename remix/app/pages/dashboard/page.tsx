// Dashboard page — flex row: status | divider | data sections
import type { Handle } from 'remix/ui'
import { Document } from '../../document.tsx'
import type { DashboardData } from './types.ts'
import {
  page,
  topBar,
  statusSection,
  statusText,
  statusSub,
  divider,
  dataSection,
  dataBlock,
  dataBlockDivider,
  dataLabel,
  dataValue,
  riskValue,
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
          {/* Status */}
          <div mix={statusSection}>
            <div mix={statusText}>{data.statusMessage}</div>
            <div mix={statusSub}>{data.statusSubtext}</div>
          </div>

          {/* Vertical Divider */}
          <div mix={divider} />

          {/* Data Sections */}
          <div mix={dataSection}>
            <div mix={dataBlock}>
              <div mix={dataLabel}>Total Equity</div>
              <div mix={dataValue}>${data.balanceUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
            </div>

            <div mix={dataBlockDivider} />

            <div mix={dataBlock}>
              <div mix={dataLabel}>Risk</div>
              <div mix={riskValue(data.riskLevel)}>{data.riskLevel}</div>
            </div>
          </div>
        </div>

        <div mix={content} />
      </div>
    </Document>
  )
  }
}
