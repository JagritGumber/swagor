import { useEffect, useRef } from 'react'
import type { Candle } from '@shared/candle'
import type { OverlaySegment } from '@/components/chart/types'
import { createLWChart, type LWChartOptions } from '@/components/chart/lw-chart'
import { connectLiveCandles } from '@/data/live-candles'

export interface AgentChartEntryProps {
  candles: Candle[]
  segments: OverlaySegment[]
  asset: string
  interval?: string
  auction: LWChartOptions['auction']
  plan: LWChartOptions['plan']
}

/**
 * Agent chart: mounts lightweight-charts with auction/plan overlays and live candle SSE.
 */
export function AgentChartEntry({
  candles,
  segments,
  asset,
  interval = '1h',
  auction,
  plan,
}: AgentChartEntryProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!(el instanceof HTMLDivElement)) {
      throw new Error('AgentChartEntry: container ref is not an HTMLDivElement')
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
  }, [candles, segments, asset, interval, auction, plan])

  return (
    <div
      ref={ref}
      className="min-h-0 w-full flex-1"
      style={{ width: '100%', flex: 1, minHeight: 0 }}
    />
  )
}
