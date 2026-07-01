import type { Candle } from '../../types/candles.ts'
import type { OverlaySegment } from '../chart/types.ts'
import { createChart } from '../chart/create-chart.ts'

interface AgentAuction {
  poc: number
  valueAreaLow: number
  valueAreaHigh: number
  bins: { low: number; high: number; volume: number }[]
}

interface ChartPanelOptions {
  container: HTMLElement
  candles: Candle[]
  segments: OverlaySegment[]
  auction: AgentAuction | null
}

function computeScale(candles: Candle[], width: number, height: number) {
  if (candles.length === 0) return null

  const padding = { top: 16, right: 60, bottom: 28, left: 8 }
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

export function createAgentChart({ container, candles, segments, auction }: ChartPanelOptions) {
  const chart = createChart({
    container,
    candles,
    segments,
  })

  chart.render()

  if (auction && candles.length > 0) {
    const rect = container.getBoundingClientRect()
    const scale = computeScale(candles, rect.width, rect.height)
    if (scale) {
      drawAgentOverlays(container, auction, scale)
    }
  }

  return chart
}

function drawAgentOverlays(
  container: HTMLElement,
  auction: AgentAuction,
  scale: { priceToY(price: number): number | undefined },
) {
  const canvas = container.querySelector('canvas')
  if (!canvas) return

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const { poc, valueAreaLow, valueAreaHigh, bins } = auction

  const draw = () => {
    const dpr = window.devicePixelRatio || 1
    const w = canvas.width / dpr
    const h = canvas.height / dpr

    ctx.save()
    ctx.scale(dpr, dpr)

    const chartWidth = w - 60

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

  draw()
}
