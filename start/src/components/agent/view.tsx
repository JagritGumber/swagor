import type { Candle } from '@shared/candle'
import type { OverlaySegment } from '@/components/chart/types'
import type { ReaderMarketRegimeMode } from '@packages/strategy-lab/read-core/market-regime/types'
import type { LiveReaderStance } from '@packages/strategy-lab/reader/reader-live/types'
import type { ReaderTradePlanStatus } from '@packages/strategy-lab/backtest/trade-plan/types'
import { AgentChartEntry } from './chart-entry'
import { regimeBadgeClass, stanceBadgeClass, stanceLabel, planStatusLabel } from './badge-maps'
import * as s from './style'

interface AgentAuction {
  location: string
  locationLabel: string
  bias: string
  narrative: string
  profile: {
    poc: number
    valueAreaLow: number
    valueAreaHigh: number
    bins: { low: number; high: number; volume: number }[]
  } | null
  level: {
    price: number
    kind: string
    touches: number
  } | null
}

interface AgentRegime {
  mode: ReaderMarketRegimeMode
  label: string
  rangePct: number
  driftPct: number
  directionalEfficiency: number
}

interface AgentReaderRead {
  stance: LiveReaderStance
  narrative: string
  invalidation: string | null
  target: string | null
  orderflow: {
    pressure: string
    delta: number
    tradeCount: number
    events: string[]
  }
}

interface AgentTradePlan {
  status: ReaderTradePlanStatus
  side?: string
  entryLow?: number
  entryHigh?: number
  stop?: number
  target?: number
  invalidation?: string
  confidence?: number
  reasons: string[]
}

export interface AgentViewProps {
  candles: Candle[]
  segments: OverlaySegment[]
  auction: AgentAuction | null
  regime: AgentRegime | null
  read?: AgentReaderRead | null
  plan?: AgentTradePlan | null
  asset: string
}

export function AgentView({
  candles,
  segments,
  auction,
  regime,
  read,
  plan,
  asset,
}: AgentViewProps) {
  const chartAuction = auction
    ? {
        profile: auction.profile
          ? {
              poc: auction.profile.poc,
              valueAreaLow: auction.profile.valueAreaLow,
              valueAreaHigh: auction.profile.valueAreaHigh,
            }
          : null,
      }
    : null

  const chartPlan =
    plan && plan.status !== 'no-trade'
      ? {
          status: plan.status,
          side: plan.side,
          entryLow: plan.entryLow,
          entryHigh: plan.entryHigh,
          stop: plan.stop,
          target: plan.target,
        }
      : null

  return (
    <div className={s.agentPage}>
      <div className={s.chartArea}>
        <AgentChartEntry
          candles={candles}
          segments={segments}
          asset={asset}
          interval="1h"
          auction={chartAuction}
          plan={chartPlan}
        />
        <div className={`${s.analysisPanel} ${s.analysisPanelOpen}`}>
          {regime ? (
            <div className={s.analysisSection}>
              <div className={s.analysisLabel}>Regime</div>
              <span className={`${s.regimeBadge} ${regimeBadgeClass[regime.mode]}`}>
                {regime.label}
              </span>
            </div>
          ) : null}
          {read ? (
            <div className={s.analysisSection}>
              <div className={s.analysisLabel}>Stance</div>
              <span className={`${s.stanceBadge} ${stanceBadgeClass[read.stance]}`}>
                {stanceLabel[read.stance]}
              </span>
            </div>
          ) : null}
          {auction ? (
            <>
              <div className={s.analysisSection}>
                <div className={s.analysisLabel}>Location</div>
                <div className={s.analysisValue}>{auction.locationLabel}</div>
              </div>
              <div className={s.analysisSection}>
                <div className={s.analysisLabel}>Bias</div>
                <div className={s.analysisValue}>{auction.bias}</div>
              </div>
              {auction.profile ? (
                <div className={s.analysisSection}>
                  <div className={s.analysisLabel}>Volume Profile</div>
                  <div className={`${s.analysisValue} font-data text-xs`}>
                    POC ${auction.profile.poc.toFixed(2)}
                  </div>
                  <div className={`${s.analysisValue} font-data text-xs`}>
                    VA ${auction.profile.valueAreaLow.toFixed(2)} - $
                    {auction.profile.valueAreaHigh.toFixed(2)}
                  </div>
                </div>
              ) : null}
            </>
          ) : null}
          {plan && plan.status !== 'no-trade' ? (
            <div className={s.analysisSection}>
              <div className={s.analysisLabel}>Trade Plan</div>
              <div className={s.planStatus}>
                <span
                  className={`${s.planBadge} ${plan.side === 'long' ? s.planLong : s.planShort}`}
                >
                  {plan.side?.toUpperCase()}
                </span>
                <span className={s.planStatusLabel}>{planStatusLabel[plan.status]}</span>
              </div>
              <div className={s.planLevels}>
                <div className={s.planLevel}>
                  <span className={s.planLevelLabel}>Entry</span>
                  <span className={s.planLevelValue}>
                    ${plan.entryLow?.toFixed(2)} - ${plan.entryHigh?.toFixed(2)}
                  </span>
                </div>
                <div className={s.planLevel}>
                  <span className={s.planLevelLabel}>Stop</span>
                  <span className={`${s.planLevelValue} ${s.planStop}`}>
                    ${plan.stop?.toFixed(2)}
                  </span>
                </div>
                <div className={s.planLevel}>
                  <span className={s.planLevelLabel}>Target</span>
                  <span className={`${s.planLevelValue} ${s.planTarget}`}>
                    ${plan.target?.toFixed(2)}
                  </span>
                </div>
              </div>
              {plan.confidence !== undefined ? (
                <div className={s.planConfidence}>
                  <span className={s.planConfidenceLabel}>Confidence</span>
                  <span className={s.planConfidenceValue}>{plan.confidence}%</span>
                </div>
              ) : null}
            </div>
          ) : null}
          {read ? (
            <div className={s.analysisSection}>
              <div className={s.analysisLabel}>Orderflow</div>
              <div className={s.orderflowRow}>
                <span className={s.orderflowLabel}>Pressure</span>
                <span
                  className={[
                    s.orderflowValue,
                    read.orderflow.pressure === 'buy-pressure'
                      ? s.orderflowBuy
                      : read.orderflow.pressure === 'sell-pressure'
                        ? s.orderflowSell
                        : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  {read.orderflow.pressure}
                </span>
              </div>
              <div className={s.orderflowRow}>
                <span className={s.orderflowLabel}>Delta</span>
                <span
                  className={[
                    s.orderflowValue,
                    read.orderflow.delta > 0
                      ? s.orderflowBuy
                      : read.orderflow.delta < 0
                        ? s.orderflowSell
                        : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  {read.orderflow.delta.toFixed(4)}
                </span>
              </div>
              <div className={s.orderflowRow}>
                <span className={s.orderflowLabel}>Trades</span>
                <span className={s.orderflowValue}>{read.orderflow.tradeCount}</span>
              </div>
            </div>
          ) : null}
          {auction ? (
            <div className={s.analysisSection}>
              <div className={s.analysisLabel}>Narrative</div>
              <div className={s.analysisNarrative}>{auction.narrative}</div>
            </div>
          ) : null}
        </div>
      </div>
      <div className={s.bottomStrip}>
        <div className={s.tradeLogHeader}>
          <span>Time</span>
          <span>Side</span>
          <span>Entry</span>
          <span>Exit</span>
          <span>R</span>
          <span>Thesis</span>
        </div>
        <div className={s.tradeLogEmpty}>No trades yet - agent is observing</div>
      </div>
    </div>
  )
}
