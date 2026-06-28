import type { Candle } from '../types/candles.ts'
import type { OverlaySegment } from '../components/chart/types.ts'
import { createChart } from '../components/chart/create-chart.ts'

const dataEl = document.getElementById('chart-data')
if (!(dataEl instanceof HTMLElement)) {
  throw new Error('chart-data element not found')
}
const { candles, segments } = JSON.parse(dataEl.textContent ?? '{}') as {
  candles: Candle[]
  segments: OverlaySegment[]
}

const chart = createChart({ container: '#chart-container', candles, segments })
chart.render()
