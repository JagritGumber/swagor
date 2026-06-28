import type { ChartConfig, Scale, OverlaySegment } from './types.ts'
import { ACCENT_GREEN } from '../../constants/theme.ts'

const MODE_BG: Record<string, string> = {
  'trend-up': 'oklch(0.6 0.2 150 / 0.05)',
  'trend-down': 'oklch(0.6 0.2 30 / 0.05)',
  'high-vol': 'oklch(0.7 0.15 80 / 0.05)',
  'range': 'oklch(0.5 0.05 260 / 0.03)',
  'unknown': 'oklch(0.5 0.05 260 / 0.03)',
}

export function renderSegments(
  ctx: CanvasRenderingContext2D,
  segments: OverlaySegment[],
  scale: Scale,
  config: ChartConfig,
): void {
  for (const seg of segments) {
    const x1 = scale.x(seg.startIndex)
    const x2 = scale.x(seg.endIndex) + scale.candleWidth
    const w = x2 - x1

    ctx.fillStyle = MODE_BG[seg.mode] ?? MODE_BG.unknown
    ctx.fillRect(x1, config.padding.top, w, config.height - config.padding.top - config.padding.bottom)

    if (seg.valueAreaHigh && seg.valueAreaLow) {
      const vyLow = scale.y(seg.valueAreaLow)
      const vyHigh = scale.y(seg.valueAreaHigh)
      ctx.fillStyle = 'oklch(1 0 0 / 0.03)'
      ctx.fillRect(x1, vyHigh, w, vyLow - vyHigh)
    }

    if (seg.poc) {
      const py = scale.y(seg.poc)
      ctx.strokeStyle = 'oklch(1 0 0 / 0.4)'
      ctx.lineWidth = 1
      ctx.setLineDash([4, 4])
      ctx.beginPath()
      ctx.moveTo(x1, py)
      ctx.lineTo(x2, py)
      ctx.stroke()
      ctx.setLineDash([])
    }
  }
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
