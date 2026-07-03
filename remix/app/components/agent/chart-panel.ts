// status: Unused — replaced by lightweight-charts lw-chart.ts
import type { Candle } from '../../types/candles.ts'
import type { OverlaySegment } from '../chart/types.ts'
import { createChart } from '../chart/create-chart.ts'
import { rect, line, label } from '../chart/draw.ts'

const MONO = '10px "JetBrains Mono", monospace'

interface AgentAuction {
  profile: {
    poc: number
    valueAreaLow: number
    valueAreaHigh: number
    bins: { low: number; high: number; volume: number }[]
  } | null
}

interface AgentTradePlan {
  status: string
  side?: string
  entryLow?: number
  entryHigh?: number
  stop?: number
  target?: number
}

interface ChartPanelOptions {
  container: HTMLElement
  candles: Candle[]
  segments: OverlaySegment[]
  auction: AgentAuction | null
  plan: AgentTradePlan | null
}

function computeScale(candles: Candle[], width: number, height: number) {
  if (candles.length === 0) return null

  const padding = { top: 16, right: 8, bottom: 28, left: 8 }
  const totalH = height - padding.top - padding.bottom

  let minPrice = Infinity
  let maxPrice = -Infinity
  for (const c of candles) {
    if (c.h > maxPrice) maxPrice = c.h
    if (c.l < minPrice) minPrice = c.l
  }

  const priceRange = maxPrice - minPrice || 1
  const paddedMin = minPrice - priceRange * 0.05
  const paddedMax = maxPrice + priceRange * 0.05

  return {
    priceToY(price: number): number | undefined {
      const ratio = (price - paddedMin) / (paddedMax - paddedMin)
      const y = padding.top + (1 - ratio) * totalH
      if (y < padding.top || y > height - padding.bottom) return undefined
      return y
    },
  }
}

export function createAgentChart({ container, candles, segments, auction, plan }: ChartPanelOptions) {
  const chart = createChart({
    container,
    candles,
    segments,
  })

  chart.render()

  if (candles.length > 0) {
    const rect = container.getBoundingClientRect()
    const scale = computeScale(candles, rect.width, rect.height)
    if (scale) {
      if (auction && auction.profile) {
        drawAuctionOverlays(container, auction, scale)
      }
      if (plan && plan.status !== 'no-trade') {
        drawTradePlanOverlays(container, plan, scale)
      }
    }
  }

  return chart
}

function drawAuctionOverlays(
  container: HTMLElement,
  auction: AgentAuction,
  scale: { priceToY(price: number): number | undefined },
) {
  const canvas = container.querySelector('canvas')
  if (!canvas) return

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  if (!auction.profile) return

  const { poc, valueAreaLow, valueAreaHigh, bins } = auction.profile

  const dpr = window.devicePixelRatio || 1
  const w = canvas.width / dpr

  ctx.save()
  ctx.scale(dpr, dpr)

  const chartWidth = w - 8
  const cyan = 'rgba(0, 212, 255,'

  const pocY = scale.priceToY(poc)
  if (pocY !== undefined) {
    line(ctx).from(0, pocY).to(chartWidth, pocY).color(`${cyan} 0.5)`).width(1).dash([4, 4]).stroke()
    label(ctx).at(chartWidth - 4, pocY - 4).text(`POC ${poc.toFixed(2)}`).color(`${cyan} 0.8)`).font(MONO).align('right').draw()
  }

  const vaHighY = scale.priceToY(valueAreaHigh)
  const vaLowY = scale.priceToY(valueAreaLow)
  if (vaHighY !== undefined && vaLowY !== undefined) {
    rect(ctx).x(0).y(vaHighY).w(chartWidth).h(vaLowY - vaHighY).color(`${cyan} 0.04)`).fill()
    line(ctx).from(0, vaHighY).to(chartWidth, vaHighY).color(`${cyan} 0.2)`).width(1).dash([2, 4]).stroke()
    line(ctx).from(0, vaLowY).to(chartWidth, vaLowY).color(`${cyan} 0.2)`).width(1).dash([2, 4]).stroke()
  }

  if (bins.length > 0) {
    const maxVolume = Math.max(...bins.map(b => b.volume))
    if (maxVolume > 0) {
      const profileWidth = 50
      const profileX = chartWidth - profileWidth

      ctx.globalAlpha = 0.3
      for (const bin of bins) {
        const y = scale.priceToY(bin.high)
        const yLow = scale.priceToY(bin.low)
        if (y === undefined || yLow === undefined) continue

        const barHeight = Math.max(1, yLow - y)
        const barWidth = (bin.volume / maxVolume) * profileWidth

        rect(ctx).x(profileX + profileWidth - barWidth).y(y).w(barWidth).h(barHeight).color(`${cyan} 0.6)`).fill()
      }
      ctx.globalAlpha = 1
    }
  }

  ctx.restore()
}

function drawTradePlanOverlays(
  container: HTMLElement,
  plan: AgentTradePlan,
  scale: { priceToY(price: number): number | undefined },
) {
  const canvas = container.querySelector('canvas')
  if (!canvas) return

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const { side, entryLow, entryHigh, stop, target } = plan
  if (entryLow === undefined || entryHigh === undefined) return

  const dpr = window.devicePixelRatio || 1
  const w = canvas.width / dpr

  ctx.save()
  ctx.scale(dpr, dpr)

  const chartWidth = w - 8
  const isLong = side === 'long'
  const base = isLong ? 'rgba(0, 212, 100' : 'rgba(255, 80, 80'

  const entryHighY = scale.priceToY(entryHigh)
  const entryLowY = scale.priceToY(entryLow)
  if (entryHighY !== undefined && entryLowY !== undefined) {
    rect(ctx).x(0).y(entryHighY).w(chartWidth).h(entryLowY - entryHighY).color(`${base}, 0.08)`).fill()
    line(ctx).from(0, entryHighY).to(chartWidth, entryHighY).color(`${base}, 0.4)`).width(1).dash([6, 3]).stroke()
    line(ctx).from(0, entryLowY).to(chartWidth, entryLowY).color(`${base}, 0.4)`).width(1).dash([6, 3]).stroke()
    const entryMidY = (entryHighY + entryLowY) / 2
    label(ctx).at(chartWidth - 4, entryMidY + 3).text(`ENTRY ${entryLow.toFixed(2)}-${entryHigh.toFixed(2)}`).color(`${base}, 0.8)`).font(MONO).align('right').draw()
  }

  if (stop !== undefined) {
    const stopY = scale.priceToY(stop)
    if (stopY !== undefined) {
      line(ctx).from(0, stopY).to(chartWidth, stopY).color('rgba(255, 80, 80, 0.6)').width(1).dash([4, 4]).stroke()
      label(ctx).at(chartWidth - 4, stopY - 4).text(`STOP ${stop.toFixed(2)}`).color('rgba(255, 80, 80, 0.8)').font(MONO).align('right').draw()
    }
  }

  if (target !== undefined) {
    const targetY = scale.priceToY(target)
    if (targetY !== undefined) {
      line(ctx).from(0, targetY).to(chartWidth, targetY).color('rgba(0, 212, 100, 0.6)').width(1).dash([4, 4]).stroke()
      label(ctx).at(chartWidth - 4, targetY - 4).text(`TARGET ${target.toFixed(2)}`).color('rgba(0, 212, 100, 0.8)').font(MONO).align('right').draw()
    }
  }

  ctx.restore()
}
