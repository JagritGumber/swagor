// status: Active — lightweight-charts chart wrapper

import {
  createChart,
  CandlestickSeries,
  type CandlestickData,
  type UTCTimestamp,
  type CreatePriceLineOptions,
  LineStyle,
  CrosshairMode,
  ColorType,
} from 'lightweight-charts'
import type { Candle } from '../../types/candles.ts'
import type { OverlaySegment } from './types.ts'

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

  const auction = opts.auction?.profile
  if (auction) {
    const c = 'rgba(0, 212, 255, '
    series.createPriceLine(pline(auction.poc, `${c}0.5)`, 'POC'))
    series.createPriceLine(pline(auction.valueAreaHigh, `${c}0.2)`))
    series.createPriceLine(pline(auction.valueAreaLow, `${c}0.2)`))
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
      const segStart = Math.max(from, seg.startIndex)
      const segEnd = Math.min(to, seg.endIndex)
      if (segStart >= segEnd) continue

      const left = (segStart - from) * pxPerIndex
      const w = (segEnd - segStart) * pxPerIndex
      const bg = SEG_BG[seg.mode] ?? 'transparent'

      html += `<div style="position:absolute;left:${left}px;top:0;width:${w}px;height:100%;background:${bg};pointer-events:none"></div>`
    }
    overlay.innerHTML = html
  }

  const onRangeChange = () => repositionSegments()
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
      chart.timeScale().unsubscribeVisibleTimeRangeChange(onRangeChange)
      chart.remove()
      overlay.remove()
    },
  }
}
