import type { Handle } from 'remix/ui'
import { regimeBadgeClass, stanceBadgeClass, stanceLabel } from '@/components/agent/badge-maps'
import { LastRead } from './last-read'
import * as s from '@/pages/landing/style'
import type { LandingRegime, LandingAuction, LandingReaderRead } from '@/pages/landing/types'

interface JudgmentPanelProps {
  regime: LandingRegime | null
  auction: LandingAuction | null
  read: LandingReaderRead | null
  updatedAt: number | null
}

export function JudgmentPanel(handle: Handle<JudgmentPanelProps>) {
  return () => {
    const { regime, auction, read, updatedAt } = handle.props
    return (
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
        {auction && (
          <div mix={s.analysisSection}>
            <div mix={s.analysisLabel}>Narrative</div>
            <div mix={s.analysisNarrative}>{auction.narrative}</div>
          </div>
        )}
        {updatedAt && <LastRead updatedAt={updatedAt} />}
      </div>
    )
  }
}
