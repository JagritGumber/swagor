import { renderChart } from '../components/chart/chart-canvas.ts'
import type { Candle } from '../types/candles.ts'
import type { OverlayData } from '../components/chart/types.ts'

async function main() {
  const canvas = document.getElementById('candle-chart-canvas') as HTMLCanvasElement | null
  if (!canvas) return

  const params = new URLSearchParams(window.location.search)
  const asset = params.get('asset') || 'ETH'
  const interval = params.get('interval') || '1h'

  const [candlesRes, readerRes] = await Promise.all([
    fetch(`/api/candles?asset=${asset}&interval=${interval}`),
    fetch(`/api/reader-read?asset=${asset}&interval=${interval}`),
  ])

  if (!candlesRes.ok || !readerRes.ok) return

  type ReaderResponse = { error: string } | {
    auction: { profile?: { valueAreaLow: number; valueAreaHigh: number; poc: number } | null }
    regime: { mode: string }
    lastPrice: number
  }

  const candlesData = await candlesRes.json() as { candles: Candle[] }
  const readerData = await readerRes.json() as ReaderResponse
  if ('error' in readerData || !candlesData.candles.length) return

  const { candles } = candlesData
  const overlays: OverlayData = {
    valueAreaLow: readerData.auction.profile?.valueAreaLow,
    valueAreaHigh: readerData.auction.profile?.valueAreaHigh,
    poc: readerData.auction.profile?.poc,
    regimeMode: readerData.regime.mode,
    currentPrice: readerData.lastPrice,
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
