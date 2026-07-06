// Dashboard page — full layout with market read, positions, activity
import type { Handle } from 'remix/ui'
import { Document } from '../../document.tsx'
import { Tooltip } from '../../components/tooltip.tsx'
import { BalanceDisplay } from '../../assets/balance-display.tsx'
import { WalletAddress } from '../../assets/wallet-address.tsx'
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
  labelRow,
  riskValue,
  metricsRow,
  metricBlock,
  metricLabel,
  metricValue,
  metricValueGreen,
  metricValueRed,
  activityRow,
  leftPanel,
  centerPanel,
  activityPanel,
  panelHeader,
  panelTitle,
  panelContent,
  readRow,
  readLabel,
  readValue,
  positionRow,
  positionMarket,
  positionSide,
  positionPnl,
  activityHeader,
  activityTitle,
  activityList,
  activityItem,
  activityTime,
  activityDot,
  activityText,
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
    const dailyUp = data.dailyAvgPnl >= 0
    const totalUp = data.totalPnl >= 0
    const ddColor = data.maxDrawdown < 5 ? '#00d4ff' : data.maxDrawdown < 10 ? '#f59e0b' : '#ff5050'

    return (
    <Document
      title="Selbo - Dashboard"
      user={user}
      currentPath="/dashboard"
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
            <div mix={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '2px' } as any}>
              <div mix={statusText}>{data.statusMessage}</div>
            </div>
            <div mix={statusSub}>{data.statusSubtext}</div>
          </div>

          <div mix={equityBlock}>
            <div mix={labelRow}>
              <div mix={dataLabel}>Wallet Balance</div>
              <Tooltip content="This is the wallet balance of Selbo" />
            </div>
            <div mix={dataValue}>
              <BalanceDisplay initialBalance={data.balanceUsd} />
            </div>
            <WalletAddress address={data.walletAddress} />
          </div>

          <div mix={riskBlock}>
            <div mix={labelRow}>
              <div mix={dataLabel}>Risk</div>
              <Tooltip content="Current risk exposure level based on open positions" />
            </div>
            <div mix={riskValue(data.riskLevel)}>{data.riskLevel}</div>
          </div>

          <div mix={emptyBlock}>
            <div mix={labelRow}>
              <span mix={tradingLabel}>Trading</span>
              <Tooltip content="Toggle automated trading on or off" />
            </div>
            <button mix={toggleButton(isActive)} type="button">
              <span mix={toggleKnob(isActive)} />
            </button>
          </div>
        </div>

        <div mix={metricsRow}>
          <div mix={metricBlock}>
            <div mix={labelRow}>
              <div mix={metricLabel}>Daily Avg P&L</div>
              <Tooltip content="Average daily profit or loss over the active period" />
            </div>
            <div mix={dailyUp ? metricValueGreen : metricValueRed}>{dailyUp ? '+' : ''}${data.dailyAvgPnl.toFixed(2)}</div>
          </div>
          <div mix={metricBlock}>
            <div mix={labelRow}>
              <div mix={metricLabel}>Total P&L</div>
              <Tooltip content="Cumulative profit or loss since activation" />
            </div>
            <div mix={totalUp ? metricValueGreen : metricValueRed}>{totalUp ? '+' : ''}${data.totalPnl.toFixed(2)}</div>
          </div>
          <div mix={metricBlock}>
            <div mix={labelRow}>
              <div mix={metricLabel}>Sharpe Ratio</div>
              <Tooltip content="Risk-adjusted return measure (higher is better)" />
            </div>
            <div mix={metricValue}>{data.sharpeRatio.toFixed(2)}</div>
          </div>
          <div mix={metricBlock}>
            <div mix={labelRow}>
              <div mix={metricLabel}>Win Rate</div>
              <Tooltip content="Percentage of closed trades that were profitable" />
            </div>
            <div mix={metricValue}>{data.winRate.toFixed(1)}%</div>
          </div>
          <div mix={metricBlock}>
            <div mix={labelRow}>
              <div mix={metricLabel}>Total Trades</div>
              <Tooltip content="Total number of trades executed since activation" />
            </div>
            <div mix={metricValue}>{data.totalTrades}</div>
          </div>
          <div mix={metricBlock}>
            <div mix={labelRow}>
              <div mix={metricLabel}>Max Drawdown</div>
              <Tooltip content="Largest peak-to-trough decline in equity" />
            </div>
            <div mix={{ fontSize: '18px', fontWeight: 600, color: ddColor, fontFamily: "'Inter', system-ui, sans-serif" } as any}>{data.maxDrawdown.toFixed(1)}%</div>
          </div>
        </div>

        <div mix={activityRow}>
          {/* Market Read */}
          <div mix={leftPanel}>
            <div mix={panelHeader}>
              <div mix={panelTitle}>Market Read</div>
            </div>
            <div mix={panelContent}>
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
          </div>

          {/* Active Positions */}
          <div mix={centerPanel}>
            <div mix={panelHeader}>
              <div mix={panelTitle}>Active Positions</div>
            </div>
            <div mix={panelContent}>
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

          {/* Live Activity */}
          <div mix={activityPanel}>
            <div mix={activityHeader}>
              <div mix={activityTitle}>Live Activity</div>
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
        </div>

        <div mix={activityRow}>
          <div mix={leftPanel}>
            <div mix={panelHeader}>
              <div mix={panelTitle}>Portfolio Performance</div>
            </div>
            <div mix={panelContent}>
              <div mix={readRow}>
                <span mix={readLabel}>Total Return</span>
                <span mix={readValue}>{data.portfolioPerformance.totalReturn}</span>
              </div>
              <div mix={readRow}>
                <span mix={readLabel}>Monthly Return</span>
                <span mix={readValue}>{data.portfolioPerformance.monthlyReturn}</span>
              </div>
              <div mix={readRow}>
                <span mix={readLabel}>Sharpe Ratio</span>
                <span mix={readValue}>{data.portfolioPerformance.sharpeRatio}</span>
              </div>
              <div mix={readRow}>
                <span mix={readLabel}>Sortino Ratio</span>
                <span mix={readValue}>{data.portfolioPerformance.sortinoRatio}</span>
              </div>
              <div mix={readRow}>
                <span mix={readLabel}>Max Drawdown</span>
                <span mix={readValue}>{data.portfolioPerformance.maxDrawdown}</span>
              </div>
              <div mix={readRow}>
                <span mix={readLabel}>Calmar Ratio</span>
                <span mix={readValue}>{data.portfolioPerformance.calmarRatio}</span>
              </div>
            </div>
          </div>

          <div mix={centerPanel}></div>

          <div mix={activityPanel}></div>
        </div>

        <div mix={content} />
      </div>
    </Document>
  )
  }
}
