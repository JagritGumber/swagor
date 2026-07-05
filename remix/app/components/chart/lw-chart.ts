// status: Active — lightweight-charts chart wrapper

import {
  createChart,
  CandlestickSeries,
  type CandlestickData,
  type UTCTimestamp,
  type CreatePriceLineOptions,
  type Logical,
  LineStyle,
  CrosshairMode,
  ColorType,
  type DrawingUtils,
} from 'lightweight-charts'
import type { Candle } from '../../types/candles.ts'
import type { OverlaySegment } from './types.ts'
import { getCandles } from '../../data/api.ts'

const INTERVAL_MS: Record<string, number> = {
  '1m': 60_000,
  '5m': 300_000,
  '15m': 900_000,
  '1h': 3_600_000,
  '4h': 14_400_000,
  '1d': 86_400_000,
}

const SEG_BG: Record<string, string> = {
  'trend-up': 'rgba(0, 255, 133, 0.06)',
  'trend-down': 'rgba(255, 80, 80, 0.06)',
  'high-vol': 'rgba(255, 200, 50, 0.06)',
  'range': 'rgba(100, 150, 255, 0.06)',
  'unknown': 'rgba(128, 128, 128, 0.04)',
}

function toLWData(candles: Candle[]): CandlestickData[] {
  return candles.map(c => ({
    time: (c.t / 1000) as UTCTimestamp,
    open: c.o,
    high: c.h,
    low: c.l,
    close: c.c,
  }))
}

export interface LWChartOptions {
  container: HTMLElement
  candles: Candle[]
  segments: OverlaySegment[]
  asset?: string
  interval?: string
  auction?: {
    profile: {
      poc: number
      valueAreaLow: number
      valueAreaHigh: number
    } | null
  } | null
  plan?: {
    status: string
    side?: string
    entryLow?: number
    entryHigh?: number
    stop?: number
    target?: number
  } | null
}

export interface LWChartInstance {
  updateCandle(candle: Candle): void
  appendCandle(candle: Candle): void
  destroy(): void
}

export function createLWChart(opts: LWChartOptions): LWChartInstance {
  const { container, candles, segments } = opts

  const chart = createChart(container, {
    layout: {
      background: { type: ColorType.Solid, color: 'transparent' },
      textColor: '#8a8f99',
      fontFamily: '"JetBrains Mono", monospace',
      fontSize: 10,
    },
    grid: {
      vertLines: { color: 'rgba(255, 255, 255, 0.04)' },
      horzLines: { color: 'rgba(255, 255, 255, 0.04)' },
    },
    crosshair: {
      mode: CrosshairMode.Normal,
      vertLine: {
        color: 'rgba(0, 255, 133, 0.3)',
        width: 1,
        labelBackgroundColor: '#0a0e14',
      },
      horzLine: {
        color: 'rgba(0, 255, 133, 0.3)',
        width: 1,
        labelBackgroundColor: '#0a0e14',
      },
    },
    timeScale: {
      borderColor: 'rgba(255, 255, 255, 0.08)',
      timeVisible: true,
      secondsVisible: false,
    },
    rightPriceScale: {
      borderColor: 'rgba(255, 255, 255, 0.08)',
    },
  })

  const series = chart.addSeries(CandlestickSeries, {
    upColor: '#00ff85',
    downColor: '#ff5050',
    borderUpColor: '#00ff85',
    borderDownColor: '#ff5050',
    wickUpColor: '#00ff85',
    wickDownColor: '#ff5050',
  })

  series.setData(toLWData(candles))

  let allCandles = [...candles]
  let segmentOffset = 0
  let earliestMs = candles.length > 0 ? candles[0].t : 0
  let loadingHistory = false
  let lastLoadTime = 0
  const BATCH_SIZE = 200

  const asset = opts.asset ?? (new URLSearchParams(window.location.search).get('asset') ?? 'ETH')
  const interval = opts.interval ?? (new URLSearchParams(window.location.search).get('interval') ?? '1h')

  async function tryLoadHistory(): Promise<void> {
    if (loadingHistory) return
    if (performance.now() - lastLoadTime < 3000) return

    const logicalRange = chart.timeScale().getVisibleLogicalRange()
    if (!logicalRange) return
    if (logicalRange.from > 30) return

    const end = earliestMs - 1
    const intervalMs = INTERVAL_MS[interval] ?? 3_600_000
    const start = end - intervalMs * BATCH_SIZE

    loadingHistory = true
    lastLoadTime = performance.now()

    try {
      const res = await getCandles(asset, interval, start, end)
      if (!res.ok) { loadingHistory = false; return }
      const { candles: newCandles } = res.data
      if (newCandles.length === 0) { loadingHistory = false; return }

      const savedLogical = chart.timeScale().getVisibleLogicalRange()
      const newCount = newCandles.length

      allCandles = [...newCandles, ...allCandles]
      segmentOffset += newCount
      earliestMs = newCandles[0].t
      series.setData(toLWData(allCandles))

      if (savedLogical) {
        chart.timeScale().setVisibleLogicalRange({
          from: savedLogical.from + newCount,
          to: savedLogical.to + newCount,
        })
      }
    } catch {
      // history load failed silently — alova handles retry via middleware
    }
    loadingHistory = false
  }

  chart.timeScale().scrollToRealTime()

  function pline(price: number, color: string, title?: string): CreatePriceLineOptions {
    return {
      price,
      color,
      lineStyle: LineStyle.Dashed,
      lineWidth: 1,
      axisLabelVisible: title !== undefined,
      title: title ?? '',
    }
  }

  const plan = opts.plan
  if (plan && plan.status !== 'no-trade') {
    const isLong = plan.side === 'long'
    const base = isLong ? 'rgba(0, 212, 100, ' : 'rgba(255, 80, 80, '

    if (plan.entryLow !== undefined) {
      series.createPriceLine(pline(plan.entryLow, `${base}0.4)`, 'Entry'))
    }
    if (plan.entryHigh !== undefined && plan.entryHigh !== plan.entryLow) {
      series.createPriceLine(pline(plan.entryHigh, `${base}0.4)`))
    }
    if (plan.stop !== undefined) {
      series.createPriceLine(pline(plan.stop, 'rgba(255, 80, 80, 0.6)', 'Stop'))
    }
    if (plan.target !== undefined) {
      series.createPriceLine(pline(plan.target, 'rgba(0, 212, 100, 0.6)', 'Target'))
    }
  }

  const overlayPrimitive = {
    updateAllViews(): void {},
    paneViews() {
      return [{
        zOrder(): 'bottom' { return 'bottom' },
        renderer() {
          return {
            draw(target: { useMediaCoordinateSpace: <T>(f: (scope: { readonly context: CanvasRenderingContext2D; readonly mediaSize: { width: number; height: number } }) => T) => T }, utils?: DrawingUtils): void {
              target.useMediaCoordinateSpace((scope) => {
                const ctx = scope.context
                ctx.clearRect(0, 0, scope.mediaSize.width, scope.mediaSize.height)

                for (const seg of segments) {
                  const segStart = seg.startIndex + segmentOffset
                  const segEnd = seg.endIndex + segmentOffset

                  const x1 = chart.timeScale().logicalToCoordinate(segStart as Logical)
                  const x2 = chart.timeScale().logicalToCoordinate(segEnd as Logical)
                  if (x1 === null || x2 === null) continue

                  const vaHigh = series.priceToCoordinate(seg.valueAreaHigh)
                  const vaLow = series.priceToCoordinate(seg.valueAreaLow)
                  if (vaHigh !== null && vaLow !== null) {
                    const top = Math.min(vaHigh, vaLow)
                    const h = Math.abs(vaLow - vaHigh)
                    if (h > 0) {
                      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)'
                      ctx.fillRect(x1, top, x2 - x1, h)
                    }
                  }

                  const pocY = series.priceToCoordinate(seg.poc)
                  if (pocY !== null) {
                    if (utils) utils.setLineStyle(ctx, LineStyle.Dashed)
                    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)'
                    ctx.lineWidth = 1
                    ctx.beginPath()
                    ctx.moveTo(x1, pocY)
                    ctx.lineTo(x2, pocY)
                    ctx.stroke()
                  }
                }
              })
            },
          }
        },
      }]
    },
  }
  series.attachPrimitive(overlayPrimitive as any)

  const overlay = document.createElement('div')
  overlay.style.cssText = 'position:absolute;top:0;left:0;right:0;bottom:0;pointer-events:none;overflow:hidden'
  container.appendChild(overlay)

  function repositionSegments(): void {
    const visible = chart.timeScale().getVisibleLogicalRange()
    if (!visible) return

    const { from, to } = visible
    const totalW = chart.timeScale().width()
    const pxPerIndex = totalW / Math.max(1, to - from)

    let html = ''
    for (const seg of segments) {
      const segStart = Math.max(from, seg.startIndex + segmentOffset)
      const segEnd = Math.min(to, seg.endIndex + segmentOffset)
      if (segStart >= segEnd) continue

      const left = (segStart - from) * pxPerIndex
      const w = (segEnd - segStart) * pxPerIndex
      const bg = SEG_BG[seg.mode] ?? 'transparent'

      html += `<div style="position:absolute;left:${left}px;top:0;width:${w}px;height:100%;background:${bg};pointer-events:none"></div>`
    }
    overlay.innerHTML = html
  }

  let loadTimer = 0
  const onRangeChange = () => {
    repositionSegments()
    clearTimeout(loadTimer)
    loadTimer = window.setTimeout(tryLoadHistory, 300)
  }
  chart.timeScale().subscribeVisibleTimeRangeChange(onRangeChange)

  return {
    updateCandle(candle: Candle): void {
      series.update({
        time: (candle.t / 1000) as UTCTimestamp,
        open: candle.o,
        high: candle.h,
        low: candle.l,
        close: candle.c,
      })
    },
    appendCandle(candle: Candle): void {
      series.update({
        time: (candle.t / 1000) as UTCTimestamp,
        open: candle.o,
        high: candle.h,
        low: candle.l,
        close: candle.c,
      })
    },
    destroy(): void {
      series.detachPrimitive(overlayPrimitive)
      chart.timeScale().unsubscribeVisibleTimeRangeChange(onRangeChange)
      clearTimeout(loadTimer)
      chart.remove()
      overlay.remove()
    },
  }
}
