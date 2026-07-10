import type { Handle } from 'remix/ui'
import { Document } from '../../document.tsx'
import { LandingChartEntry } from '../../components/landing/chart-entry.tsx'
import { regimeBadgeClass, stanceBadgeClass, stanceLabel, planStatusLabel } from '../../components/agent/badge-maps.ts'
import { routes } from '../../routes.ts'
import type { LandingViewProps } from './types.ts'
import * as s from './style.ts'

interface LandingPageProps extends LandingViewProps {
  user?: { address: string }
}

export function LandingPage(handle: Handle<LandingPageProps>) {
  return () => {
    const { candles, segments, auction, regime, read, plan, judgment, portfolio, asset, user } = handle.props

    return (
      <Document
        title="Selbo - AI Trading Agent"
        user={user}
        publicRoute
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
        <div mix={s.landingPage}>
          <div mix={s.chartArea}>
            <script id="landing-chart-data" type="application/json">{JSON.stringify({ candles, segments, auction, plan })}</script>
            <LandingChartEntry />
            <div mix={s.analysisPanel}>
              {regime && (
                <div mix={s.analysisSection}>
                  <div mix={s.analysisLabel}>Regime</div>
                  <span mix={[s.regimeBadge, regimeBadgeClass[regime.mode]]}>
                    {regime.label}
                  </span>
                </div>
              )}
              {read && (
                <div mix={s.analysisSection}>
                  <div mix={s.analysisLabel}>Stance</div>
                  <span mix={[s.stanceBadge, stanceBadgeClass[read.stance]]}>
                    {stanceLabel[read.stance]}
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
                    <span mix={s.planStatusLabel}>{planStatusLabel[plan.status]}</span>
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
              {judgment && (
                <div mix={s.analysisSection}>
                  <div mix={s.analysisLabel}>Judgment</div>
                  <div mix={s.planStatus}>
                    <span mix={[s.planBadge, judgment.action === 'enter' && judgment.side === 'long' ? s.planLong : judgment.action === 'enter' && judgment.side === 'short' ? s.planShort : '']}>
                      {judgment.action === 'enter' ? judgment.side?.toUpperCase() : judgment.action}
                    </span>
                  </div>
                  <div mix={s.analysisValue} style={{ fontSize: '12px', marginTop: '4px' }}>{judgment.reason}</div>
                  <div mix={s.planConfidence}>
                    <span mix={s.planConfidenceLabel}>Confidence</span>
                    <span mix={s.planConfidenceValue}>{(judgment.confidence * 100).toFixed(0)}%</span>
                  </div>
                  {judgment.allJudgments.length > 0 && (
                    <div style={{ marginTop: '8px' }}>
                      <div mix={s.analysisLabel} style={{ fontSize: '10px' }}>All Strategies</div>
                      {judgment.allJudgments.map((j) => (
                        <div key={j.configId} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', padding: '2px 0', color: '#9ca3af' }}>
                          <span>{j.label}</span>
                          <span>{(j.confidence * 100).toFixed(0)}%</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {portfolio && (
                <div mix={s.analysisSection}>
                  <div mix={s.analysisLabel}>Portfolio</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', fontSize: '12px' }}>
                    <div>
                      <span mix={s.orderflowLabel}>Equity</span>
                      <div mix={s.orderflowValue}>${portfolio.equity.toFixed(2)}</div>
                    </div>
                    <div>
                      <span mix={s.orderflowLabel}>P&L</span>
                      <div mix={[s.orderflowValue, portfolio.totalPnl > 0 ? s.orderflowBuy : portfolio.totalPnl < 0 ? s.orderflowSell : '']}>
                        {portfolio.totalPnl >= 0 ? '+' : ''}{portfolio.totalPnl.toFixed(2)}%
                      </div>
                    </div>
                    <div>
                      <span mix={s.orderflowLabel}>Trades</span>
                      <div mix={s.orderflowValue}>{portfolio.tradeCount}</div>
                    </div>
                    <div>
                      <span mix={s.orderflowLabel}>Win Rate</span>
                      <div mix={s.orderflowValue}>{portfolio.tradeCount > 0 ? ((portfolio.winCount / portfolio.tradeCount) * 100).toFixed(0) : 0}%</div>
                    </div>
                  </div>
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
      </Document>
    )
  }
}
