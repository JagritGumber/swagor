import { renderChart } from '../components/chart/chart-canvas.ts'
import type { Candle } from '../types/candles.ts'
import type { OverlayData, OverlaySegment } from '../components/chart/types.ts'

const ZOOM_LEVELS = [50, 100, 200, 400, 600, 800]

async function main() {
  const canvas = document.getElementById('candle-chart-canvas') as HTMLCanvasElement | null
  if (!canvas) return

  const params = new URLSearchParams(window.location.search)
  const asset = params.get('asset') || 'ETH'
  const interval = params.get('interval') || '1h'

  let lookback = 200
  let candles: Candle[] = []
  let segments: OverlaySegment[] = []

  async function fetchData() {
    const [candlesRes, segRes] = await Promise.all([
      fetch(`/api/candles?asset=${asset}&interval=${interval}&lookback=${lookback}`),
      fetch(`/api/regime-segments?asset=${asset}&interval=${interval}&lookback=${lookback}`),
    ])
    if (!candlesRes.ok || !segRes.ok) return false

    type SegmentsResponse = { error: string } | {
      asset: string
      interval: string
      segments: OverlaySegment[]
    }

    const cd = await candlesRes.json() as { candles: Candle[] }
    const sd = await segRes.json() as SegmentsResponse
    if ('error' in sd || !cd.candles.length) return false

    candles = cd.candles
    segments = sd.segments
    return true
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

    const overlays: OverlayData = {
      segments,
      currentPrice: candles.length > 0 ? candles[candles.length - 1].c : undefined,
    }

    renderChart(ctx, candles, overlays, config)
  }

  async function refresh() {
    const ok = await fetchData()
    if (!ok) return
    render()
  }

  function zoomIn() {
    const idx = ZOOM_LEVELS.indexOf(lookback)
    if (idx > 0) {
      lookback = ZOOM_LEVELS[idx - 1]
      refresh()
    }
  }

  function zoomOut() {
    const idx = ZOOM_LEVELS.indexOf(lookback)
    if (idx < ZOOM_LEVELS.length - 1) {
      lookback = ZOOM_LEVELS[idx + 1]
      refresh()
    }
  }

  function buildToolbar() {
    const existing = document.getElementById('chart-toolbar')
    if (existing) existing.remove()

    const toolbar = document.createElement('div')
    toolbar.id = 'chart-toolbar'
    toolbar.style.cssText =
      'position:absolute;top:8px;right:8px;display:flex;gap:4px;z-index:10'

    const btn = (label: string, onClick: () => void) => {
      const b = document.createElement('button')
      b.textContent = label
      b.style.cssText =
        'width:28px;height:28px;border:1px solid oklch(1 0 0 / .15);border-radius:4px;background:oklch(0 0 0 / .6);color:oklch(1 0 0 / .8);font:14px/1 monospace;cursor:pointer;display:flex;align-items:center;justify-content:center'
      b.onclick = onClick
      return b
    }

    toolbar.appendChild(btn('−', zoomOut))
    toolbar.appendChild(btn('+', zoomIn))
    canvas!.parentElement?.appendChild(toolbar)
  }

  await refresh()
  buildToolbar()

  const observer = new ResizeObserver(() => render())
  observer.observe(canvas)
}

main()
