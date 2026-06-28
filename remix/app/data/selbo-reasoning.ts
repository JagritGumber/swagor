import type { SelboReasoning } from '../types/reader.ts'

interface RegimeSummary {
  mode: string
  label: string
  driftPct: number
  reason: string
}

interface AuctionSummary {
  locationLabel: string
  bias: string
}

export function buildSelboReasoning(
  asset: string,
  regime: RegimeSummary,
  auction: AuctionSummary,
): SelboReasoning {
  const mode = regime.mode
  const bias = auction.bias
  const location = auction.locationLabel

  if (mode === 'trend-up' || mode === 'trend-down') {
    const dir = mode === 'trend-up' ? 'upward' : 'downward'
    const aligned = (mode === 'trend-up' && bias === 'long') || (mode === 'trend-down' && bias === 'short')

    if (aligned) {
      return {
        intent: `Confirming ${dir} momentum`,
        context: `${regime.label} with ${dir} drift of ${regime.driftPct}%. Price is ${location} — reading for continuation.`,
        focus: `Strength of ${dir} move at next key level. Watching for acceleration or absorption.`,
        confidence: 'high',
      }
    }
    if (bias !== 'wait') {
      return {
        intent: `Monitoring ${dir} trend exhaustion`,
        context: `${regime.label} but auction shows ${bias} bias at ${location}. Counter-trend pressure developing.`,
        focus: `Rejection at ${location} or failed breakout. If bias aligns, trend may stall.`,
        confidence: 'medium',
      }
    }
    return {
      intent: `Reading ${dir} structure`,
      context: `${regime.label} with neutral auction bias. Price is ${location}. No directional edge yet.`,
      focus: 'Bias development or range expansion on the next candle.',
      confidence: 'low',
    }
  }

  if (mode === 'range') {
    if (bias !== 'wait') {
      return {
        intent: `${bias === 'long' ? 'Long' : 'Short'} bias within range`,
        context: `Market is ranging but auction shows ${bias} pressure at ${location}. Range boundary test in progress.`,
        focus: `Holding at ${location}. If sustained, range may tilt ${bias}.`,
        confidence: 'medium',
      }
    }
    return {
      intent: 'Range structure assessment',
      context: `Market is ranging with neutral auction bias. Price at ${location}. No directional conviction.`,
      focus: 'Move toward either range boundary with increasing volume.',
      confidence: 'low',
    }
  }

  if (mode === 'high-vol') {
    return {
      intent: 'Post-volatility structure formation',
      context: `High volatility regime detected. Price at ${location} with ${bias} bias. Looking for where the market accepts value after expansion.`,
      focus: 'Initial value area formation. POC development signals new equilibrium.',
      confidence: 'medium',
    }
  }

  return {
    intent: `Reading ${asset} market structure`,
    context: `${regime.label}. Price at ${location} with ${bias} bias. Insufficient data for strong conviction.`,
    focus: 'Clearer regime signal on next read cycle.',
    confidence: 'low',
  }
}
