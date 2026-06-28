import type { ChartConfig, Scale } from './types.ts'
import { ACCENT_GREEN } from '../../constants/theme.ts'

export function renderValueArea(
  ctx: CanvasRenderingContext2D,
  vaLow: number,
  vaHigh: number,
  scale: Scale,
  config: ChartConfig,
): void {
  const yLow = scale.y(vaLow)
  const yHigh = scale.y(vaHigh)
  ctx.fillStyle = 'oklch(1 0 0 / 0.03)'
  ctx.fillRect(
    config.padding.left,
    yHigh,
    config.width - config.padding.left - config.padding.right,
    yLow - yHigh,
  )
}

export function renderPoc(
  ctx: CanvasRenderingContext2D,
  poc: number,
  scale: Scale,
  config: ChartConfig,
): void {
  const y = scale.y(poc)
  ctx.strokeStyle = 'oklch(1 0 0 / 0.4)'
  ctx.lineWidth = 1
  ctx.setLineDash([4, 4])
  ctx.beginPath()
  ctx.moveTo(config.padding.left, y)
  ctx.lineTo(config.width - config.padding.right, y)
  ctx.stroke()
  ctx.setLineDash([])
}

export function renderRegimeBands(
  ctx: CanvasRenderingContext2D,
  regimeMode: string,
  scale: Scale,
  config: ChartConfig,
): void {
  let color: string
  switch (regimeMode) {
    case 'trend-up':
      color = 'oklch(0.6 0.2 150 / 0.05)'
      break
    case 'trend-down':
      color = 'oklch(0.6 0.2 30 / 0.05)'
      break
    case 'high-vol':
      color = 'oklch(0.7 0.15 80 / 0.05)'
      break
    default:
      color = 'oklch(0.5 0.05 260 / 0.03)'
      break
  }
  ctx.fillStyle = color
  ctx.fillRect(
    config.padding.left,
    config.padding.top,
    config.width - config.padding.left - config.padding.right,
    config.height - config.padding.top - config.padding.bottom,
  )
}

export function renderPriceMarker(
  ctx: CanvasRenderingContext2D,
  price: number,
  scale: Scale,
  config: ChartConfig,
): void {
  const y = scale.y(price)
  ctx.strokeStyle = ACCENT_GREEN
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(config.padding.left, y)
  ctx.lineTo(config.width - config.padding.right, y)
  ctx.stroke()
}
