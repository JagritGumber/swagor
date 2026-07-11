// status: Active - lightweight-charts chart wrapper

import {
  createChart,
  CandlestickSeries,
  type CandlestickData,
  type UTCTimestamp,
  type CreatePriceLineOptions,
  LineStyle,
  CrosshairMode,
  ColorType,
  type DrawingUtils,
} from 'lightweight-charts'
import type { Candle } from '@shared/candle'
import type { OverlaySegment } from './types.ts'
import { getCandles } from '@/data/api'

const INTERVAL_MS: Record<string, number> = {
  '1m': 60_000,
  '5m': 300_000,
  '15m': 900_000,
  '1h': 3_600_000,
  '4h': 14_400_000,
  '1d': 86_400_000,
}

const SEG_BG: Record<string, string> = {
  'trend-up': 'rgba(0, 212, 255, 0.06)',
  'trend-down': 'rgba(255, 80, 80, 0.06)',
  'high-vol': 'rgba(255, 200, 50, 0.06)',
  'range': 'rgba(100, 150, 255, 0.06)',
  'unknown': 'rgba(128, 128, 128, 0.04)',
}

const HISTOGRAM_COLOR: Record<string, string> = {
  'trend-up': 'rgba(0, 212, 255, 0.25)',
  'trend-down': 'rgba(255, 80, 80, 0.25)',
  'high-vol': 'rgba(255, 200, 50, 0.25)',
  'range': 'rgba(100, 150, 255, 0.25)',
  'unknown': 'rgba(128, 128, 128, 0.15)',
}

const HISTOGRAM_WIDTH_PX = 50

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

function parseRGBA(color: string): [number, number, number, number] {
  const m = color.match(/[\d.]+/g)
  if (!m || m.length < 4) return [255, 255, 255, 0.25]
  return [Number(m[0]), Number(m[1]), Number(m[2]), Number(m[3])]
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h = 0
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
  else if (max === g) h = ((b - r) / d + 2) / 6
  else h = ((r - g) / d + 4) / 6
  return [h, s, l]
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) { const v = Math.round(l * 255); return [v, v, v] }
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1; if (t > 1) t -= 1
    if (t < 1/6) return p + (q - p) * 6 * t
    if (t < 1/2) return q
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6
    return p
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  return [
    Math.round(hue2rgb(p, q, h + 1/3) * 255),
    Math.round(hue2rgb(p, q, h) * 255),
    Math.round(hue2rgb(p, q, h - 1/3) * 255),
  ]
}

function drawHistogramBars(
  ctx: CanvasRenderingContext2D,
  x1: number,
  x2: number,
  bins: { low: number; high: number; mid: number; volume: number }[],
  series: { priceToCoordinate: (price: number) => number | null },
  color: string,
  poc: number,
): void {
  if (bins.length === 0) return

  const maxVolume = Math.max(...bins.map(b => b.volume))
  if (maxVolume <= 0) return

  const [r, g, b, baseAlpha] = parseRGBA(color)
  const [hue, sat, lit] = rgbToHsl(r, g, b)

  const barAreaWidth = HISTOGRAM_WIDTH_PX
  const barAreaX = x2 - barAreaWidth
  const gap = 1

  const profileLow = bins[0].low
  const profileHigh = bins[bins.length - 1].high
  const halfRange = Math.max(poc - profileLow, profileHigh - poc, 1)

  for (const bin of bins) {
    const yHigh = series.priceToCoordinate(bin.high)
    const yLow = series.priceToCoordinate(bin.low)
    if (yHigh === null || yLow === null) continue

    const top = Math.min(yHigh, yLow)
    const barHeight = Math.max(1, Math.abs(yLow - yHigh) - gap)
    const barWidth = (bin.volume / maxVolume) * barAreaWidth

    if (barWidth < 0.5) continue

    const dist = Math.abs(bin.mid - poc) / halfRange
    const t = dist * dist

    const edgeHue = hue + 0.08
    const cr = hue + (edgeHue - hue) * t
    const cs = sat * (1 - t * 0.5)
    const cl = lit * (1 - t * 0.45)
    const ca = baseAlpha * (1 - t * 0.3)

    const [rr, gg, bb] = hslToRgb(cr, cs, cl)
    ctx.fillStyle = `rgba(${rr}, ${gg}, ${bb}, ${ca.toFixed(3)})`
    ctx.fillRect(barAreaX + barAreaWidth - barWidth, top, barWidth, barHeight)
  }
}

function drawPOCFallback(
  ctx: CanvasRenderingContext2D,
  x1: number,
  x2: number,
  poc: number,
  valueAreaLow: number,
  valueAreaHigh: number,
  series: { priceToCoordinate: (price: number) => number | null },
  color: string,
): void {
  const pocY = series.priceToCoordinate(poc)
  if (pocY === null) return

  const vaHighY = series.priceToCoordinate(valueAreaHigh)
  const vaLowY = series.priceToCoordinate(valueAreaLow)

  const fallbackColor = color.replace(/[\d.]+\)$/, '0.15)')

  if (vaHighY !== null && vaLowY !== null) {
    const top = Math.min(vaHighY, vaLowY)
    const h = Math.abs(vaLowY - vaHighY)
    if (h > 0) {
      ctx.fillStyle = fallbackColor
      const barW = 4
      ctx.fillRect(x2 - barW, top, barW, h)
    }
  }

  ctx.fillStyle = color
  const dotR = 2
  ctx.beginPath()
  ctx.arc(x2 - 2, pocY, dotR, 0, Math.PI * 2)
  ctx.fill()
}

function calcATR(candles: Candle[], period = 14): number {
  if (candles.length < 2) return 0
  const trs: number[] = []
  for (let i = 1; i < candles.length; i++) {
    const c = candles[i]
    const prev = candles[i - 1]
    const tr = Math.max(c.h - c.l, Math.abs(c.h - prev.c), Math.abs(c.l - prev.c))
    trs.push(tr)
  }
  if (trs.length === 0) return 0
  const slice = trs.slice(-period)
  return slice.reduce((s, v) => s + v, 0) / slice.length
}

function pricePrecision(atr: number): { precision: number; minMove: number } {
  if (atr >= 100) return { precision: 2, minMove: 0.01 }
  if (atr >= 10) return { precision: 3, minMove: 0.001 }
  if (atr >= 1) return { precision: 4, minMove: 0.0001 }
  if (atr >= 0.1) return { precision: 5, minMove: 0.00001 }
  return { precision: 6, minMove: 0.000001 }
}

export function createLWChart(opts: LWChartOptions): LWChartInstance {
  const { container, candles, segments } = opts

  const atr = calcATR(candles)
  const { precision, minMove } = pricePrecision(atr)
  const priceScaleWidth = atr < 1 ? 100 : 70

  const chart = createChart(container, {
    layout: {
      background: { type: ColorType.Solid, color: '#131722' },
      textColor: '#6b7280',
      fontFamily: '"JetBrains Mono", monospace',
      fontSize: 10,
    },
    grid: {
      vertLines: { color: 'rgba(99, 130, 190, 0.06)' },
      horzLines: { color: 'rgba(99, 130, 190, 0.06)' },
    },
    crosshair: {
      mode: CrosshairMode.Normal,
      vertLine: {
        color: 'rgba(99, 179, 237, 0.4)',
        width: 1,
        labelBackgroundColor: '#1a2332',
      },
      horzLine: {
        color: 'rgba(99, 179, 237, 0.4)',
        width: 1,
        labelBackgroundColor: '#1a2332',
      },
    },
    timeScale: {
      borderColor: 'rgba(99, 130, 190, 0.1)',
      timeVisible: true,
      secondsVisible: false,
    },
    rightPriceScale: {
      borderColor: 'rgba(99, 130, 190, 0.1)',
      minimumWidth: priceScaleWidth,
    },
  })

  const series = chart.addSeries(CandlestickSeries, {
    upColor: '#00d4ff',
    downColor: '#ff5050',
    borderUpColor: '#00d4ff',
    borderDownColor: '#ff5050',
    wickUpColor: '#00d4ff',
    wickDownColor: '#ff5050',
    priceFormat: { type: 'price', precision, minMove },
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
    if (earliestMs === 0) return

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
      // history load failed silently - alova handles retry via middleware
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

                const visible = chart.timeScale().getVisibleLogicalRange()
                if (!visible) return

                const { from, to } = visible
                const totalW = chart.timeScale().width()
                const pxPerIndex = totalW / Math.max(1, to - from)

                for (const seg of segments) {
                  const segStart = seg.startIndex + segmentOffset
                  const segEnd = seg.endIndex + segmentOffset

                  if (segEnd < from || segStart > to) continue

                  const x1 = (segStart - from) * pxPerIndex
                  const x2 = (segEnd - from) * pxPerIndex

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

                  const segColor = HISTOGRAM_COLOR[seg.mode] ?? HISTOGRAM_COLOR['unknown']
                  if (seg.bins && seg.bins.length > 0) {
                    ctx.save()
                    ctx.beginPath()
                    ctx.rect(x1, 0, x2 - x1, scope.mediaSize.height)
                    ctx.clip()
                    drawHistogramBars(ctx, x1, x2, seg.bins, series, segColor, seg.poc)
                    ctx.restore()
                  } else {
                    drawPOCFallback(ctx, x1, x2, seg.poc, seg.valueAreaLow, seg.valueAreaHigh, series, segColor)
                  }
                }
              })
            },
          }
        },
      }]
    },
  }
  series.attachPrimitive(overlayPrimitive as never)

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

  requestAnimationFrame(() => repositionSegments())

  const resizeObserver = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const { width, height } = entry.contentRect
      if (width > 0 && height > 0) {
        chart.resize(width, height)
      }
    }
  })
  resizeObserver.observe(container)

  return {
    updateCandle(candle: Candle): void {
      const time = (candle.t / 1000) as UTCTimestamp
      const earliestSec = allCandles.length > 0 ? allCandles[0].t / 1000 : 0
      if ((time as number) < earliestSec) return
      series.update({
        time,
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
      resizeObserver.disconnect()
      series.detachPrimitive(overlayPrimitive as never)
      chart.timeScale().unsubscribeVisibleTimeRangeChange(onRangeChange)
      clearTimeout(loadTimer)
      chart.remove()
      overlay.remove()
    },
  }
}
