import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'
import { Document } from '../document.tsx'
import type { Candle } from '../types/candles.ts'
import type { OverlaySegment } from '../components/chart/types.ts'
import * as s from '../components/agent/style.ts'
import { routes } from '../routes.ts'

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
  mode: string
  label: string
  rangePct: number
  driftPct: number
  directionalEfficiency: number
}

interface AgentReaderRead {
  stance: string
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
  status: string
  side?: string
  entryLow?: number
  entryHigh?: number
  stop?: number
  target?: number
  invalidation?: string
  confidence?: number
  reasons: string[]
}

interface AgentPageProps {
  candles: Candle[]
  segments: OverlaySegment[]
  auction: AgentAuction | null
  regime: AgentRegime | null
  read: AgentReaderRead | null
  plan: AgentTradePlan | null
  asset: string
}

function regimeBadgeClass(mode: string): string {
  switch (mode) {
    case 'range': return s.regimeRange
    case 'trend-up': return s.regimeTrendUp
    case 'trend-down': return s.regimeTrendDown
    case 'high-vol': return s.regimeHighVol
    default: return s.regimeRange
  }
}

function stanceBadgeClass(stance: string): string {
  switch (stance) {
    case 'possible-long': return s.stancePossibleLong
    case 'possible-short': return s.stancePossibleShort
    case 'watch-long-confirmation': return s.stanceWatchLong
    case 'watch-short-confirmation': return s.stanceWatchShort
    case 'avoid-balanced-auction': return s.stanceAvoid
    default: return s.stanceWait
  }
}

function stanceLabel(stance: string): string {
  switch (stance) {
    case 'possible-long': return 'Possible Long'
    case 'possible-short': return 'Possible Short'
    case 'watch-long-confirmation': return 'Watch Long'
    case 'watch-short-confirmation': return 'Watch Short'
    case 'avoid-balanced-auction': return 'Avoid Balanced'
    case 'wait': return 'Wait'
    default: return stance
  }
}

function planStatusLabel(status: string): string {
  switch (status) {
    case 'ready': return 'Ready'
    case 'watch': return 'Watch'
    case 'ready-if-reclaim': return 'Ready if Reclaim'
    case 'no-trade': return 'No Trade'
    default: return status
  }
}

export function AgentPage(handle: Handle<AgentPageProps>) {
  return () => {
    const { candles, segments, auction, regime, read, plan, asset } = handle.props

    return (
      <Document
        title="Agent"
        head={
          <>
            <meta name="color-scheme" content="dark" />
            <link rel="preconnect" href="https://fonts.googleapis.com" />
            <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
            <link
              rel="stylesheet"
              href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap"
            />
            <link rel="stylesheet" href={routes.assets.href({ path: 'app/assets/chart.css' })} />
          </>
        }
      >
        <div mix={s.agentPage}>
          <div mix={s.chartArea}>
            <div
              id="agent-chart"
              style={{ width: '100%', height: '100%' }}
            />
            <div
              mix={s.analysisPanel}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                width: '280px',
                backgroundColor: 'rgba(10, 14, 20, 0.9)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                borderRadius: '8px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                zIndex: 5,
              }}
            >
              {regime && (
                <div mix={s.analysisSection}>
                  <div mix={s.analysisLabel}>Regime</div>
                  <span mix={[s.regimeBadge, regimeBadgeClass(regime.mode)]}>
                    {regime.label}
                  </span>
                </div>
              )}
              {read && (
                <div mix={s.analysisSection}>
                  <div mix={s.analysisLabel}>Stance</div>
                  <span mix={[s.stanceBadge, stanceBadgeClass(read.stance)]}>
                    {stanceLabel(read.stance)}
                  </span>
                </div>
              )}
              {auction && (
                <>
                  <div mix={s.analysisSection}>
                    <div mix={s.analysisLabel}>Location</div>
                    <div mix={s.analysisValue}>{auction.locationLabel}</div>
                  </div>
                  <div mix={s.analysisSection}>
                    <div mix={s.analysisLabel}>Bias</div>
                    <div mix={s.analysisValue}>{auction.bias}</div>
                  </div>
                  {auction.profile && (
                    <div mix={s.analysisSection}>
                      <div mix={s.analysisLabel}>Volume Profile</div>
                      <div mix={s.analysisValue} style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '12px' }}>
                        POC ${auction.profile.poc.toFixed(2)}
                      </div>
                      <div mix={s.analysisValue} style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '12px' }}>
                        VA ${auction.profile.valueAreaLow.toFixed(2)} - ${auction.profile.valueAreaHigh.toFixed(2)}
                      </div>
                    </div>
                  )}
                </>
              )}
              {plan && plan.status !== 'no-trade' && (
                <div mix={s.analysisSection}>
                  <div mix={s.analysisLabel}>Trade Plan</div>
                  <div mix={s.planStatus}>
                    <span mix={[s.planBadge, plan.side === 'long' ? s.planLong : s.planShort]}>
                      {plan.side?.toUpperCase()}
                    </span>
                    <span mix={s.planStatusLabel}>{planStatusLabel(plan.status)}</span>
                  </div>
                  <div mix={s.planLevels}>
                    <div mix={s.planLevel}>
                      <span mix={s.planLevelLabel}>Entry</span>
                      <span mix={s.planLevelValue}>${plan.entryLow?.toFixed(2)} - ${plan.entryHigh?.toFixed(2)}</span>
                    </div>
                    <div mix={s.planLevel}>
                      <span mix={s.planLevelLabel}>Stop</span>
                      <span mix={[s.planLevelValue, s.planStop]}>${plan.stop?.toFixed(2)}</span>
                    </div>
                    <div mix={s.planLevel}>
                      <span mix={s.planLevelLabel}>Target</span>
                      <span mix={[s.planLevelValue, s.planTarget]}>${plan.target?.toFixed(2)}</span>
                    </div>
                  </div>
                  {plan.confidence !== undefined && (
                    <div mix={s.planConfidence}>
                      <span mix={s.planConfidenceLabel}>Confidence</span>
                      <span mix={s.planConfidenceValue}>{plan.confidence}%</span>
                    </div>
                  )}
                </div>
              )}
              {read && (
                <div mix={s.analysisSection}>
                  <div mix={s.analysisLabel}>Orderflow</div>
                  <div mix={s.orderflowRow}>
                    <span mix={s.orderflowLabel}>Pressure</span>
                    <span mix={[s.orderflowValue, read.orderflow.pressure === 'buy-pressure' ? s.orderflowBuy : read.orderflow.pressure === 'sell-pressure' ? s.orderflowSell : '']}>
                      {read.orderflow.pressure}
                    </span>
                  </div>
                  <div mix={s.orderflowRow}>
                    <span mix={s.orderflowLabel}>Delta</span>
                    <span mix={[s.orderflowValue, read.orderflow.delta > 0 ? s.orderflowBuy : read.orderflow.delta < 0 ? s.orderflowSell : '']}>
                      {read.orderflow.delta.toFixed(4)}
                    </span>
                  </div>
                  <div mix={s.orderflowRow}>
                    <span mix={s.orderflowLabel}>Trades</span>
                    <span mix={s.orderflowValue}>{read.orderflow.tradeCount}</span>
                  </div>
                </div>
              )}
              {auction && (
                <div mix={s.analysisSection}>
                  <div mix={s.analysisLabel}>Narrative</div>
                  <div mix={s.analysisNarrative}>{auction.narrative}</div>
                </div>
              )}
            </div>
          </div>
          <div mix={s.bottomStrip}>
            <div mix={s.tradeLogHeader}>
              <span>Time</span>
              <span>Side</span>
              <span>Entry</span>
              <span>Exit</span>
              <span>R</span>
              <span>Thesis</span>
            </div>
            <div mix={s.tradeLogEmpty}>
              No trades yet - agent is observing
            </div>
          </div>
        </div>

        <script
          type="module"
          src={routes.assets.href({ path: 'app/assets/agent-chart-client.ts' })}
        />
        <script id="agent-data" type="application/json">
          {JSON.stringify({ candles, segments, auction, regime, read, plan, asset })}
        </script>
      </Document>
    )
  }
}
