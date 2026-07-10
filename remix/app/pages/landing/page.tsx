import type { Handle } from 'remix/ui'
import { Document } from '@/document'
import { LandingChartEntry } from '@/components/landing/chart-entry'
import { regimeBadgeClass, stanceBadgeClass, stanceLabel } from '@/components/agent/badge-maps'
import { routes } from '@/routes'
import type { LandingViewProps } from './types.ts'
import * as s from './style.ts'

interface LandingPageProps extends LandingViewProps {
  user?: { address: string }
}

export function LandingPage(handle: Handle<LandingPageProps>) {
  return () => {
    const { assets, activeAsset, user } = handle.props
    const data = assets[activeAsset]

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
            <script id="landing-chart-data" type="application/json">{JSON.stringify({ candles: data.candles, segments: data.segments, auction: data.auction })}</script>
            <LandingChartEntry />
            <div mix={s.analysisPanel}>
              {data.regime && (
                <div mix={s.analysisSection}>
                  <div mix={s.analysisLabel}>Regime</div>
                  <span mix={[s.regimeBadge, regimeBadgeClass[data.regime.mode]]}>
                    {data.regime.label}
                  </span>
                </div>
              )}
              {data.read && (
                <div mix={s.analysisSection}>
                  <div mix={s.analysisLabel}>Stance</div>
                  <span mix={[s.stanceBadge, stanceBadgeClass[data.read.stance]]}>
                    {stanceLabel[data.read.stance]}
                  </span>
                </div>
              )}
              {data.auction && (
                <>
                  <div mix={s.analysisSection}>
                    <div mix={s.analysisLabel}>Location</div>
                    <div mix={s.analysisValue}>{data.auction.locationLabel}</div>
                  </div>
                  <div mix={s.analysisSection}>
                    <div mix={s.analysisLabel}>Bias</div>
                    <div mix={s.analysisValue}>{data.auction.bias}</div>
                  </div>
                  {data.auction.profile && (
                    <div mix={s.analysisSection}>
                      <div mix={s.analysisLabel}>Volume Profile</div>
                      <div mix={s.analysisValue} style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '12px' }}>
                        POC ${data.auction.profile.poc.toFixed(2)}
                      </div>
                      <div mix={s.analysisValue} style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '12px' }}>
                        VA ${data.auction.profile.valueAreaLow.toFixed(2)} - ${data.auction.profile.valueAreaHigh.toFixed(2)}
                      </div>
                    </div>
                  )}
                </>
              )}
              {data.read && (
                <div mix={s.analysisSection}>
                  <div mix={s.analysisLabel}>Orderflow</div>
                  <div mix={s.orderflowRow}>
                    <span mix={s.orderflowLabel}>Pressure</span>
                    <span mix={[s.orderflowValue, data.read.orderflow.pressure === 'buy-pressure' ? s.orderflowBuy : data.read.orderflow.pressure === 'sell-pressure' ? s.orderflowSell : '']}>
                      {data.read.orderflow.pressure}
                    </span>
                  </div>
                  <div mix={s.orderflowRow}>
                    <span mix={s.orderflowLabel}>Delta</span>
                    <span mix={[s.orderflowValue, data.read.orderflow.delta > 0 ? s.orderflowBuy : data.read.orderflow.delta < 0 ? s.orderflowSell : '']}>
                      {data.read.orderflow.delta.toFixed(4)}
                    </span>
                  </div>
                  <div mix={s.orderflowRow}>
                    <span mix={s.orderflowLabel}>Trades</span>
                    <span mix={s.orderflowValue}>{data.read.orderflow.tradeCount}</span>
                  </div>
                </div>
              )}
              {data.auction && (
                <div mix={s.analysisSection}>
                  <div mix={s.analysisLabel}>Narrative</div>
                  <div mix={s.analysisNarrative}>{data.auction.narrative}</div>
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
