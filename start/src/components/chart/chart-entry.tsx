import { useEffect, useRef } from 'react'
import type { Candle } from '@shared/candle'
import type { OverlaySegment } from './types'
import { createLWChart, type LWChartOptions } from './lw-chart'

export interface ChartEntryProps {
  candles: Candle[]
  segments: OverlaySegment[]
  asset?: string
  interval?: string
  auction?: LWChartOptions['auction']
  plan?: LWChartOptions['plan']
  className?: string
}

/**
 * Client chart mount: useRef + useEffect, throws if container is not HTMLDivElement.
 * Uses the active lightweight-charts engine (createLWChart).
 */
export function ChartEntry({
  candles,
  segments,
  asset,
  interval,
  auction,
  plan,
  className,
}: ChartEntryProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!(el instanceof HTMLDivElement)) {
      throw new Error('ChartEntry: container ref is not an HTMLDivElement')
    }
    const chart = createLWChart({
      container: el,
      candles,
      segments,
      asset,
      interval,
      auction,
      plan,
    })
    return () => chart.destroy()
  }, [candles, segments, asset, interval, auction, plan])

  return (
    <div
      ref={ref}
      className={className}
      style={{ width: '100%', height: '100%', position: 'relative' }}
    />
  )
}
