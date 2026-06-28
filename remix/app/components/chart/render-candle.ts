import type { Candle } from '../../types/candles.ts'
import type { Scale } from './types.ts'
import { ACCENT_GREEN, NEGATIVE } from '../../constants/theme.ts'

export function renderCandle(
  ctx: CanvasRenderingContext2D,
  candle: Candle,
  scale: Scale,
  index: number,
): void {
  const cx = scale.x(index)
  const yHigh = scale.y(candle.h)
  const yLow = scale.y(candle.l)
  const yOpen = scale.y(candle.o)
  const yClose = scale.y(candle.c)

  const isUp = candle.c >= candle.o
  ctx.fillStyle = isUp ? ACCENT_GREEN : NEGATIVE

  const wickWidth = Math.max(1, scale.candleWidth * 0.15)
  ctx.fillRect(cx - wickWidth / 2, yHigh, wickWidth, yLow - yHigh)

  const bodyTop = isUp ? yClose : yOpen
  const bodyBottom = isUp ? yOpen : yClose
  const bodyHeight = Math.max(1, bodyBottom - bodyTop)
  ctx.fillRect(cx - scale.candleWidth / 2, bodyTop, scale.candleWidth, bodyHeight)
}
