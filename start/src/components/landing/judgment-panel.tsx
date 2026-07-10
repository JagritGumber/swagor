import {
  regimeBadgeClass,
  stanceBadgeClass,
  stanceLabel,
} from '@/components/agent/badge-maps'
import * as s from '@/components/agent/style'
import { LastRead } from './last-read'
import type { LandingAuction, LandingReaderRead, LandingRegime } from './types'

interface JudgmentPanelProps {
  regime: LandingRegime | null
  auction: LandingAuction | null
  read: LandingReaderRead | null
  updatedAt: number | null
}

export function JudgmentPanel({
  regime,
  auction,
  read,
  updatedAt,
}: JudgmentPanelProps) {
  // Open panel: drop translate-x-full so it stays visible (Tailwind conflict if both present).
  const panelClass = s.analysisPanel.replace('translate-x-full', 'translate-x-0')

  return (
    <div className={panelClass}>
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
              <div className="font-data text-xs text-white">
                POC ${auction.profile.poc.toFixed(2)}
              </div>
              <div className="font-data text-xs text-white">
                VA ${auction.profile.valueAreaLow.toFixed(2)} - $
                {auction.profile.valueAreaHigh.toFixed(2)}
              </div>
            </div>
          ) : null}
        </>
      ) : null}

      {auction ? (
        <div className={s.analysisSection}>
          <div className={s.analysisLabel}>Narrative</div>
          <div className={s.analysisNarrative}>{auction.narrative}</div>
        </div>
      ) : null}

      {updatedAt ? <LastRead updatedAt={updatedAt} /> : null}
    </div>
  )
}
