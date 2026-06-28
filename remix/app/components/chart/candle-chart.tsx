import { clientEntry, type Handle } from 'remix/ui'

import type { Candle } from '../../types/candles.ts'
import type { OverlayData } from './types.ts'
import { renderChart } from './chart-canvas.ts'

interface CandleChartProps {
  candles: Candle[]
  overlays: OverlayData
}

export const CandleChart = clientEntry(
  import.meta.url,
  function CandleChart(handle: Handle<CandleChartProps>) {
    let observer: ResizeObserver | null = null

    function setupCanvas() {
      const el = document.getElementById('candle-chart-canvas') as HTMLCanvasElement | null
      if (!el) return

      function render() {
        const cvs = document.getElementById('candle-chart-canvas') as HTMLCanvasElement | null
        if (!cvs) return
        const dpr = window.devicePixelRatio || 1
        const rect = cvs.getBoundingClientRect()
        cvs.width = rect.width * dpr
        cvs.height = rect.height * dpr

        const ctx = cvs.getContext('2d')
        if (!ctx) return

        ctx.scale(dpr, dpr)

        const config = {
          width: rect.width,
          height: rect.height,
          padding: { top: 16, right: 60, bottom: 8, left: 8 },
        }

        renderChart(ctx, handle.props.candles, handle.props.overlays, config)
      }

      render()
      observer = new ResizeObserver(() => render())
      observer.observe(el)
    }

    return () => {
      if (typeof document !== 'undefined' && !observer) {
        setTimeout(setupCanvas, 0)
      }

      return (
        <canvas
          id="candle-chart-canvas"
          style={{ display: 'block', width: '100%', height: 'calc(100vh - 48px)' }}
        />
      )
    }
  } as any,
)
