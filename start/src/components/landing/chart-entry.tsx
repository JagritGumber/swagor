import { useEffect, useRef } from 'react'
import type { Candle } from '@shared/candle'
import type { OverlaySegment } from '@/components/chart/types'
import { createLWChart } from '@/components/chart/lw-chart'
import { connectLiveCandles } from '@/data/live-candles'
import type { LandingAuction } from './types'

interface LandingChartEntryProps {
  candles: Candle[]
  segments: OverlaySegment[]
  asset: string
  interval?: string
  auction: LandingAuction | null
}

/**
 * Landing chart: mounts lightweight-charts and wires live candle SSE.
 * Remounts when the active asset (or candle set identity) changes.
 */
export function LandingChartEntry({
  candles,
  segments,
  asset,
  interval = '1h',
  auction,
}: LandingChartEntryProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!(el instanceof HTMLDivElement)) {
      throw new Error('LandingChartEntry: container ref is not an HTMLDivElement')
    }

    const chart = createLWChart({
      container: el,
      candles,
      segments,
      asset,
      interval,
      auction: auction
        ? {
            profile: auction.profile
              ? {
                  poc: auction.profile.poc,
                  valueAreaLow: auction.profile.valueAreaLow,
                  valueAreaHigh: auction.profile.valueAreaHigh,
                }
              : null,
          }
        : null,
      plan: null,
    })

    const abort = new AbortController()
    connectLiveCandles(
      asset,
      interval,
      {
        onUpdate: (candle) => chart.updateCandle(candle),
        onClose: (candle) => chart.appendCandle(candle),
      },
      abort.signal,
    )

    return () => {
      abort.abort()
      chart.destroy()
    }
  }, [candles, segments, asset, interval, auction])

  return (
    <div
      ref={ref}
      className="relative min-h-0 w-full flex-1"
      style={{ width: '100%', flex: 1, minHeight: 0 }}
    />
  )
}
