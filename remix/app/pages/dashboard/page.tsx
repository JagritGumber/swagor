// Dashboard page — 6fr 2fr 2fr 2fr grid + metrics row
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
  tradingLabel,
  toggleButton,
  toggleKnob,
  dataLabel,
  dataValue,
  changeText,
  riskValue,
  metricsRow,
  metricBlock,
  metricLabel,
  metricValue,
  metricValueGreen,
  metricValueRed,
  content,
} from './style.ts'

interface DashboardPageProps {
  data: DashboardData
  user?: { address: string }
}

export function DashboardPage(handle: Handle<DashboardPageProps>) {
  return () => {
    const { data, user } = handle.props
    const isActive = data.agentStatus === 'active'
    const changeUp = data.change24hUsd >= 0
    const changeSign = changeUp ? '+' : ''
    const dailyUp = data.dailyAvgPnl >= 0
    const totalUp = data.totalPnl >= 0
    const ddColor = data.maxDrawdown < 5 ? '#00ff85' : data.maxDrawdown < 10 ? '#f59e0b' : '#ff5050'

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
            <div mix={changeText(changeUp)}>{changeSign}${Math.abs(data.change24hUsd).toFixed(2)} (24h)</div>
          </div>

          <div mix={riskBlock}>
            <div mix={dataLabel}>Risk</div>
            <div mix={riskValue(data.riskLevel)}>{data.riskLevel}</div>
          </div>

          <div mix={emptyBlock}>
            <span mix={tradingLabel}>Trading</span>
            <button mix={toggleButton(isActive)} type="button">
              <span mix={toggleKnob(isActive)} />
            </button>
          </div>
        </div>

        <div mix={metricsRow}>
          <div mix={metricBlock}>
            <div mix={metricLabel}>Daily Avg P&L</div>
            <div mix={dailyUp ? metricValueGreen : metricValueRed}>{dailyUp ? '+' : ''}${data.dailyAvgPnl.toFixed(2)}</div>
          </div>
          <div mix={metricBlock}>
            <div mix={metricLabel}>Total P&L</div>
            <div mix={totalUp ? metricValueGreen : metricValueRed}>{totalUp ? '+' : ''}${data.totalPnl.toFixed(2)}</div>
          </div>
          <div mix={metricBlock}>
            <div mix={metricLabel}>Sharpe Ratio</div>
            <div mix={metricValue}>{data.sharpeRatio.toFixed(2)}</div>
          </div>
          <div mix={metricBlock}>
            <div mix={metricLabel}>Win Rate</div>
            <div mix={metricValue}>{data.winRate.toFixed(1)}%</div>
          </div>
          <div mix={metricBlock}>
            <div mix={metricLabel}>Total Trades</div>
            <div mix={metricValue}>{data.totalTrades}</div>
          </div>
          <div mix={metricBlock}>
            <div mix={metricLabel}>Max Drawdown</div>
            <div mix={{ fontSize: '18px', fontWeight: 600, color: ddColor, fontFamily: "'Inter', system-ui, sans-serif" } as any}>{data.maxDrawdown.toFixed(1)}%</div>
          </div>
        </div>

        <div mix={content} />
      </div>
    </Document>
  )
  }
}
