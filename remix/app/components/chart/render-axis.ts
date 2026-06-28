import type { ChartConfig, Scale } from './types.ts'
import { FONT_DATA } from '../../constants/theme.ts'

function formatLabel(n: number): string {
  if (n >= 1000) return n.toFixed(0)
  if (n >= 1) return n.toFixed(2)
  if (n >= 0.01) return n.toFixed(4)
  return n.toFixed(6)
}

export function renderAxis(
  ctx: CanvasRenderingContext2D,
  scale: Scale,
  config: ChartConfig,
): void {
  const { maxPrice, minPrice } = scale
  const labelCount = 6
  const step = (maxPrice - minPrice) / (labelCount - 1)

  ctx.fillStyle = 'oklch(1 0 0 / 0.5)'
  ctx.font = `10px ${FONT_DATA}`
  ctx.textAlign = 'right'
  ctx.textBaseline = 'middle'

  const x = config.width - config.padding.right - 4

  for (let i = 0; i < labelCount; i++) {
    const price = maxPrice - step * i
    const y = scale.y(price)
    ctx.fillText(formatLabel(price), x, y)
  }
}
