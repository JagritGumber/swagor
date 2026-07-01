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

interface AgentPageProps {
  candles: Candle[]
  segments: OverlaySegment[]
  auction: AgentAuction | null
  regime: AgentRegime | null
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

export function AgentPage(handle: Handle<AgentPageProps>) {
  return () => {
    const { candles, segments, auction, regime, asset } = handle.props

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
            {auction && (
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
                      VA ${auction.profile.valueAreaLow.toFixed(2)} – ${auction.profile.valueAreaHigh.toFixed(2)}
                    </div>
                  </div>
                )}
                <div mix={s.analysisSection}>
                  <div mix={s.analysisLabel}>Narrative</div>
                  <div mix={s.analysisNarrative}>{auction.narrative}</div>
                </div>
              </div>
            )}
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
              No trades yet — agent is observing
            </div>
          </div>
        </div>

        <script
          type="module"
          src={routes.assets.href({ path: 'app/assets/agent-chart-client.ts' })}
        />
        <script
          id="agent-data"
          type="application/json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({ candles, segments, auction, regime, asset }),
          }}
        />
      </Document>
    )
  }
}
