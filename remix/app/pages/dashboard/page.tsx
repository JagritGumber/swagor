// Dashboard page — full layout with market read, positions, activity
import type { Handle } from 'remix/ui'
import { Document } from '@/document'
import { Tooltip } from '@/components/composables/tooltip'
import { BalanceDisplay } from '@/assets/balance-display'
import { WalletAddress } from '@/assets/wallet-address'
import type { DashboardData } from './types.ts'
import * as s from './style.ts'
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
      <div mix={s.page}>
        <div mix={s.topBar}>
          <div mix={s.statusSection}>
            <div mix={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '2px' } as any}>
              <div mix={s.statusText}>{data.statusMessage}</div>
            </div>
            <div mix={s.statusSub}>{data.statusSubtext}</div>
          </div>

          <div mix={s.equityBlock}>
            <div mix={s.labelRow}>
              <div mix={s.dataLabel}>Wallet Balance</div>
              <Tooltip content="This is the wallet balance of Selbo" />
            </div>
            <div mix={s.dataValue}>
              <BalanceDisplay initialBalance={data.balanceUsd} />
            </div>
            <WalletAddress address={data.walletAddress} />
          </div>

          <div mix={s.riskBlock}>
            <div mix={s.labelRow}>
              <div mix={s.dataLabel}>Risk</div>
              <Tooltip content="Current risk exposure level based on open positions" />
            </div>
            <div mix={s.riskValue(data.riskLevel)}>{data.riskLevel}</div>
          </div>

          <div mix={s.emptyBlock}>
            <div mix={s.labelRow}>
              <span mix={s.tradingLabel}>Trading</span>
              <Tooltip content="Toggle automated trading on or off" />
            </div>
            <button mix={s.toggleButton(isActive)} type="button">
              <span mix={s.toggleKnob(isActive)} />
            </button>
          </div>
        </div>

        <div mix={s.metricsRow}>
          <div mix={s.metricBlock}>
            <div mix={s.labelRow}>
              <div mix={s.metricLabel}>Daily Avg P&L</div>
              <Tooltip content="Average daily profit or loss over the active period" />
            </div>
            <div mix={dailyUp ? s.metricValueGreen : s.metricValueRed}>{dailyUp ? '+' : ''}${data.dailyAvgPnl.toFixed(2)}</div>
          </div>
          <div mix={s.metricBlock}>
            <div mix={s.labelRow}>
              <div mix={s.metricLabel}>Total P&L</div>
              <Tooltip content="Cumulative profit or loss since activation" />
            </div>
            <div mix={totalUp ? s.metricValueGreen : s.metricValueRed}>{totalUp ? '+' : ''}${data.totalPnl.toFixed(2)}</div>
          </div>
          <div mix={s.metricBlock}>
            <div mix={s.labelRow}>
              <div mix={s.metricLabel}>Sharpe Ratio</div>
              <Tooltip content="Risk-adjusted return measure (higher is better)" />
            </div>
            <div mix={s.metricValue}>{data.sharpeRatio.toFixed(2)}</div>
          </div>
          <div mix={s.metricBlock}>
            <div mix={s.labelRow}>
              <div mix={s.metricLabel}>Win Rate</div>
              <Tooltip content="Percentage of closed trades that were profitable" />
            </div>
            <div mix={s.metricValue}>{data.winRate.toFixed(1)}%</div>
          </div>
          <div mix={s.metricBlock}>
            <div mix={s.labelRow}>
              <div mix={s.metricLabel}>Total Trades</div>
              <Tooltip content="Total number of trades executed since activation" />
            </div>
            <div mix={s.metricValue}>{data.totalTrades}</div>
          </div>
          <div mix={s.metricBlock}>
            <div mix={s.labelRow}>
              <div mix={s.metricLabel}>Max Drawdown</div>
              <Tooltip content="Largest peak-to-trough decline in equity" />
            </div>
            <div mix={{ fontSize: '18px', fontWeight: 600, color: ddColor, fontFamily: "'Inter', system-ui, sans-serif" } as any}>{data.maxDrawdown.toFixed(1)}%</div>
          </div>
        </div>

        <div mix={s.activityRow}>
          {/* Market Read */}
          <div mix={s.leftPanel}>
            <div mix={s.panelHeader}>
              <div mix={s.panelTitle}>Market Read</div>
            </div>
            <div mix={s.panelContent}>
              <div mix={s.readRow}>
                <span mix={s.readLabel}>Asset</span>
                <span mix={s.readValue}>{data.marketRead.asset}</span>
              </div>
              <div mix={s.readRow}>
                <span mix={s.readLabel}>Regime</span>
                <span mix={s.readValue}>{data.marketRead.regime}</span>
              </div>
              <div mix={s.readRow}>
                <span mix={s.readLabel}>Bias</span>
                <span mix={s.readValue}>{data.marketRead.bias}</span>
              </div>
              <div mix={s.readRow}>
                <span mix={s.readLabel}>Narrative</span>
                <span mix={s.readValue}>{data.marketRead.narrative}</span>
              </div>
            </div>
          </div>

          {/* Active Positions */}
          <div mix={s.centerPanel}>
            <div mix={s.panelHeader}>
              <div mix={s.panelTitle}>Active Positions</div>
            </div>
            <div mix={s.panelContent}>
              {data.positions.map((pos, i: number) => (
                <div key={String(i)} mix={s.positionRow}>
                  <div>
                    <div mix={s.positionMarket}>{pos.market}</div>
                    <div mix={s.positionSide(pos.side)}>{pos.side} · {pos.size} · {pos.leverage}</div>
                  </div>
                  <div mix={s.positionPnl(pos.pnl >= 0)}>
                    {pos.pnl >= 0 ? '+' : ''}${pos.pnl.toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Live Activity */}
          <div mix={s.activityPanel}>
            <div mix={s.activityHeader}>
              <div mix={s.activityTitle}>Live Activity</div>
            </div>
            <div mix={s.activityList}>
              {data.activity.map((entry: ActivityEntry, i: number) => (
                <div key={String(i)} mix={s.activityItem}>
                  <span mix={s.activityTime}>{entry.time}</span>
                  <span mix={s.activityDot(entry.type)} />
                  <span mix={s.activityText}>{entry.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div mix={s.activityRow}>
          <div mix={s.leftPanel}>
            <div mix={s.panelHeader}>
              <div mix={s.panelTitle}>Portfolio Performance</div>
            </div>
            <div mix={s.panelContent}>
              <div mix={s.readRow}>
                <span mix={s.readLabel}>Total Return</span>
                <span mix={s.readValue}>{data.portfolioPerformance.totalReturn}</span>
              </div>
              <div mix={s.readRow}>
                <span mix={s.readLabel}>Monthly Return</span>
                <span mix={s.readValue}>{data.portfolioPerformance.monthlyReturn}</span>
              </div>
              <div mix={s.readRow}>
                <span mix={s.readLabel}>Sharpe Ratio</span>
                <span mix={s.readValue}>{data.portfolioPerformance.sharpeRatio}</span>
              </div>
              <div mix={s.readRow}>
                <span mix={s.readLabel}>Sortino Ratio</span>
                <span mix={s.readValue}>{data.portfolioPerformance.sortinoRatio}</span>
              </div>
              <div mix={s.readRow}>
                <span mix={s.readLabel}>Max Drawdown</span>
                <span mix={s.readValue}>{data.portfolioPerformance.maxDrawdown}</span>
              </div>
              <div mix={s.readRow}>
                <span mix={s.readLabel}>Calmar Ratio</span>
                <span mix={s.readValue}>{data.portfolioPerformance.calmarRatio}</span>
              </div>
            </div>
          </div>

          <div mix={s.centerPanel}></div>

          <div mix={s.activityPanel}></div>
        </div>

        <div mix={s.content} />
      </div>
    </Document>
  )
  }
}
