import type { LiveReaderRead, LiveReaderStance } from '@packages/strategy-lab/reader/reader-live/types'
import type { InsertEvidence } from '@/db/schema.ts'

type EvidenceCategory = InsertEvidence['category']

export function mapReadToEvidence(read: LiveReaderRead): InsertEvidence[] {
  const rows: InsertEvidence[] = []
  const direction = stanceDirection(read.stance)

  if (read.regime) {
    rows.push({
      category: 'regime',
      title: read.regime.mode,
      value: JSON.stringify({
        rangePct: read.regime.rangePct,
        driftPct: read.regime.driftPct,
        directionalEfficiency: read.regime.directionalEfficiency,
        reason: read.regime.reason,
      }),
      stance: regimeStance(read.regime.mode, direction),
    })
  }

  if (read.auction.profile) {
    rows.push({
      category: 'volume_profile',
      title: read.auction.location,
      value: JSON.stringify({
        poc: read.auction.profile.poc,
        valueAreaLow: read.auction.profile.valueAreaLow,
        valueAreaHigh: read.auction.profile.valueAreaHigh,
        bias: read.auction.bias,
      }),
      stance: auctionBiasStance(read.auction.bias, direction),
    })
  }

  if (read.auction.level) {
    rows.push({
      category: 'price_level',
      title: `${read.auction.level.kind} ${read.auction.level.price}`,
      value: JSON.stringify({
        price: read.auction.level.price,
        kind: read.auction.level.kind,
        touches: read.auction.level.touches,
      }),
      stance: levelStance(read.auction.level.kind, direction),
    })
  }

  rows.push({
    category: 'orderflow',
    title: read.orderflow.pressure,
    value: JSON.stringify({
      delta: read.orderflow.delta,
      tradeCount: read.orderflow.tradeCount,
      buyVolume: read.orderflow.buyVolume,
      sellVolume: read.orderflow.sellVolume,
      pressure: read.orderflow.pressure,
      events: read.orderflow.events,
    }),
    stance: orderflowStance(read.orderflow.pressure, direction),
  })

  if (read.localRange && read.localRange.location !== 'unknown') {
    rows.push({
      category: 'volume_profile',
      title: `local range: ${read.localRange.location}`,
      value: JSON.stringify({
        location: read.localRange.location,
        position: read.localRange.position,
        high: read.localRange.high,
        low: read.localRange.low,
      }),
      stance: 'supporting',
    })
  }

  if (read.vpState) {
    rows.push({
      category: 'volume_profile',
      title: `vp: ${read.vpState.auction}`,
      value: JSON.stringify({
        auction: read.vpState.auction,
        previousAuction: read.vpState.previousAuction,
      }),
      stance: 'supporting',
    })
  }

  return rows
}

function stanceDirection(stance: LiveReaderStance): 'long' | 'short' | 'none' {
  if (stance === 'possible-long' || stance === 'watch-long-confirmation') return 'long'
  if (stance === 'possible-short' || stance === 'watch-short-confirmation') return 'short'
  return 'none'
}

function regimeStance(mode: string, direction: 'long' | 'short' | 'none'): InsertEvidence['stance'] {
  if (direction === 'none') return 'supporting'
  if (direction === 'long') return mode === 'trend-up' ? 'supporting' : 'contradicting'
  if (direction === 'short') return mode === 'trend-down' ? 'supporting' : 'contradicting'
  return 'supporting'
}

function auctionBiasStance(bias: string, direction: 'long' | 'short' | 'none'): InsertEvidence['stance'] {
  if (direction === 'none') return 'supporting'
  if (bias === 'wait') return 'supporting'
  return bias === direction ? 'supporting' : 'contradicting'
}

function levelStance(kind: string, direction: 'long' | 'short' | 'none'): InsertEvidence['stance'] {
  if (direction === 'none') return 'supporting'
  if (direction === 'long') return kind === 'support' ? 'supporting' : 'contradicting'
  if (direction === 'short') return kind === 'resistance' ? 'supporting' : 'contradicting'
  return 'supporting'
}

function orderflowStance(pressure: string, direction: 'long' | 'short' | 'none'): InsertEvidence['stance'] {
  if (direction === 'none') return 'supporting'
  if (direction === 'long') return pressure === 'buy-pressure' ? 'supporting' : 'contradicting'
  if (direction === 'short') return pressure === 'sell-pressure' ? 'supporting' : 'contradicting'
  return 'supporting'
}
