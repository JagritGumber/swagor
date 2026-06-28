import type { Candle } from '../../types/candles.ts'
import type { ChartConfig, OverlayData } from './types.ts'
import { buildScale } from './scale.ts'
import { renderCandle } from './render-candle.ts'
import {
  renderValueArea,
  renderPoc,
  renderRegimeBands,
  renderPriceMarker,
} from './render-overlay.ts'
import { renderAxis } from './render-axis.ts'

export function renderChart(
  ctx: CanvasRenderingContext2D,
  candles: Candle[],
  overlays: OverlayData,
  config: ChartConfig,
): void {
  const scale = buildScale(candles, config)

  ctx.clearRect(0, 0, config.width, config.height)

  ctx.fillStyle = 'oklch(0 0 0)'
  ctx.fillRect(0, 0, config.width, config.height)

  if (overlays.regimeMode) {
    renderRegimeBands(ctx, overlays.regimeMode, scale, config)
  }

  if (overlays.valueAreaLow !== undefined && overlays.valueAreaHigh !== undefined) {
    renderValueArea(ctx, overlays.valueAreaLow, overlays.valueAreaHigh, scale, config)
  }

  if (overlays.poc !== undefined) {
    renderPoc(ctx, overlays.poc, scale, config)
  }

  for (let i = 0; i < candles.length; i++) {
    renderCandle(ctx, candles[i], scale, i)
  }

  if (overlays.currentPrice !== undefined) {
    renderPriceMarker(ctx, overlays.currentPrice, scale, config)
  }

  renderAxis(ctx, scale, config)
}
