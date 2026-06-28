import { renderChart } from './chart-canvas.ts'
import type { Candle } from '../../types/candles.ts'
import type { OverlaySegment } from './types.ts'

export const ZOOM_LEVELS = [50, 100, 200, 400, 600, 800] as const

export interface ChartInstance {
  render(): void
  zoomIn(): void
  zoomOut(): void
  destroy(): void
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
  canvas.style.cssText = 'display:block;width:100%;height:100%'
  container.appendChild(canvas)

  const params = new URLSearchParams(window.location.search)
  const rawLookback = Number(params.get('lookback') ?? '200')
  let zoomIndex = ZOOM_LEVELS.indexOf(rawLookback as (typeof ZOOM_LEVELS)[number])
  if (zoomIndex === -1) zoomIndex = 2

  const path = window.location.pathname
  const query = new URLSearchParams(window.location.search)

  let candles: Candle[] = options.candles
  let segments: OverlaySegment[] = options.segments
  let toolbar: HTMLDivElement | null = null
  let observer: ResizeObserver | null = null

  function navigate(level: number): void {
    query.set('lookback', String(level))
    window.location.href = path + '?' + query.toString()
  }

  function paint(): void {
    if (candles.length === 0) return

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
    if (zoomIndex > 0) { zoomIndex -= 1; navigate(ZOOM_LEVELS[zoomIndex]) }
  }

  function zoomOut(): void {
    if (zoomIndex < ZOOM_LEVELS.length - 1) { zoomIndex += 1; navigate(ZOOM_LEVELS[zoomIndex]) }
  }

  return {
    render(): void {
      observer = new ResizeObserver(paint)
      observer.observe(canvas)
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
