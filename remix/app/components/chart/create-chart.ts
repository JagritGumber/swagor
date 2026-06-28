import { renderChart } from './renderer.ts'
import type { Candle } from '../../types/candles.ts'
import type { OverlaySegment } from './types.ts'
import { fetchCandles } from '../../data/fetch-candles.ts'
import { readRegimeSegments } from '@packages/strategy-lab/read-core/market-regime/read-regime-segments'

export interface ChartInstance {
  render(): void
  destroy(): void
}

const INTERVAL_MS: Record<string, number> = {
  '1m': 60_000,
  '5m': 300_000,
  '15m': 900_000,
  '1h': 3_600_000,
  '4h': 14_400_000,
  '1d': 86_400_000,
}

export function createChart(options: {
  container: HTMLElement | string
  candles: Candle[]
  segments: OverlaySegment[]
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
  canvas.style.cssText = 'display:block;width:100%;height:100%;cursor:grab'
  container.appendChild(canvas)

  const params = new URLSearchParams(window.location.search)
  const asset = params.get('asset') ?? 'ETH'
  const interval = params.get('interval') ?? '1h'
  const intervalMs = INTERVAL_MS[interval] ?? 3_600_000
  const batchSize = 200

  const PADDING = { top: 16, right: 60, bottom: 28, left: 8 }
  const MIN_PX = 2
  const MAX_PX = 1000
  const DRAG_THRESHOLD = 3

  let pxPerCandle = 0
  let scrollPx = 0
  let yScrollPx = 0
  let yZoom = 1
  let yMin = 0
  let yMax = 0
  let crosshair: { x: number; y: number } | null = null
  let toolbar: HTMLDivElement | null = null
  let observer: ResizeObserver | null = null
  let isLoading = false
  let lastCanvasW = 0
  let lastCanvasH = 0

  function initViewport(width: number): void {
    const totalW = width - PADDING.left - PADDING.right
    const count = options.candles.length
    pxPerCandle = count > 0 ? totalW / count : totalW
    const totalPx = count * pxPerCandle
    scrollPx = Math.max(0, totalPx - totalW)

    const allHighs = options.candles.map(c => c.h)
    const allLows = options.candles.map(c => c.l)
    yMin = Math.min(...allLows)
    yMax = Math.max(...allHighs)
    if (yMax === yMin) { yMax = yMin + 1 }
  }

  function totalWidth(viewW: number): number {
    return viewW - PADDING.left - PADDING.right
  }

  function cacheSegmentPriceRange(segments: OverlaySegment[], candles: Candle[]): void {
    for (const seg of segments) {
      let h = -Infinity
      let l = Infinity
      for (let i = seg.startIndex; i <= seg.endIndex && i < candles.length; i++) {
        const c = candles[i]
        if (c.h > h) h = c.h
        if (c.l < l) l = c.l
      }
      seg.high = h
      seg.low = l
    }
  }

  function loadOlder(): void {
    if (isLoading) return
    const first = options.candles[0]
    if (!first) return
    isLoading = true
    const end = first.t - intervalMs
    const start = end - intervalMs * batchSize
    fetchCandles(asset, interval, start, end).then(newCandles => {
      if (newCandles.length === 0) { isLoading = false; return }
      const existing = new Set(options.candles.map(c => c.t))
      const uniqueCandles = newCandles.filter(c => !existing.has(c.t))
      if (uniqueCandles.length === 0) { isLoading = false; return }
      const uniqueSegments: OverlaySegment[] = readRegimeSegments({ candles: uniqueCandles, lookback: 200 })
      cacheSegmentPriceRange(uniqueSegments, uniqueCandles)
      options.segments = options.segments.map(s => ({
        ...s,
        startIndex: s.startIndex + uniqueCandles.length,
        endIndex: s.endIndex + uniqueCandles.length,
      }))
      options.segments = [...uniqueSegments, ...options.segments]
      options.candles = [...uniqueCandles, ...options.candles]
      scrollPx += uniqueCandles.length * pxPerCandle
      isLoading = false
      paint()
    })
  }

  function loadNewer(): void {
    if (isLoading) return
    const last = options.candles[options.candles.length - 1]
    if (!last) return
    isLoading = true
    const start = last.t + intervalMs
    const end = start + intervalMs * batchSize
    fetchCandles(asset, interval, start, end).then(newCandles => {
      if (newCandles.length === 0) { isLoading = false; return }
      const existing = new Set(options.candles.map(c => c.t))
      const uniqueCandles = newCandles.filter(c => !existing.has(c.t))
      if (uniqueCandles.length === 0) { isLoading = false; return }
      const offset = options.candles.length
      const uniqueSegments: OverlaySegment[] = readRegimeSegments({ candles: uniqueCandles, lookback: 200 })
        .map(s => ({ ...s, startIndex: s.startIndex + offset, endIndex: s.endIndex + offset }))
      cacheSegmentPriceRange(uniqueSegments, options.candles.concat(uniqueCandles))
      options.segments = [...options.segments, ...uniqueSegments]
      options.candles = [...options.candles, ...uniqueCandles]
      isLoading = false
      paint()
    })
  }

  let lastLoadTime = 0

  function checkEdges(viewW: number): void {
    if (isLoading) return
    const now = performance.now()
    if (now - lastLoadTime < 2000) return
    const count = options.candles.length
    if (count === 0) return
    const totalPx = count * pxPerCandle
    const tw = totalWidth(viewW)
    const threshold = Math.max(50, pxPerCandle * 3)

    if (scrollPx < threshold) {
      lastLoadTime = now
      loadOlder()
    } else if (scrollPx + tw > totalPx - threshold) {
      lastLoadTime = now
      loadNewer()
    }
  }

  function paint(): void {
    if (options.candles.length === 0) return

    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    const cw = Math.max(1, rect.width * dpr)
    const ch = Math.max(1, rect.height * dpr)

    if (cw !== lastCanvasW || ch !== lastCanvasH) {
      canvas.width = cw
      canvas.height = ch
      lastCanvasW = cw
      lastCanvasH = ch
    }

    if (pxPerCandle === 0) initViewport(rect.width)

    const ctx = canvas.getContext('2d')
    if (ctx === null) return

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    renderChart(ctx, options.candles, options.segments, options.candles[options.candles.length - 1].c, {
      width: rect.width,
      height: rect.height,
      padding: PADDING,
    }, pxPerCandle, scrollPx, crosshair ?? undefined, yMin, yMax, yScrollPx, yZoom)

    checkEdges(rect.width)
  }

  let isDragging = false
  let dragStartPx = 0
  let dragStartPy = 0
  let dragStartMouseX = 0
  let dragStartMouseY = 0

  function onDocMove(e: MouseEvent): void {
    const dx = e.clientX - dragStartMouseX
    const dy = e.clientY - dragStartMouseY
    if (!isDragging && Math.abs(dx) <= DRAG_THRESHOLD && Math.abs(dy) <= DRAG_THRESHOLD) return
    if (!isDragging) {
      isDragging = true
      canvas.style.cursor = 'grabbing'
      crosshair = null
    }
    scrollPx = dragStartPx - dx
    yScrollPx = dragStartPy - dy
    paint()
  }

  function onDocUp(): void {
    isDragging = false
    canvas.style.cursor = 'grab'
    document.removeEventListener('mousemove', onDocMove)
    document.removeEventListener('mouseup', onDocUp)
    paint()
  }

  canvas.addEventListener('mousedown', (e) => {
    dragStartPx = scrollPx
    dragStartPy = yScrollPx
    dragStartMouseX = e.clientX
    dragStartMouseY = e.clientY
    document.addEventListener('mousemove', onDocMove)
    document.addEventListener('mouseup', onDocUp)
  })

  canvas.addEventListener('mousemove', (e) => {
    if (isDragging) return
    const rect = canvas.getBoundingClientRect()
    crosshair = { x: e.clientX - rect.left, y: e.clientY - rect.top }
    paint()
  })

  canvas.addEventListener('mouseleave', () => {
    if (isDragging) return
    crosshair = null
    paint()
  })

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault()
    const factor = e.deltaY > 0 ? 1 / 1.12 : 1.12
    if (e.shiftKey) {
      const oldZoom = yZoom
      yZoom = Math.max(0.1, Math.min(50, yZoom * factor))
      yScrollPx *= yZoom / oldZoom
    } else {
      const rect = canvas.getBoundingClientRect()
      const mouseX = e.clientX - rect.left - PADDING.left
      const candleAtMouse = (mouseX + scrollPx) / pxPerCandle
      pxPerCandle = Math.max(MIN_PX, Math.min(MAX_PX, pxPerCandle * factor))
      scrollPx = candleAtMouse * pxPerCandle - mouseX
    }
    paint()
  }, { passive: false })

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

    const zoomFn = (dir: number) => () => {
      const rect = canvas.getBoundingClientRect()
      const tw = totalWidth(rect.width)
      const midPx = scrollPx + tw / 2
      const candleAtCenter = midPx / pxPerCandle
      pxPerCandle = Math.max(MIN_PX, Math.min(MAX_PX, pxPerCandle * dir))
      scrollPx = candleAtCenter * pxPerCandle - tw / 2
      paint()
    }

    toolbar.appendChild(makeBtn('−', zoomFn(1 / 1.12)))
    toolbar.appendChild(makeBtn('+', zoomFn(1.12)))
    toolbar.appendChild(makeBtn('Y−', () => {
      const oldZoom = yZoom
      yZoom = Math.max(0.1, Math.min(50, yZoom / 1.12))
      yScrollPx *= yZoom / oldZoom
      paint()
    }))
    toolbar.appendChild(makeBtn('Y+', () => {
      const oldZoom = yZoom
      yZoom = Math.max(0.1, Math.min(50, yZoom * 1.12))
      yScrollPx *= yZoom / oldZoom
      paint()
    }))
    container.appendChild(toolbar)
  }

  return {
    render(): void {
      cacheSegmentPriceRange(options.segments, options.candles)
      observer = new ResizeObserver(paint)
      observer.observe(canvas)
      buildToolbar()
      paint()
    },
    destroy(): void {
      if (observer !== null) observer.disconnect()
      if (toolbar !== null) toolbar.remove()
      canvas.remove()
    },
  }
}
