import type { ReactNode } from 'react'
import { Tooltip } from '@/components/composables/tooltip'
import { WalletAddress } from '@/components/wallet'
import { BalanceDisplay } from './balance-display'
import type { ActivityEntry, DashboardData, RiskLevel } from './types'

const riskColors: Record<RiskLevel, string> = {
  low: 'text-[#00d4ff]',
  medium: 'text-[#f59e0b]',
  high: 'text-[#ff5050]',
}

const activityDotClass: Record<ActivityEntry['type'], string> = {
  success: 'bg-[#00d4ff]',
  warning: 'bg-[#f59e0b]',
  action: 'bg-[#00d4ff]',
  info: 'bg-[#6b7280]',
}

const border = 'border-white/10'
const label =
  'text-[11px] font-medium uppercase tracking-[0.08em] text-[#94a3b8] font-ui'
const value = 'text-xl font-semibold text-[#f1f5f9] font-ui'
const metricValue = 'text-lg font-semibold text-[#f1f5f9] font-ui'
const panelTitle =
  'px-6 text-[13px] font-semibold uppercase tracking-[0.06em] text-[#f1f5f9] font-ui'

export interface DashboardPageProps {
  data: DashboardData
}

export function DashboardPage({ data }: DashboardPageProps) {
  const isActive = data.agentStatus === 'active'
  const dailyUp = data.dailyAvgPnl >= 0
  const totalUp = data.totalPnl >= 0
  const ddColor =
    data.maxDrawdown < 5
      ? 'text-[#00d4ff]'
      : data.maxDrawdown < 10
        ? 'text-[#f59e0b]'
        : 'text-[#ff5050]'

  return (
    <div className="flex flex-1 flex-col bg-surface-body font-ui text-white">
      {/* Top bar */}
      <div className={`grid grid-cols-[3fr_1fr_1fr_1fr] border-b ${border}`}>
        <div className={`border-r px-6 py-5 ${border}`}>
          <div className="mb-0.5 flex items-center gap-3">
            <div className={value}>{data.statusMessage}</div>
          </div>
          <div className="text-[13px] font-normal text-[#94a3b8]">{data.statusSubtext}</div>
        </div>

        <div className={`border-r px-6 py-5 ${border}`}>
          <div className="mb-0.5 flex items-center gap-1.5 leading-[18px]">
            <div className={label}>Wallet Balance</div>
            <Tooltip content="This is the wallet balance of Selbo" />
          </div>
          <div className={value}>
            <BalanceDisplay initialBalance={data.balanceUsd} />
          </div>
          {data.walletAddress ? <WalletAddress address={data.walletAddress} /> : null}
        </div>

        <div className={`border-r px-6 py-5 ${border}`}>
          <div className="mb-0.5 flex items-center gap-1.5 leading-[18px]">
            <div className={label}>Risk</div>
            <Tooltip content="Current risk exposure level based on open positions" />
          </div>
          <div className={`text-xl font-semibold capitalize font-ui ${riskColors[data.riskLevel]}`}>
            {data.riskLevel}
          </div>
        </div>

        <div className="flex flex-col items-start justify-center gap-2 px-6 py-5">
          <div className="mb-0.5 flex items-center gap-1.5 leading-[18px]">
            <span className={label}>Trading</span>
            <Tooltip content="Toggle automated trading on or off" />
          </div>
          <button
            type="button"
            aria-label={isActive ? 'Trading active' : 'Trading inactive'}
            className={[
              'relative h-6 w-11 cursor-pointer appearance-none rounded-full border transition-[background-color,border-color] duration-200',
              isActive
                ? 'border-[rgba(0,212,255,0.3)] bg-[rgba(0,212,255,0.10)]'
                : 'border-white/10 bg-white/5',
            ].join(' ')}
          >
            <span
              className={[
                'absolute top-[3px] h-4 w-4 rounded-full transition-[left,background-color] duration-200',
                isActive ? 'left-[23px] bg-[#00d4ff]' : 'left-[3px] bg-[#6b7280]',
              ].join(' ')}
            />
          </button>
        </div>
      </div>

      {/* Metrics */}
      <div className={`grid grid-cols-6 border-b ${border}`}>
        <Metric
          label="Daily Avg P&L"
          tip="Average daily profit or loss over the active period"
          valueClass={dailyUp ? 'text-[#00d4ff]' : 'text-[#ff5050]'}
        >
          {dailyUp ? '+' : ''}${data.dailyAvgPnl.toFixed(2)}
        </Metric>
        <Metric
          label="Total P&L"
          tip="Cumulative profit or loss since activation"
          valueClass={totalUp ? 'text-[#00d4ff]' : 'text-[#ff5050]'}
        >
          {totalUp ? '+' : ''}${data.totalPnl.toFixed(2)}
        </Metric>
        <Metric label="Sharpe Ratio" tip="Risk-adjusted return measure (higher is better)">
          {data.sharpeRatio.toFixed(2)}
        </Metric>
        <Metric label="Win Rate" tip="Percentage of closed trades that were profitable">
          {data.winRate.toFixed(1)}%
        </Metric>
        <Metric label="Total Trades" tip="Total number of trades executed since activation">
          {data.totalTrades}
        </Metric>
        <Metric
          label="Max Drawdown"
          tip="Largest peak-to-trough decline in equity"
          valueClass={ddColor}
          last
        >
          {data.maxDrawdown.toFixed(1)}%
        </Metric>
      </div>

      {/* Market read / positions / activity */}
      <div className={`grid min-h-[300px] grid-cols-3 border-b ${border}`}>
        <section className={`flex flex-col border-r ${border}`}>
          <header className={`border-b py-4 ${border}`}>
            <div className={panelTitle}>Market Read</div>
          </header>
          <div className="flex-1 overflow-auto py-4">
            <ReadRow label="Asset" value={data.marketRead.asset} />
            <ReadRow label="Regime" value={data.marketRead.regime} />
            <ReadRow label="Bias" value={data.marketRead.bias} />
            <ReadRow label="Narrative" value={data.marketRead.narrative} />
          </div>
        </section>

        <section className={`flex flex-col border-r ${border}`}>
          <header className={`border-b py-4 ${border}`}>
            <div className={panelTitle}>Active Positions</div>
          </header>
          <div className="flex-1 overflow-auto py-4">
            {data.positions.map((pos, i) => (
              <div
                key={`${pos.market}-${i}`}
                className="flex items-center justify-between border-b border-white/[0.04] px-6 py-2.5 last:border-b-0"
              >
                <div>
                  <div className="text-[13px] font-semibold text-[#f1f5f9]">{pos.market}</div>
                  <div
                    className={[
                      'text-[11px] font-semibold uppercase font-ui',
                      pos.side === 'long' ? 'text-[#00d4ff]' : 'text-[#ff5050]',
                    ].join(' ')}
                  >
                    {pos.side} · {pos.size} · {pos.leverage}
                  </div>
                </div>
                <div
                  className={[
                    'text-[13px] font-semibold font-ui',
                    pos.pnl >= 0 ? 'text-[#00d4ff]' : 'text-[#ff5050]',
                  ].join(' ')}
                >
                  {pos.pnl >= 0 ? '+' : ''}${pos.pnl.toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="flex flex-col">
          <header className={`border-b py-4 ${border}`}>
            <div className={panelTitle}>Live Activity</div>
          </header>
          <div className="flex-1 overflow-auto">
            {data.activity.map((entry, i) => (
              <div
                key={`${entry.time}-${i}`}
                className="flex gap-3 border-b border-white/[0.04] px-6 py-2.5 last:border-b-0"
              >
                <span className="min-w-[50px] whitespace-nowrap font-data text-[11px] font-medium text-[#6b7280]">
                  {entry.time}
                </span>
                <span
                  className={`mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full ${activityDotClass[entry.type]}`}
                />
                <span className="text-[13px] font-normal leading-snug text-[#d1d5db]">
                  {entry.text}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Portfolio performance */}
      <div className={`grid min-h-[300px] grid-cols-3 border-b ${border}`}>
        <section className={`flex flex-col border-r ${border}`}>
          <header className={`border-b py-4 ${border}`}>
            <div className={panelTitle}>Portfolio Performance</div>
          </header>
          <div className="flex-1 overflow-auto py-4">
            <ReadRow label="Total Return" value={data.portfolioPerformance.totalReturn} />
            <ReadRow label="Monthly Return" value={data.portfolioPerformance.monthlyReturn} />
            <ReadRow label="Sharpe Ratio" value={data.portfolioPerformance.sharpeRatio} />
            <ReadRow label="Sortino Ratio" value={data.portfolioPerformance.sortinoRatio} />
            <ReadRow label="Max Drawdown" value={data.portfolioPerformance.maxDrawdown} />
            <ReadRow label="Calmar Ratio" value={data.portfolioPerformance.calmarRatio} />
          </div>
        </section>
        <section className={`border-r ${border}`} />
        <section />
      </div>

      <div className="flex-1 overflow-auto" />
    </div>
  )
}

function Metric({
  label: metricLabel,
  tip,
  children,
  valueClass,
  last = false,
}: {
  label: string
  tip: string
  children: ReactNode
  valueClass?: string
  last?: boolean
}) {
  return (
    <div className={`px-5 py-4 ${last ? '' : `border-r ${border}`}`}>
      <div className="mb-0.5 flex items-center gap-1.5 leading-[18px]">
        <div className={label}>{metricLabel}</div>
        <Tooltip content={tip} />
      </div>
      <div className={`${metricValue} ${valueClass ?? ''}`}>{children}</div>
    </div>
  )
}

function ReadRow({ label: rowLabel, value: rowValue }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-white/[0.04] px-6 py-2 last:border-b-0">
      <span className="text-xs font-medium text-[#94a3b8]">{rowLabel}</span>
      <span className="text-xs font-medium text-[#f1f5f9]">{rowValue}</span>
    </div>
  )
}
