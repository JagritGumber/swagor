// Dashboard-2 page — hero, mixed grids, visual hierarchy
import type { Handle } from 'remix/ui'
import { Document } from '../../document.tsx'
import type { DashboardData } from './types.ts'
import {
  page,
  hero,
  heroLeft,
  heroStatus,
  heroSub,
  heroRight,
  equityGroup,
  equityLabel,
  equityValue,
  equityChange,
  heroMeta,
  riskBadge,
  tradingToggle,
  toggleButton,
  toggleKnob,
  divider,
  metricsGrid,
  metricCell,
  metricLabel,
  metricValue,
  metricValueGreen,
  metricValueRed,
  twoPanelRow,
  panelHalf,
  panelTitle,
  readRow,
  readLabel,
  readValue,
  positionRow,
  positionMarket,
  positionSide,
  positionPnl,
  fullSection,
  sectionHeader,
  sectionTitle,
  activityList,
  activityItem,
  activityTime,
  activityDot,
  activityText,
  perfGrid,
  perfCell,
  perfLabel,
  perfValue,
  content,
} from './style.ts'
import type { ActivityEntry } from './types.ts'

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
        {/* Hero — status + equity + risk + toggle */}
        <div mix={hero}>
          <div mix={heroLeft}>
            <div mix={heroStatus}>{data.statusMessage}</div>
            <div mix={heroSub}>{data.statusSubtext}</div>
          </div>
          <div mix={heroRight}>
            <div mix={equityGroup}>
              <div mix={equityLabel}>Total Equity</div>
              <div mix={equityValue}>${data.balanceUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
              <div mix={equityChange(changeUp)}>{changeSign}${Math.abs(data.change24hUsd).toFixed(2)} (24h)</div>
            </div>
            <div mix={heroMeta}>
              <span mix={riskBadge(data.riskLevel)}>Risk: {data.riskLevel}</span>
              <div mix={tradingToggle}>
                <span>Trading</span>
                <button mix={toggleButton(isActive)} type="button">
                  <span mix={toggleKnob(isActive)} />
                </button>
              </div>
            </div>
          </div>
        </div>

        <div mix={divider} />

        {/* Metrics — 3x2 grid, no cards */}
        <div mix={metricsGrid}>
          <div mix={metricCell}>
            <div mix={metricLabel}>Daily Avg P&L</div>
            <div mix={dailyUp ? metricValueGreen : metricValueRed}>{dailyUp ? '+' : ''}${data.dailyAvgPnl.toFixed(2)}</div>
          </div>
          <div mix={metricCell}>
            <div mix={metricLabel}>Total P&L</div>
            <div mix={totalUp ? metricValueGreen : metricValueRed}>{totalUp ? '+' : ''}${data.totalPnl.toFixed(2)}</div>
          </div>
          <div mix={metricCell}>
            <div mix={metricLabel}>Sharpe Ratio</div>
            <div mix={metricValue}>{data.sharpeRatio.toFixed(2)}</div>
          </div>
          <div mix={metricCell}>
            <div mix={metricLabel}>Win Rate</div>
            <div mix={metricValue}>{data.winRate.toFixed(1)}%</div>
          </div>
          <div mix={metricCell}>
            <div mix={metricLabel}>Total Trades</div>
            <div mix={metricValue}>{data.totalTrades}</div>
          </div>
          <div mix={metricCell}>
            <div mix={metricLabel}>Max Drawdown</div>
            <div mix={{ fontSize: '20px', fontWeight: 600, color: ddColor, fontFamily: "'Inter', system-ui, sans-serif" } as any}>{data.maxDrawdown.toFixed(1)}%</div>
          </div>
        </div>

        <div mix={divider} />

        {/* Two panels — Market Read + Positions */}
        <div mix={twoPanelRow}>
          <div mix={panelHalf}>
            <div mix={panelTitle}>Market Read</div>
            <div mix={readRow}>
              <span mix={readLabel}>Asset</span>
              <span mix={readValue}>{data.marketRead.asset}</span>
            </div>
            <div mix={readRow}>
              <span mix={readLabel}>Regime</span>
              <span mix={readValue}>{data.marketRead.regime}</span>
            </div>
            <div mix={readRow}>
              <span mix={readLabel}>Bias</span>
              <span mix={readValue}>{data.marketRead.bias}</span>
            </div>
            <div mix={readRow}>
              <span mix={readLabel}>Narrative</span>
              <span mix={readValue}>{data.marketRead.narrative}</span>
            </div>
          </div>
          <div mix={panelHalf}>
            <div mix={panelTitle}>Active Positions</div>
            {data.positions.map((pos, i: number) => (
              <div key={String(i)} mix={positionRow}>
                <div>
                  <div mix={positionMarket}>{pos.market}</div>
                  <div mix={positionSide(pos.side)}>{pos.side} · {pos.size} · {pos.leverage}</div>
                </div>
                <div mix={positionPnl(pos.pnl >= 0)}>
                  {pos.pnl >= 0 ? '+' : ''}${pos.pnl.toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div mix={divider} />

        {/* Portfolio Performance — full width */}
        <div mix={fullSection}>
          <div mix={sectionHeader}>
            <div mix={sectionTitle}>Portfolio Performance</div>
          </div>
          <div mix={perfGrid}>
            <div mix={perfCell}>
              <div mix={perfLabel}>Total Return</div>
              <div mix={perfValue}>{data.portfolioPerformance.totalReturn}</div>
            </div>
            <div mix={perfCell}>
              <div mix={perfLabel}>Monthly Return</div>
              <div mix={perfValue}>{data.portfolioPerformance.monthlyReturn}</div>
            </div>
            <div mix={perfCell}>
              <div mix={perfLabel}>Sharpe Ratio</div>
              <div mix={perfValue}>{data.portfolioPerformance.sharpeRatio}</div>
            </div>
            <div mix={perfCell}>
              <div mix={perfLabel}>Sortino Ratio</div>
              <div mix={perfValue}>{data.portfolioPerformance.sortinoRatio}</div>
            </div>
            <div mix={perfCell}>
              <div mix={perfLabel}>Max Drawdown</div>
              <div mix={perfValue}>{data.portfolioPerformance.maxDrawdown}</div>
            </div>
            <div mix={perfCell}>
              <div mix={perfLabel}>Calmar Ratio</div>
              <div mix={perfValue}>{data.portfolioPerformance.calmarRatio}</div>
            </div>
          </div>
        </div>

        <div mix={divider} />

        {/* Live Activity — full width */}
        <div mix={fullSection}>
          <div mix={sectionHeader}>
            <div mix={sectionTitle}>Live Activity</div>
          </div>
          <div mix={activityList}>
            {data.activity.map((entry: ActivityEntry, i: number) => (
              <div key={String(i)} mix={activityItem}>
                <span mix={activityTime}>{entry.time}</span>
                <span mix={activityDot(entry.type)} />
                <span mix={activityText}>{entry.text}</span>
              </div>
            ))}
          </div>
        </div>

        <div mix={content} />
      </div>
    </Document>
  )
  }
}
