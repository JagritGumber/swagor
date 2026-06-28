import { renderChart } from '../components/chart/chart-canvas.ts'
import type { Candle } from '../types/candles.ts'
import type { OverlayData, OverlaySegment } from '../components/chart/types.ts'

async function main() {
  const canvas = document.getElementById('candle-chart-canvas') as HTMLCanvasElement | null
  if (!canvas) return

  const params = new URLSearchParams(window.location.search)
  const asset = params.get('asset') || 'ETH'
  const interval = params.get('interval') || '1h'

  const [candlesRes, segRes] = await Promise.all([
    fetch(`/api/candles?asset=${asset}&interval=${interval}`),
    fetch(`/api/regime-segments?asset=${asset}&interval=${interval}`),
  ])

  if (!candlesRes.ok || !segRes.ok) return

  type SegmentsResponse = { error: string } | {
    asset: string
    interval: string
    segments: OverlaySegment[]
  }

  const candlesData = await candlesRes.json() as { candles: Candle[] }
  const segData = await segRes.json() as SegmentsResponse
  if ('error' in segData || !candlesData.candles.length) return

  const { candles } = candlesData
  const overlays: OverlayData = {
    segments: segData.segments,
    currentPrice: candles[candles.length - 1].c,
  }

  const config = {
    width: 0,
    height: 0,
    padding: { top: 16, right: 60, bottom: 8, left: 8 },
  }

  function render() {
    const cvs = document.getElementById('candle-chart-canvas') as HTMLCanvasElement | null
    if (!cvs) return
    const dpr = window.devicePixelRatio || 1
    const rect = cvs.getBoundingClientRect()

    cvs.width = rect.width * dpr
    cvs.height = rect.height * dpr

    const ctx = cvs.getContext('2d')
    if (!ctx) return

    ctx.scale(dpr, dpr)

    config.width = rect.width
    config.height = rect.height

    renderChart(ctx, candles, overlays, config)
  }

  render()
  const observer = new ResizeObserver(() => render())
  observer.observe(canvas)
}

main()
