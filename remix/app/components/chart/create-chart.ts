import { renderChart } from './chart-canvas.ts'
import type { Candle } from '../../types/candles.ts'
import type { OverlaySegment } from './types.ts'

const ZOOM_LEVELS = [50, 100, 200, 400, 600, 800] as const

export interface ChartInstance {
  render(): Promise<void>
  zoomIn(): void
  zoomOut(): void
  destroy(): void
}

export function createChart(options: {
  container: HTMLElement | string
}): ChartInstance {
  const rawContainer =
    typeof options.container === 'string'
      ? document.querySelector(options.container)
      : options.container

  if (!(rawContainer instanceof HTMLElement)) {
    throw new Error('createChart: container must be an HTMLElement or a valid selector')
  }
  const container: HTMLElement = rawContainer

  const canvas = document.createElement('canvas')
  canvas.style.cssText = 'display:block;width:100%;height:100%'
  container.appendChild(canvas)

  const params = new URLSearchParams(window.location.search)
  const asset = params.get('asset') || 'ETH'
  const interval = params.get('interval') || '1h'

  let zoomIndex = 2
  let candles: Candle[] = []
  let segments: OverlaySegment[] = []
  let toolbar: HTMLDivElement | null = null
  let observer: ResizeObserver | null = null

  async function fetchCandlesJson(): Promise<{ candles: Candle[] }> {
    const url = `/api/candles?asset=${asset}&interval=${interval}&lookback=${ZOOM_LEVELS[zoomIndex]}`
    const res = await fetch(url)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.error ?? `GET ${url} → ${res.status}`)
    }
    return res.json()
  }

  async function fetchSegmentsJson(): Promise<{ segments: OverlaySegment[] }> {
    const url = `/api/regime-segments?asset=${asset}&interval=${interval}&lookback=${ZOOM_LEVELS[zoomIndex]}`
    const res = await fetch(url)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.error ?? `GET ${url} → ${res.status}`)
    }
    return res.json()
  }

  async function fetchData(): Promise<void> {
    const [cd, sd] = await Promise.all([fetchCandlesJson(), fetchSegmentsJson()])
    if (cd.candles.length === 0) throw new Error('createChart: empty candle response')
    candles = cd.candles
    segments = sd.segments
  }

  function paint(): void {
    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr

    const ctx = canvas.getContext('2d')
    if (ctx === null) return

    ctx.scale(dpr, dpr)
    renderChart(ctx, candles, {
      segments,
      currentPrice: candles[candles.length - 1].c,
    }, {
      width: rect.width,
      height: rect.height,
      padding: { top: 16, right: 60, bottom: 8, left: 8 },
    })
  }

  function buildToolbar(): void {
    if (toolbar !== null) toolbar.remove()
    toolbar = document.createElement('div')
    toolbar.style.cssText = 'position:absolute;top:8px;right:8px;display:flex;gap:4px;z-index:10'

    const makeBtn = (label: string, onClick: () => void) => {
      const b = document.createElement('button')
      b.textContent = label
      b.style.cssText = 'width:28px;height:28px;border:1px solid oklch(1 0 0 / .15);border-radius:4px;background:oklch(0 0 0 / .6);color:oklch(1 0 0 / .8);font:14px/1 monospace;cursor:pointer'
      b.onclick = onClick
      return b
    }

    toolbar.appendChild(makeBtn('−', zoomOut))
    toolbar.appendChild(makeBtn('+', zoomIn))
    container.appendChild(toolbar)
  }

  function zoomIn(): void {
    if (zoomIndex > 0) { zoomIndex -= 1; fetchData().then(paint) }
  }

  function zoomOut(): void {
    if (zoomIndex < ZOOM_LEVELS.length - 1) { zoomIndex += 1; fetchData().then(paint) }
  }

  observer = new ResizeObserver(paint)
  observer.observe(canvas)

  return {
    async render(): Promise<void> {
      await fetchData()
      buildToolbar()
      paint()
    },
    zoomIn,
    zoomOut,
    destroy(): void {
      if (observer !== null) observer.disconnect()
      if (toolbar !== null) toolbar.remove()
      canvas.remove()
    },
  }
}
