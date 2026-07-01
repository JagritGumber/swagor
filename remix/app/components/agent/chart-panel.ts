import type { Candle } from '../../types/candles.ts'
import type { OverlaySegment } from '../chart/types.ts'
import { createChart } from '../chart/create-chart.ts'

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
  const h = canvas.height / dpr

  ctx.save()
  ctx.scale(dpr, dpr)

  const chartWidth = w - 8

  // POC line
  const pocY = scale.priceToY(poc)
  if (pocY !== undefined) {
    ctx.strokeStyle = 'rgba(0, 212, 255, 0.5)'
    ctx.lineWidth = 1
    ctx.setLineDash([4, 4])
    ctx.beginPath()
    ctx.moveTo(0, pocY)
    ctx.lineTo(chartWidth, pocY)
    ctx.stroke()
    ctx.setLineDash([])

    ctx.fillStyle = 'rgba(0, 212, 255, 0.8)'
    ctx.font = '10px JetBrains Mono, monospace'
    ctx.textAlign = 'right'
    ctx.fillText(`POC ${poc.toFixed(2)}`, chartWidth - 4, pocY - 4)
  }

  // Value area shading
  const vaHighY = scale.priceToY(valueAreaHigh)
  const vaLowY = scale.priceToY(valueAreaLow)
  if (vaHighY !== undefined && vaLowY !== undefined) {
    ctx.fillStyle = 'rgba(0, 212, 255, 0.04)'
    ctx.fillRect(0, vaHighY, chartWidth, vaLowY - vaHighY)

    ctx.strokeStyle = 'rgba(0, 212, 255, 0.2)'
    ctx.lineWidth = 1
    ctx.setLineDash([2, 4])
    ctx.beginPath()
    ctx.moveTo(0, vaHighY)
    ctx.lineTo(chartWidth, vaHighY)
    ctx.moveTo(0, vaLowY)
    ctx.lineTo(chartWidth, vaLowY)
    ctx.stroke()
    ctx.setLineDash([])
  }

  // Volume profile sidebar
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

        ctx.fillStyle = 'rgba(0, 212, 255, 0.6)'
        ctx.fillRect(profileX + profileWidth - barWidth, y, barWidth, barHeight)
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
  const h = canvas.height / dpr

  ctx.save()
  ctx.scale(dpr, dpr)

  const chartWidth = w - 8
  const isLong = side === 'long'
  const color = isLong ? 'rgba(0, 212, 100' : 'rgba(255, 80, 80'

  // Entry zone band
  const entryHighY = scale.priceToY(entryHigh)
  const entryLowY = scale.priceToY(entryLow)
  if (entryHighY !== undefined && entryLowY !== undefined) {
    ctx.fillStyle = `${color}, 0.08)`
    ctx.fillRect(0, entryHighY, chartWidth, entryLowY - entryHighY)

    ctx.strokeStyle = `${color}, 0.4)`
    ctx.lineWidth = 1
    ctx.setLineDash([6, 3])
    ctx.beginPath()
    ctx.moveTo(0, entryHighY)
    ctx.lineTo(chartWidth, entryHighY)
    ctx.moveTo(0, entryLowY)
    ctx.lineTo(chartWidth, entryLowY)
    ctx.stroke()
    ctx.setLineDash([])

    // Entry label
    ctx.fillStyle = `${color}, 0.8)`
    ctx.font = '10px JetBrains Mono, monospace'
    ctx.textAlign = 'right'
    const entryMidY = (entryHighY + entryLowY) / 2
    ctx.fillText(`ENTRY ${entryLow.toFixed(2)}-${entryHigh.toFixed(2)}`, chartWidth - 4, entryMidY + 3)
  }

  // Stop level
  if (stop !== undefined) {
    const stopY = scale.priceToY(stop)
    if (stopY !== undefined) {
      ctx.strokeStyle = 'rgba(255, 80, 80, 0.6)'
      ctx.lineWidth = 1
      ctx.setLineDash([4, 4])
      ctx.beginPath()
      ctx.moveTo(0, stopY)
      ctx.lineTo(chartWidth, stopY)
      ctx.stroke()
      ctx.setLineDash([])

      ctx.fillStyle = 'rgba(255, 80, 80, 0.8)'
      ctx.font = '10px JetBrains Mono, monospace'
      ctx.textAlign = 'right'
      ctx.fillText(`STOP ${stop.toFixed(2)}`, chartWidth - 4, stopY - 4)
    }
  }

  // Target level
  if (target !== undefined) {
    const targetY = scale.priceToY(target)
    if (targetY !== undefined) {
      ctx.strokeStyle = 'rgba(0, 212, 100, 0.6)'
      ctx.lineWidth = 1
      ctx.setLineDash([4, 4])
      ctx.beginPath()
      ctx.moveTo(0, targetY)
      ctx.lineTo(chartWidth, targetY)
      ctx.stroke()
      ctx.setLineDash([])

      ctx.fillStyle = 'rgba(0, 212, 100, 0.8)'
      ctx.font = '10px JetBrains Mono, monospace'
      ctx.textAlign = 'right'
      ctx.fillText(`TARGET ${target.toFixed(2)}`, chartWidth - 4, targetY - 4)
    }
  }

  ctx.restore()
}
