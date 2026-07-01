import type { Candle } from '../../types/candles.ts'
import type { ChartConfig, OverlaySegment, Scale } from './types.ts'
import type { ReaderMarketRegimeMode } from '@packages/strategy-lab/read-core/market-regime/types'
import { rect, line, text, label } from './draw.ts'

const MONO_FONT = '10px "JetBrains Mono", ui-monospace, monospace'

function css(name: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  if (value === '') throw new Error(`Missing CSS custom property: ${name}`)
  return value
}

const segColors: Record<ReaderMarketRegimeMode, string> = {
  'trend-up': css('--seg-trend-up'),
  'trend-down': css('--seg-trend-down'),
  'high-vol': css('--seg-high-vol'),
  'range': css('--seg-range'),
  'unknown': css('--seg-unknown'),
}

const C = {
  bg: css('--chart-bg'),
  up: css('--candle-up'),
  down: css('--candle-down'),
  label: css('--chart-label'),
  dash: css('--chart-dash'),
  vaBg: css('--chart-va-bg'),
  seg: segColors,
}

function buildScale(
  candles: Candle[],
  config: ChartConfig,
  pxPerCandle: number,
  scrollPx: number,
  fixedMin?: number,
  fixedMax?: number,
  yScrollPx?: number,
  yZoom?: number,
): Scale {
  const { width, height, padding } = config
  const totalW = width - padding.left - padding.right
  const totalH = height - padding.top - padding.bottom
  const count = candles.length

  const firstVisible = Math.max(0, Math.floor(scrollPx / pxPerCandle))
  const lastVisible = Math.min(count - 1, Math.ceil((scrollPx + totalW) / pxPerCandle))

  let maxPrice: number
  let minPrice: number

  if (fixedMin !== undefined && fixedMax !== undefined) {
    maxPrice = fixedMax
    minPrice = fixedMin
  } else {
    maxPrice = -Infinity
    minPrice = Infinity
    for (let i = firstVisible; i <= lastVisible && i < count; i++) {
      const c = candles[i]
      if (c.h > maxPrice) maxPrice = c.h
      if (c.l < minPrice) minPrice = c.l
    }
    if (maxPrice === -Infinity) { maxPrice = 0; minPrice = 0 }
  }

  const priceRange = maxPrice - minPrice || 1
  let paddedMin = minPrice - priceRange * 0.05
  let paddedMax = maxPrice + priceRange * 0.05

  const center = (paddedMin + paddedMax) / 2
  const halfRange = (paddedMax - paddedMin) / 2
  const zoom = yZoom ?? 1
  const zoomedHalf = halfRange / zoom
  paddedMin = center - zoomedHalf
  paddedMax = center + zoomedHalf

  if (yScrollPx !== undefined && yScrollPx !== 0) {
    const shiftPerPx = (paddedMax - paddedMin) / totalH
    paddedMin -= yScrollPx * shiftPerPx
    paddedMax -= yScrollPx * shiftPerPx
  }

  const range = paddedMax - paddedMin || 1
  const candleWidth = Math.max(1, pxPerCandle * 0.7)

  return {
    xStep: pxPerCandle,
    candleWidth,
    x: (i: number) => padding.left + i * pxPerCandle - scrollPx + pxPerCandle / 2,
    y: (price: number) => padding.top + totalH * (paddedMax - price) / range,
    yInverse: (pixel: number) => paddedMax - (pixel - padding.top) * range / totalH,
    minPrice: paddedMin,
    maxPrice: paddedMax,
  }
}

function niceStep(range: number, targetLabels: number): number {
  const roughStep = range / targetLabels
  const magnitude = 10 ** Math.floor(Math.log10(roughStep))
  const residual = roughStep / magnitude
  const nice = residual <= 1.5 ? 1 : residual <= 3 ? 2 : residual <= 7 ? 5 : 10
  return nice * magnitude
}

function formatLabel(n: number): string {
  if (n >= 1000) return n.toFixed(0)
  if (n >= 1) return n.toFixed(2)
  if (n >= 0.01) return n.toFixed(4)
  return n.toFixed(6)
}

function formatTime(ts: number): string {
  const d = new Date(ts)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${mm}/${dd} ${hh}:${mi}`
}

export function renderChart(
  ctx: CanvasRenderingContext2D,
  candles: Candle[],
  segments: OverlaySegment[],
  currentPrice: number | undefined,
  config: ChartConfig,
  pxPerCandle: number,
  scrollPx: number,
  crosshair?: { x: number; y: number },
  yMin?: number,
  yMax?: number,
  yScrollPx?: number,
  yZoom?: number,
): void {
  const scale = buildScale(candles, config, pxPerCandle, scrollPx, yMin, yMax, yScrollPx, yZoom)
  const { width, height, padding } = config
  const totalW = width - padding.left - padding.right
  const plotBottom = height - padding.bottom
  const count = candles.length

  const firstVisible = Math.max(0, Math.floor(scrollPx / pxPerCandle))
  const lastVisible = Math.min(count - 1, Math.ceil((scrollPx + totalW) / pxPerCandle))

  rect(ctx).x(0).y(0).w(width).h(height).color(C.bg).fill()

  for (const seg of segments) {
    const x1 = scale.x(seg.startIndex)
    const x2 = scale.x(seg.endIndex) + pxPerCandle
    const w = x2 - x1
    if (x2 < padding.left || x1 > width - padding.right) continue

    const segHigh = seg.high ?? (() => {
      let h = -Infinity
      for (let i = seg.startIndex; i <= seg.endIndex && i < count; i++) { if (candles[i].h > h) h = candles[i].h }
      return h
    })()
    const segLow = seg.low ?? (() => {
      let l = Infinity
      for (let i = seg.startIndex; i <= seg.endIndex && i < count; i++) { if (candles[i].l < l) l = candles[i].l }
      return l
    })()

    if (segHigh !== -Infinity) {
      const pad = (segHigh - segLow) * 0.05 || 1
      rect(ctx).x(x1).y(scale.y(segHigh + pad)).w(w).h(scale.y(segLow - pad) - scale.y(segHigh + pad)).color(C.seg[seg.mode]).fill()
    }

    if (seg.valueAreaHigh && seg.valueAreaLow) {
      rect(ctx).x(x1).y(scale.y(seg.valueAreaHigh)).w(w).h(scale.y(seg.valueAreaLow) - scale.y(seg.valueAreaHigh)).color(C.vaBg).fill()
    }

    if (seg.poc) {
      line(ctx).from(x1, scale.y(seg.poc)).to(x2, scale.y(seg.poc)).color(C.dash).dash([4, 4]).stroke()
    }
  }

  for (let i = firstVisible; i <= lastVisible; i++) {
    const c = candles[i]
    const cx = scale.x(i)
    const cw = scale.candleWidth
    const isUp = c.c >= c.o
    const clr = isUp ? C.up : C.down
    const wickW = Math.max(1, cw * 0.15)
    const yHigh = scale.y(c.h)
    const yLow = scale.y(c.l)

    rect(ctx).x(cx - wickW / 2).y(yHigh).w(wickW).h(yLow - yHigh).color(clr).fill()
    const bodyTop = isUp ? scale.y(c.c) : scale.y(c.o)
    const bodyBottom = isUp ? scale.y(c.o) : scale.y(c.c)
    rect(ctx).x(cx - cw / 2).y(bodyTop).w(cw).h(Math.max(1, bodyBottom - bodyTop)).color(clr).fill()
  }

  if (currentPrice !== undefined) {
    const py = scale.y(currentPrice)
    if (py >= padding.top && py <= plotBottom) {
      line(ctx).from(padding.left, py).to(width - padding.right, py).color(C.up).stroke()
    }
  }

  const step = niceStep(scale.maxPrice - scale.minPrice, 6)
  const firstLabel = Math.ceil(scale.minPrice / step) * step
  const labelX = width - padding.right - 4
  for (let price = firstLabel; price <= scale.maxPrice; price += step) {
    const y = scale.y(price)
    if (y >= padding.top && y <= plotBottom) {
      label(ctx).at(labelX, y).text(formatLabel(price)).color(C.label).font(MONO_FONT).align('right').draw()
    }
  }

  if (count > 1) {
    const visibleCount = lastVisible - firstVisible + 1
    const timeLabelCount = Math.min(6, visibleCount)
    if (timeLabelCount > 1) {
      const timeY = height - 6
      for (let i = 0; i < timeLabelCount; i++) {
        const idx = firstVisible + Math.round(i * (lastVisible - firstVisible) / (timeLabelCount - 1))
        const ci = Math.max(0, Math.min(idx, count - 1))
        const px = scale.x(ci)
        line(ctx).from(px, plotBottom).to(px, plotBottom + 4).color(C.label).stroke()
        text(ctx).at(px, timeY).content(formatTime(candles[ci].t)).color(C.label).font(MONO_FONT).align('center').baseline('bottom').draw()
      }
    }
  }

  if (crosshair) {
    const chX = Math.max(padding.left, Math.min(width - padding.right, crosshair.x))
    const chY = Math.max(padding.top, Math.min(plotBottom, crosshair.y))

    line(ctx).from(chX, padding.top).to(chX, plotBottom).color(C.up).width(1).stroke()
    line(ctx).from(padding.left, chY).to(width - padding.right, chY).color(C.up).width(1).stroke()

    const chPrice = scale.yInverse(chY)
    label(ctx).at(width - padding.right - 4, chY).text(formatLabel(chPrice)).color(C.up).font(MONO_FONT).align('right').draw()

    const chIdx = Math.round((chX - padding.left + scrollPx - pxPerCandle / 2) / pxPerCandle)
    const chCi = Math.max(0, Math.min(chIdx, count - 1))
    text(ctx).at(chX, height - 6).content(formatTime(candles[chCi].t)).color(C.up).font(MONO_FONT).align('center').baseline('bottom').draw()
  }
}
