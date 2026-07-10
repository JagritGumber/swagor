import { clientEntry, ref, type Handle } from 'remix/ui'
import type { Candle } from '@shared/candle'
import type { OverlaySegment } from '../chart/types.ts'
import { createLWChart } from '../chart/lw-chart.ts'
import { connectLiveCandles } from '@/data/live-candles'

interface LandingChartData {
  candles: Candle[]
  segments: OverlaySegment[]
  auction: {
    profile: {
      poc: number
      valueAreaLow: number
      valueAreaHigh: number
      bins: { low: number; high: number; volume: number }[]
    } | null
  } | null
  plan: {
    status: string
    side?: string
    entryLow?: number
    entryHigh?: number
    stop?: number
    target?: number
  } | null
}

function readLandingData(): LandingChartData {
  const el = document.getElementById('landing-chart-data')
  if (!(el instanceof HTMLElement)) throw new Error('Missing landing-chart-data script tag')
  return JSON.parse(el.textContent!)
}

export const LandingChartEntry = clientEntry(
  import.meta.url,
  function LandingChartEntry(_handle: Handle<{}>) {
    return () => (
      <div
        style={{ width: '100%', flex: 1, minHeight: 0 }}
        mix={ref((node, signal) => {
          if (!(node instanceof HTMLElement)) return
          try {
            const { candles, segments, auction, plan } = readLandingData()
            const params = new URLSearchParams(window.location.search)
            const asset = params.get('asset') ?? 'ETH'
            const interval = params.get('interval') ?? '1h'

            const chart = createLWChart({
              container: node,
              candles,
              segments,
              auction,
              plan,
            })

            connectLiveCandles(asset, interval, {
              onUpdate: (candle) => chart.updateCandle(candle),
              onClose: (candle) => chart.appendCandle(candle),
            }, signal)

            signal.addEventListener('abort', () => chart.destroy())
          } catch (e) {
            console.error('[LandingChartEntry] Failed to initialize chart:', e)
          }
        })}
      />
    )
  },
)
